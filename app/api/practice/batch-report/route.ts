import { NextResponse } from "next/server";
import { deepseekChat, getDeepseekChatConfig } from "@/lib/ai/deepseek";
import { parseJsonFromModelText } from "@/lib/ai/parse-model-json";
import { buildBatchReportUser, BATCH_REPORT_SYSTEM } from "@/lib/ai/prompt-batch-report";
import { logAiTrace } from "@/lib/ai/trace-logger";
import { isPracticeAnswerCorrect } from "@/lib/tutor/evaluate-practice";
import { fillAnswersEquivalent } from "@/lib/tutor/fill-answer-equivalence";
import { loadQuestionByIdFromDb } from "@/lib/tutor/load-questions";
import { PRACTICE_QUESTIONS } from "@/lib/tutor/practice-questions";
import type {
  BatchQuestionAttempt,
  BatchQuestionResult,
  BatchReport,
  BatchReportRequest,
} from "@/lib/tutor/types";

export const runtime = "nodejs";

async function questionById(id: string) {
  const fromDb = await loadQuestionByIdFromDb(id);
  if (fromDb) return fromDb;
  return PRACTICE_QUESTIONS.find((q) => q.id === id);
}

function studentAnswerSummary(at: BatchQuestionAttempt): string {
  if (at.kind === "mcq") return `選項 ${at.selectedChoice ?? "（未選）"}`;
  return at.studentFillAnswer?.trim() || "（未填）";
}

function thoughtFeedbackForAttempt(at: BatchQuestionAttempt, isCorrect: boolean): string {
  const history = Array.isArray(at.thoughtHistory)
    ? at.thoughtHistory.map((x) => x.trim()).filter(Boolean)
    : [];
  const summary = (at.thoughtSummary ?? "").trim();
  const thoughtCount = new Set([...history, summary].filter(Boolean)).size;
  if (thoughtCount === 0) {
    return isCorrect
      ? "你這題雖未提交思路，但答案正確，節奏很好；下次若多寫一小步想法，會更有助於鞏固方法。"
      : "這題還沒留下思路沒關係，先從「已知條件 → 目標量」寫一行即可，下一題會更穩。";
  }
  if (thoughtCount >= 2) {
    return "你有持續修正思路，這很棒；建議保留「先列已知、再選公式」的兩段式結構。";
  }
  return "有寫出思路是好習慣；下一題可再多補一個關鍵轉換步驟，讓推理更完整。";
}

function isAttemptCorrectWithoutQuestion(at: BatchQuestionAttempt): boolean {
  if (at.kind === "mcq") {
    const selected = (at.selectedChoice ?? "").trim().toUpperCase();
    const expected = (at.expectedChoiceKey ?? "").trim().toUpperCase();
    return Boolean(expected) && selected === expected;
  }
  const student = (at.studentFillAnswer ?? "").trim();
  const expected = (at.expectedFillAnswer ?? "").trim();
  if (!student || !expected) return false;
  if (student.replace(/\s+/g, "").toLowerCase() === expected.replace(/\s+/g, "").toLowerCase()) {
    return true;
  }
  return fillAnswersEquivalent(student, expected);
}

