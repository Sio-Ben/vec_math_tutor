import { NextResponse } from "next/server";
import { deepseekChat, getDeepseekChatConfig } from "@/lib/ai/deepseek";
import { parseJsonFromModelText } from "@/lib/ai/parse-model-json";
import { mockMasteryReportV2 } from "@/lib/ai/mastery-report-mock";
import { logAiTrace } from "@/lib/ai/trace-logger";
import {
  buildMasteryReportUser,
  MASTERY_REPORT_SYSTEM_PROMPT,
} from "@/lib/ai/prompts/mastery-report";
import type {
  MasteryReportRequestBody,
  MasteryReportV2,
} from "@/lib/progress/types";

type Level = "L1" | "L2" | "L3" | "L4";

function normalizeLevel(v: unknown): Level | null {
  return v === "L1" || v === "L2" || v === "L3" || v === "L4" ? v : null;
}

function normalizeTopicScores(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const topic = String(k ?? "").trim();
    if (!topic) continue;
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n)) continue;
    out[topic] = Math.max(0, Math.min(100, Math.round(n)));
  }
  return out;
}

function normalizeTopicOrder(raw: unknown, fallback: string[]): string[] {
  if (!Array.isArray(raw)) return fallback.slice(0, 6);
  const uniq = [...new Set(raw.map((x) => String(x ?? "").trim()).filter(Boolean))];
  return uniq.slice(0, 6);
}

function normalizeNarrative(raw: unknown, fallback: string): string {
  const text = typeof raw === "string" ? raw.trim() : "";
  if (!text) return fallback;
  return text.slice(0, 320);
}

export async function POST(req: Request) {
  let body: MasteryReportRequestBody;
  try {
    body = (await req.json()) as MasteryReportRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(body.practiceEvents)) {
    return NextResponse.json({ error: "practiceEvents required" }, { status: 400 });
  }

  const fallback = mockMasteryReportV2(body);
  if (!getDeepseekChatConfig()) {
    await logAiTrace({
      route: "/api/mastery/report",
      phase: "result",
      meta: { source: "fallback", reason: "no_deepseek_key" },
      payload: {
        diagnosticJson: body.diagnostic ?? null,
        practiceEventsCount: Array.isArray(body.practiceEvents) ? body.practiceEvents.length : 0,
      },
    });
    return NextResponse.json({ report: fallback });
  }

  try {
    const promptPayload = {
      diagnosticJson: body.diagnostic ?? null,
      practiceEventsJson: body.practiceEvents ?? [],
      batchReportsJson: body.batchReports ?? [],
      previousReportJson: body.previousReport ?? null,
    };
    await logAiTrace({
      route: "/api/mastery/report",
      phase: "prompt",
      payload: promptPayload,
    });
    const text = await deepseekChat(
      [
        { role: "system", content: MASTERY_REPORT_SYSTEM_PROMPT },
        {
          role: "user",
          content: buildMasteryReportUser({
            diagnosticJson: JSON.stringify(promptPayload.diagnosticJson),
            practiceEventsJson: JSON.stringify(promptPayload.practiceEventsJson),
            batchReportsJson: JSON.stringify(promptPayload.batchReportsJson),
            previousReportJson: JSON.stringify(promptPayload.previousReportJson),
          }),
        },
      ],
      { jsonObject: true, temperature: 0.25 },
    );
    await logAiTrace({
      route: "/api/mastery/report",
      phase: "response",
      meta: { rawChars: text.length },
      payload: text,
    });
    const parsed = parseJsonFromModelText(text) as Record<string, unknown>;
    await logAiTrace({
      route: "/api/mastery/report",
      phase: "result",
      payload: parsed,
    });
    const recommendedDifficulty =
      normalizeLevel(parsed.recommendedDifficulty) ??
      fallback.recommendedDifficulty ??
      "L2";
    const report: MasteryReportV2 = {
      narrative: normalizeNarrative(parsed.narrative, fallback.narrative),
      topicScores: normalizeTopicScores(parsed.topicScores),
      recommendedTopicOrder: normalizeTopicOrder(
        parsed.recommendedTopicOrder,
        fallback.recommendedTopicOrder,
      ),
      generatedAt: new Date().toISOString(),
      basedOnPracticeEventCount: body.practiceEvents.length,
      modelNote: "deepseek_mastery_v1",
      recommendedDifficulty,
    };
    return NextResponse.json({ report });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[mastery/report]", msg);
    await logAiTrace({
      route: "/api/mastery/report",
      phase: "error",
      payload: { message: msg },
    });
    return NextResponse.json({
      report: {
        ...fallback,
        modelNote: `fallback:${msg.slice(0, 120)}`,
      },
    });
  }
}
