import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, requireTeacher, requireActivation, ApiError, handleApiError } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const updateLectureSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(5000).optional(),
  category: z.string().max(120).optional(),
  seriesName: z.string().max(300).nullable().optional(),
  partNumber: z.number().int().nullable().optional(),
  status: z
    .enum(["DRAFT", "RECORDING", "PROCESSING", "AI_ANALYZED", "IN_REVIEW", "PUBLISHED", "UNPUBLISHED"])
    .optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  try {
    await requireActivation();
    const lecture = await prisma.lecture.findUnique({
      where: { id: routeParams.id },
      include: {
        speakers: true,
        recordings: { orderBy: { createdAt: "desc" }, take: 1 },
        lectureTopics: { include: { topic: true } },
      },
    });

    if (!lecture) throw new ApiError(404, "Lecture not found");

    if(lecture.status !== "PUBLISHED") await requireTeacher();
    const safeLecture={...lecture,recordings:lecture.recordings.map(({audioBase64,...metadata})=>metadata)};
    return NextResponse.json({ lecture:safeLecture },{headers:{"Cache-Control":"private, no-store"}});

  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  try {
    const user = await requireTeacher();

    const body = await req.json();
    const parsed = updateLectureSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
    }

    const current = await prisma.lecture.findUnique({ where: { id: routeParams.id } });
    if (!current) throw new ApiError(404, "Lecture not found");

    const updated = await prisma.lecture.update({
      where: { id: routeParams.id },
      data: parsed.data,
      include: {
        speakers: true,
        recordings: { orderBy: { createdAt: "desc" }, take: 1 },
        lectureTopics: { include: { topic: true } },
      },
    });

    try {
      await logAudit({
        actorId: user.id,
        action: "lecture.update",
        entityType: "Lecture",
        entityId: updated.id,
        metadata: parsed.data,
      });
    } catch {}

    return NextResponse.json({ lecture: updated });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  try {
    const user = await requireTeacher();

    const lecture = await prisma.lecture.findUnique({ where: { id: routeParams.id } });
    if (!lecture) throw new ApiError(404, "Lecture not found");

    await prisma.$transaction([
      prisma.lectureImage.deleteMany({ where: { lectureId: routeParams.id } }),
      prisma.lectureTopic.deleteMany({ where: { lectureId: routeParams.id } }),
      prisma.aiAnalysis.deleteMany({ where: { lectureId: routeParams.id } }),
      prisma.manualMarker.deleteMany({ where: { lectureId: routeParams.id } }),
      prisma.studentQuestion.deleteMany({ where: { lectureId: routeParams.id } }),
      prisma.studentConfusion.deleteMany({ where: { lectureId: routeParams.id } }),
      prisma.studentNote.deleteMany({ where: { lectureId: routeParams.id } }),
      prisma.transcriptSegment.deleteMany({ where: { lectureId: routeParams.id } }),
      prisma.recordingSegment.deleteMany({
        where: { recording: { lectureId: routeParams.id } },
      }),
      prisma.lectureRecording.deleteMany({ where: { lectureId: routeParams.id } }),
      prisma.speaker.deleteMany({ where: { lectureId: routeParams.id } }),
      prisma.lecture.delete({ where: { id: routeParams.id } }),
    ]);

    try {
      await logAudit({
        actorId: user.id,
        action: "lecture.delete",
        entityType: "Lecture",
        entityId: routeParams.id,
        metadata: { title: lecture.title },
      });
    } catch {}

    return NextResponse.json({ success: true, message: "Lecture deleted cleanly" });
  } catch (err) {
    return handleApiError(err);
  }
}