function fallbackSummary(
  results: BatchQuestionResult[],
  attempts: BatchQuestionAttempt[],
): {
  summary: string;
  weakTopics: string[];
  nextTopicSuggestions: string[];
  difficultyAdvice: "up" | "keep" | "down";
  recommendedLevel: "L1" | "L2" | "L3" | "L4";
} {
  const total = results.length;
  const correct = results.filter((r) => r.isCorrect).length;
  const acc = total > 0 ? correct / total : 0;
  const difficultyAdvice =
    acc >= 0.8 ? "up" : acc >= 0.45 ? "keep" : "down";
  const recommendedLevel =
    acc >= 0.95 ? "L4" : acc >= 0.8 ? "L3" : acc >= 0.45 ? "L2" : "L1";
  const mcqAttempts = attempts.filter((a) => a.kind === "mcq");
  const fillAttempts = attempts.filter((a) => a.kind === "fill");
  const aiAttempts = attempts.filter((a) => a.isAiGenerated);
  const thoughtCount = attempts.filter((a) => (a.thoughtSummary ?? "").trim().length > 0).length;
  const hintUsedCount = attempts.filter((a) => a.hintsUnlockedLayerMax >= 0).length;
  const summary = `本組共 ${total} 題，答對 ${correct} 題。題型分佈為選擇 ${mcqAttempts.length} 題、填空 ${fillAttempts.length} 題；AI 生成題 ${aiAttempts.length} 題。你在本組的作答穩定度不錯，建議下一輪維持先列已知再下式的節奏，並把填空題答案寫成更完整的向量/分式形式以降低格式誤差。另可在每題多寫一步思路（本組 ${thoughtCount} 題有提交），若卡關可更早啟用提示（本組 ${hintUsedCount} 題使用提示），有助於形成可遷移的解題流程。`;
  return {
    summary,
    weakTopics: [],
    nextTopicSuggestions: [],
    difficultyAdvice,
    recommendedLevel,
  };
}

const LEVEL_ORDER = ["L1", "L2", "L3", "L4"] as const;
type Level = (typeof LEVEL_ORDER)[number];

function normalizeLevelInput(v: unknown): Level | null {
  if (v === "L1" || v === "L2" || v === "L3" || v === "L4") return v;
  return null;
}

function maxLevel(a: Level, b: Level): Level {
  return LEVEL_ORDER.indexOf(a) >= LEVEL_ORDER.indexOf(b) ? a : b;
}

function normalizeAdvice(v: unknown): "up" | "keep" | "down" {
  if (v === "up" || v === "keep" || v === "down") return v;
  return "keep";
}

function normalizeLevel(v: unknown, fallback: "L1" | "L2" | "L3" | "L4") {
  if (v === "L1" || v === "L2" || v === "L3" || v === "L4") return v;
  return fallback;
}

function studentFocusedSummary(text: string, fallback: string): string {
  const t = text.trim();
  if (!t) return fallback;
  if (
    /題庫|資料庫|資料量|樣本不足|系統限制|現有資料|資料不足|無法判斷|不足以判斷|無法識別|識別具體弱點/.test(
      t,
    )
  ) {
    return fallback;
  }
  return t;
}

