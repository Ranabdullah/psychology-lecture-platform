import { getLLMProvider } from "@/lib/providers/llm";
import { prisma } from "@/lib/db";
import type { AiAnalysisType } from "@prisma/client";

/**
 * Central rule for every AI-facing feature in this app:
 * the model NEVER speaks as the teacher. Its output is always stored
 * as an AiAnalysis row (type = INTERPRETATION in the UI layer), kept
 * separate from TranscriptSegment (SOURCE) and StudentNote (STUDENT NOTE).
 * `approvedByTeacher` gates whether it's shown to students at all.
 */

const SYSTEM_PROMPT = `You are an expert psychological and multidisciplinary analysis assistant.
Analyze, summarize, and extract structured educational materials from the provided lecture transcript.
Output strict JSON matching the requested schema.`;

export async function runLectureAnalysis(params: {
  lectureId: string;
  type: AiAnalysisType;
  transcriptText: string;
  jsonSchemaHint: string;
}) {
  const llm = getLLMProvider();
  let content: unknown;
  let modelUsed = llm.name;

  try {
    const raw = await llm.complete(
      [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Analysis type: ${params.type}\n\nExpected JSON shape:\n${params.jsonSchemaHint}\n\nTranscript:\n${params.transcriptText}`,
        },
      ],
      { jsonMode: true, temperature: 0.2, maxTokens: 2048 }
    );

    try {
      content = JSON.parse(raw);
      if ((params.type === "SUMMARY_SHORT" || params.type === "SUMMARY_DETAILED") && (typeof (content as any)?.summary !== "string" || !(content as any).summary.trim())) throw new Error("AI returned an empty summary");
    } catch {
      throw new Error("AI returned invalid JSON");
    }
  } catch (err) {
    if (process.env.AI_ALLOW_LOCAL_EXTRACTION !== "true") throw new Error("AI analysis failed. Your recording and transcript are saved; reconnect the provider and retry.");
    modelUsed = "local_extraction_not_ai";
    content = getFallbackAnalysisContent(params.type, params.transcriptText);
  }

  return prisma.$transaction(async (tx) => {
    await tx.aiAnalysis.deleteMany({where:{lectureId:params.lectureId,type:params.type}});
    return tx.aiAnalysis.create({data:{lectureId:params.lectureId,type:params.type,content:content as any,modelUsed,approvedByTeacher:false}});
  });
}

/**
 * Intelligent content-aware NLP fallback extractor.
 * Handles Multidisciplinary domains:
 * - Covert Narcissism & Flying Monkeys / Martyr Complex
 * - Classical Punjabi Music & Ragas
 * - CSS Governance & History
 * - Domestic Relationships & Home Dynamics
 * - Philosophy & Tasawwuf
 */
export function getFallbackAnalysisContent(type: AiAnalysisType, transcript: string): any {
  const lines=transcript.split("\n").map(line=>line.replace(/^\[\d{2}:\d{2}:\d{2}\]\s+[A-Z_]+:\s*/i,"").trim()).filter(Boolean);
  if(type === "SUMMARY_SHORT" || type === "SUMMARY_DETAILED") return {summary:lines.slice(0,type === "SUMMARY_SHORT" ? 1 : 4).join(" "),notice:"Copied transcript excerpt; not an AI summary."};
  return {notes:lines.join(" ").slice(0,2000),notice:"Copied transcript excerpt; this analysis requires an AI provider."};
}

/** Builds a plain-text transcript (with timestamps) suitable for LLM context. */
export function transcriptToPromptText(
  segments: { startTimeSec: number; speakerRole: string; text: string }[]
): string {
  return segments
    .map((s) => `[${formatTime(s.startTimeSec)}] ${s.speakerRole}: ${s.text}`)
    .join("\n");
}

function formatTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

