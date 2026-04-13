import { NextResponse } from "next/server";
import { deepseekChat, readDeepseekApiKey } from "@/lib/ai/deepseek";
import { enrichReportTopicTags } from "@/lib/ai/enrich-report";
import { parseJsonFromModelText } from "@/lib/ai/parse-model-json";
import { buildPromptAUser, PROMPT_A_SYSTEM } from "@/lib/ai/prompt-a";
import { mergeAiClientReport } from "@/lib/ai/validate-client-report";
import type { QuestionOutcome } from "@/lib/diagnostic-types";
import { buildClientReport, type ClientReport } from "@/lib/report-from-results";

type Body = {
  results?: QuestionOutcome[];
  totalTimeSeconds?: number;
};

function questionResultsLines(results: QuestionOutcome[]): string {
  return results
    .map((r) => {
      const tag = (r.topicTag ?? "").trim();
      return `${r.q} | ${r.topic} | ${tag} | ${r.level} | ${r.correct ? "正確" : "錯誤"} | ${r.timeSeconds}`;
    })
    .join("\n");
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const results = body.results;
  if (!Array.isArray(results) || results.length === 0) {
    return NextResponse.json({ error: "results required" }, { status: 400 });
  }

  const totalTimeSeconds =
    typeof body.totalTimeSeconds === "number" && body.totalTimeSeconds >= 0
      ? Math.round(body.totalTimeSeconds)
      : results.reduce((s, r) => s + (r.timeSeconds ?? 0), 0);

  const fallback = buildClientReport(results);

  if (!readDeepseekApiKey()) {
    const report = enrichReportTopicTags(fallback, results);
    return NextResponse.json({
      report,
      source: "local_only",
      note: "未設定 DEEPSEEK_API_KEY，已使用本機報告。",
    });
  }

  try {
    const user = buildPromptAUser({
      studentId: "local-session",
      totalTimeSeconds,
      questionResultsJson: questionResultsLines(results),
    });
    const text = await deepseekChat(
      [
        { role: "system", content: PROMPT_A_SYSTEM },
        { role: "user", content: user },
      ],
      { jsonObject: true, temperature: 0.35 },
    );
    const parsed = parseJsonFromModelText(text);
    const merged = mergeAiClientReport(parsed, fallback);
    const report: ClientReport = enrichReportTopicTags(merged, results);
    return NextResponse.json({ report, source: "deepseek" });
  } catch (e) {
    const message = e instanceof Error ? e.message : "analyze failed";
    const report = enrichReportTopicTags(fallback, results);
    return NextResponse.json(
      {
        report,
        source: "local_fallback",
        error: message.slice(0, 200),
      },
      { status: 200 },
    );
  }
}
