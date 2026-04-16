import { NextResponse } from "next/server";
import { deepseekChat, readDeepseekApiKey } from "@/lib/ai/deepseek";
import { enrichReportTopicTags } from "@/lib/ai/enrich-report";
import { parseJsonFromModelText } from "@/lib/ai/parse-model-json";
import { buildPromptAUser, PROMPT_A_SYSTEM } from "@/lib/ai/prompt-a";
import { mergeAiClientReport } from "@/lib/ai/validate-client-report";
import type { QuestionOutcome } from "@/lib/diagnostic-types";
import { DIAGNOSTIC_QUESTIONS } from "@/lib/diagnostic-data";
import { buildClientReport, type ClientReport } from "@/lib/report-from-results";

type Body = {
  results?: QuestionOutcome[];
  totalTimeSeconds?: number;
  answerMap?: Record<string, string>;
};

type FillReviewHit = {
  q: number;
  correct: boolean;
};

function diagnosticStemPlain(q: (typeof DIAGNOSTIC_QUESTIONS)[number]): string {
  return q.stem
    .map((part) => ("value" in part ? part.value : `$${part.latex}$`))
    .join("");
}

function expectedFillAnswerHint(qNum: number): string {
  if (qNum === 5) return "3";
  if (qNum === 8) return "60°（或 pi/3）";
  return "請依題意判斷";
}

async function aiReviewFillAnswers(
  results: QuestionOutcome[],
  answerMap?: Record<string, string>,
): Promise<FillReviewHit[]> {
  if (!answerMap) return [];

  const fillPayload = results
    .map((r) => {
      const q = DIAGNOSTIC_QUESTIONS.find((x) => x.id === r.q && x.kind === "fill");
      if (!q) return null;
      return {
        q: r.q,
        stem: diagnosticStemPlain(q),
        student_answer: String(answerMap[String(r.q)] ?? "").trim(),
        expected_hint: expectedFillAnswerHint(r.q),
      };
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x))
    .filter((x) => x.student_answer.length > 0);

  if (fillPayload.length === 0) return [];

  const system =
    "你是嚴謹的數學閱卷助理。只輸出 JSON 物件，不要 markdown，不要其他文字。";
  const user = `請複核以下填空題作答。學生答案可能包含解題過程或多餘文字，請判斷其最終數學答案是否正確。

輸入（JSON）：
${JSON.stringify(fillPayload)}

請輸出：
{
  "reviews": [
    { "q": 題號, "correct": true/false }
  ]
}

規則：
1) 只回傳輸入裡出現的題號。
2) 若最終答案正確，即使夾雜過程文字也判 correct=true。
3) 不確定時偏保守判 false。`;

  const text = await deepseekChat(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    { jsonObject: true, temperature: 0.1 },
  );
  const parsed = parseJsonFromModelText(text) as { reviews?: unknown };
  if (!parsed || !Array.isArray(parsed.reviews)) return [];

  return parsed.reviews
    .map((x) => {
      if (!x || typeof x !== "object") return null;
      const o = x as Record<string, unknown>;
      return {
        q: typeof o.q === "number" ? o.q : Number(o.q),
        correct: Boolean(o.correct),
      };
    })
    .filter((x): x is FillReviewHit => Boolean(x && Number.isFinite(x.q)));
}

function questionResultsLines(results: QuestionOutcome[]): string {
  return results
    .map((r) => {
      const tag = (r.topicTag ?? "").trim();
      return `${r.q} | ${r.topic} | ${tag} | ${r.level} | ${r.correct ? "正確" : "錯誤"} | ${r.timeSeconds}`;
    })
    .join("\n");
}

function reconcileReportTopics(
  report: ClientReport,
  results: QuestionOutcome[],
): ClientReport {
  const wrongTopicSet = new Set(
    results.filter((r) => !r.correct).map((r) => r.topic),
  );
  const rightTopicSet = new Set(
    results.filter((r) => r.correct).map((r) => r.topic),
  );

  const weak_topics = report.weak_topics.filter((w) => wrongTopicSet.has(w.topic));
  const strong_topics = report.strong_topics.filter((s) => rightTopicSet.has(s.topic));

  return {
    ...report,
    weak_topics,
    strong_topics,
  };
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

  let scoredResults = [...results];

  if (!readDeepseekApiKey()) {
    const fallback = buildClientReport(scoredResults);
    const report = enrichReportTopicTags(fallback, scoredResults);
    return NextResponse.json({
      report,
      results: scoredResults,
      source: "local_only",
      note: "未設定 DEEPSEEK_API_KEY，已使用本機報告。",
    });
  }

  try {
    const reviewed = await aiReviewFillAnswers(scoredResults, body.answerMap);
    if (reviewed.length > 0) {
      const reviewMap = new Map(reviewed.map((x) => [x.q, x.correct]));
      scoredResults = scoredResults.map((r) => {
        const q = DIAGNOSTIC_QUESTIONS.find((x) => x.id === r.q);
        if (!q || q.kind !== "fill") return r;
        if (!reviewMap.has(r.q)) return r;
        const aiCorrect = reviewMap.get(r.q);
        // 保守策略：AI 只用來「救回」本地誤判，不覆寫本地已判對的答案。
        if (r.correct) return r;
        if (aiCorrect === true) return { ...r, correct: true };
        return r;
      });
    }

    const fallback = buildClientReport(scoredResults);
    const user = buildPromptAUser({
      studentId: "local-session",
      totalTimeSeconds,
      questionResultsJson: questionResultsLines(scoredResults),
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
    const report: ClientReport = reconcileReportTopics(
      enrichReportTopicTags(merged, scoredResults),
      scoredResults,
    );
    return NextResponse.json({
      report,
      results: scoredResults,
      source: "deepseek",
      reviewMeta: { fillReviewedCount: reviewed.length },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "analyze failed";
    const fallback = buildClientReport(scoredResults);
    const report = reconcileReportTopics(
      enrichReportTopicTags(fallback, scoredResults),
      scoredResults,
    );
    return NextResponse.json(
      {
        report,
        results: scoredResults,
        source: "local_fallback",
        error: message.slice(0, 200),
      },
      { status: 200 },
    );
  }
}
