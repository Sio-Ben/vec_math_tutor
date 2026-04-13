import { NextResponse } from "next/server";
import { prioritizeQuestionsByTopicTags } from "@/lib/practice/sort-by-weak-topics";
import { loadPracticeQuestionsFromDb } from "@/lib/tutor/load-questions";
import { PRACTICE_QUESTIONS } from "@/lib/tutor/practice-questions";

/**
 * 讀取 Supabase 題庫；失敗或無資料時回傳示範題，讓前端仍能運作。
 * Query: `prioritize=vec_addition,dot_product` — 將對應 topic 的題目排到前面（依診斷弱項）。
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const prioritize = searchParams
    .get("prioritize")
    ?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const { questions, error } = await loadPracticeQuestionsFromDb();
  if (questions.length > 0) {
    const ordered =
      prioritize && prioritize.length > 0
        ? prioritizeQuestionsByTopicTags(questions, prioritize)
        : questions;
    return NextResponse.json({
      source: "supabase" as const,
      count: ordered.length,
      questions: ordered,
      prioritize: prioritize ?? [],
      warning: error,
    });
  }
  const fallback =
    prioritize && prioritize.length > 0
      ? prioritizeQuestionsByTopicTags(PRACTICE_QUESTIONS, prioritize)
      : PRACTICE_QUESTIONS;

  return NextResponse.json({
    source: "fallback" as const,
    count: fallback.length,
    questions: fallback,
    prioritize: prioritize ?? [],
    warning:
      error ??
      "題庫讀取失敗或 0 筆；已改用本機示範題。請看 scripts/supabase-vector-questions-anon-read.sql，或設定 SUPABASE_SERVICE_ROLE_KEY。",
  });
}