export async function POST(req: Request) {
  let body: BatchReportRequest;
  try {
    body = (await req.json()) as BatchReportRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const attempts = Array.isArray(body.attempts) ? body.attempts : [];
  const baselineLevel = normalizeLevelInput(body.baselineLevel);
  if (!body.batchId || attempts.length === 0) {
    return NextResponse.json({ error: "batchId and attempts required" }, { status: 400 });
  }

  const results: BatchQuestionResult[] = [];
  for (const at of attempts) {
    const q = await questionById(at.questionId);
    const isCorrect = q
      ? isPracticeAnswerCorrect(
          q,
          at.selectedChoice ?? null,
          at.studentFillAnswer ?? null,
        )
      : isAttemptCorrectWithoutQuestion(at);
    const studentAns = studentAnswerSummary(at);
    const stdAns = q
      ? q.kind === "mcq"
        ? `選項 ${q.correctKey}`
        : (q.fillAnswer?.trim() || "（題庫未設標準答案）")
      : at.kind === "mcq"
        ? `選項 ${(at.expectedChoiceKey ?? "").trim().toUpperCase() || "（未提供）"}`
        : (at.expectedFillAnswer?.trim() || "（未提供）");
    const feedbackIncorrect =
      (q?.kind ?? at.kind) === "fill" &&
      !stdAns.includes("題庫未設") &&
      !stdAns.includes("未提供") &&
      !/^選項\s/.test(stdAns)
        ? `建議對照標準答案：$${stdAns.replace(/^\$+|\$+$/g, "").trim()}$`
        : `建議對照標準答案：${stdAns}`;
    const answerFeedback = isCorrect ? "答案正確，作答方向清楚。" : feedbackIncorrect;
    const thoughtFeedback = thoughtFeedbackForAttempt(at, isCorrect);
    results.push({
      questionId: at.questionId,
      isCorrect,
      studentAnswerSummary: studentAns,
      standardAnswerSummary: stdAns,
      feedback: `${answerFeedback} ${thoughtFeedback}`.trim(),
      answerFeedback,
      thoughtFeedback,
    });
  }

  if (results.length === 0) {
    return NextResponse.json({ error: "no valid attempts" }, { status: 400 });
  }

  const base = fallbackSummary(results, attempts);
  const topicSet = new Set(
    attempts
      .map((a) => a.topicTag?.trim())
      .filter((x): x is string => Boolean(x)),
  );
  const needsAiGeneration = attempts.length < 5 || topicSet.size < 2;
  const systemLabel = needsAiGeneration
    ? "本組題型覆蓋較集中，下一組將依建議等級優先補入 AI 生成題。"
    : null;
  const report: BatchReport = {
    batchId: body.batchId,
    batchIndex: Math.max(0, Math.floor(body.batchIndex ?? 0)),
    generatedAt: new Date().toISOString(),
    source: "fallback",
    summary: base.summary,
    systemLabel,
    needsAiGeneration,
    weakTopics: base.weakTopics,
    nextTopicSuggestions: base.nextTopicSuggestions,
    difficultyAdvice: base.difficultyAdvice,
    recommendedLevel: baselineLevel
      ? maxLevel(base.recommendedLevel, baselineLevel)
      : base.recommendedLevel,
    questionResults: results,
  };

  if (!getDeepseekChatConfig()) {
    return NextResponse.json({ report });
  }

  try {
    const promptPayload = {
      batchIndex: report.batchIndex,
      results,
      attemptsSummary: {
        total: attempts.length,
        mcqTotal: attempts.filter((a) => a.kind === "mcq").length,
        fillTotal: attempts.filter((a) => a.kind === "fill").length,
        aiTotal: attempts.filter((a) => a.isAiGenerated).length,
        thoughtSubmitted: attempts.filter((a) => (a.thoughtSummary ?? "").trim().length > 0).length,
        hintUsed: attempts.filter((a) => a.hintsUnlockedLayerMax >= 0).length,
      },
    };
    await logAiTrace({
      route: "/api/practice/batch-report",
      phase: "prompt",
      payload: promptPayload,
    });
    const text = await deepseekChat(
      [
        { role: "system", content: BATCH_REPORT_SYSTEM },
        {
          role: "user",
          content: buildBatchReportUser(promptPayload),
        },
      ],
      { jsonObject: true, temperature: 0.3 },
    );
    await logAiTrace({
      route: "/api/practice/batch-report",
      phase: "response",
      meta: { rawChars: text.length },
      payload: text,
    });
    const parsed = parseJsonFromModelText(text) as Record<string, unknown>;
    await logAiTrace({
      route: "/api/practice/batch-report",
      phase: "result",
      payload: parsed,
    });
    report.source = "deepseek";
    report.summary = studentFocusedSummary(
      typeof parsed.summary === "string" && parsed.summary.trim()
        ? parsed.summary.trim().slice(0, 500)
        : report.summary,
      report.summary,
    );
    report.weakTopics = Array.isArray(parsed.weak_topics)
      ? parsed.weak_topics.filter((x): x is string => typeof x === "string").slice(0, 6)
      : [];
    report.nextTopicSuggestions = Array.isArray(parsed.next_topic_suggestions)
      ? parsed.next_topic_suggestions
          .filter((x): x is string => typeof x === "string")
          .slice(0, 6)
      : [];
    report.difficultyAdvice = normalizeAdvice(parsed.difficulty_advice);
    const aiLevel = normalizeLevel(
      parsed.recommended_level,
      report.recommendedLevel ?? "L2",
    );
    report.recommendedLevel = baselineLevel
      ? maxLevel(aiLevel, baselineLevel)
      : aiLevel;
  } catch {
    await logAiTrace({
      route: "/api/practice/batch-report",
      phase: "error",
      payload: { message: "deepseek_or_parse_failed" },
    });
    // keep fallback report
  }

  return NextResponse.json({ report });
}
