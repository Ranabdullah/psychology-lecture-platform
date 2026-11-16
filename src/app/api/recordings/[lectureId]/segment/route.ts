import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireTeacher, ApiError, handleApiError } from "@/lib/rbac";
import { getStorageProvider } from "@/lib/providers/storage";

export const dynamic = "force-dynamic";

/**
 * POST /api/recordings/:lectureId/segment
 * multipart/form-data: { chunk: File, sequenceIndex: number, startOffsetSec: number }
 */
export async function POST(req: Request, { params }: { params: Promise<{ lectureId: string }> }) {
  const routeParams = await params;
  try {
    const user = await requireTeacher();

    const recording = await prisma.lectureRecording.findFirst({
      where: { lectureId: routeParams.lectureId, isFinalized: false },
    });
    if (!recording) throw new ApiError(400, "No active recording session — call /start first");

    const form = await req.formData();
    const chunk = form.get("chunk") as File | null;
    const sequenceIndex = Number(form.get("sequenceIndex"));
    const startOffsetSec = Number(form.get("startOffsetSec"));

    if (!chunk || !(chunk instanceof File) || !chunk.size || chunk.size>10*1024*1024 || !Number.isInteger(sequenceIndex) || sequenceIndex<0 || sequenceIndex>12000 || !Number.isFinite(startOffsetSec) || startOffsetSec<0 || startOffsetSec>36000) {
      return NextResponse.json({ error: "chunk, sequenceIndex, startOffsetSec are required" }, { status: 400 });
    }

    const storage = getStorageProvider();
    const key = `lectures/${routeParams.lectureId}/recordings/${recording.id}/chunk-${String(sequenceIndex).padStart(6, "0")}.webm`;
    const buffer = Buffer.from(await chunk.arrayBuffer());

    let writeFailed = false;
    let writeError: unknown = null;
    try {
      await storage.put(key, buffer, chunk.type || "audio/webm");
    } catch (storageErr) {
      // A failed upload must never be recorded as successful: doing so hides
      // missing audio until the teacher tries to review the lecture.
      writeFailed = true;
      writeError = storageErr;
      console.error(`Recording chunk ${sequenceIndex} could not be saved:`, storageErr);
    }

    const segment = await prisma.recordingSegment.upsert({
      where: { recordingId_sequenceIndex: { recordingId: recording.id, sequenceIndex } },
      create: {
        recordingId: recording.id,
        sequenceIndex,
        storageKey: key,
        startOffsetSec,
        status: writeFailed ? "failed" : "uploaded",
      },
      update: { storageKey: key, startOffsetSec, status: writeFailed ? "failed" : "uploaded" },
    });

    if (writeFailed) {
      return NextResponse.json(
        { segment, error: "This audio chunk could not be saved. Please check the connection and storage settings." },
        { status: 502 }
      );
    }

    return NextResponse.json({ segment }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
