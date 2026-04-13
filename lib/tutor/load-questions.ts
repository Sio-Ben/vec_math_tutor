import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  bankRowToPracticeQuestion,
  type QuestionBankRow,
} from "@/lib/tutor/question-bank";
import type { PracticeQuestion } from "@/lib/tutor/practice-questions";

function questionsTable() {
  return process.env.SUPABASE_QUESTIONS_TABLE?.trim() || "vector_questions";
}

function formatPostgrestError(err: {
  message: string;
  details?: string;
  hint?: string;
  code?: string;
}): string {
  const parts = [err.message];
  if (err.details) parts.push(`details: ${err.details}`);
  if (err.hint) parts.push(`hint: ${err.hint}`);
  if (err.code) parts.push(`code: ${err.code}`);
  return parts.join(" · ");
}

async function getSupabaseForQuestions() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return createSupabaseAdminClient();
  }
  return createSupabaseServerClient();
}

export async function loadPracticeQuestionsFromDb(): Promise<{
  questions: PracticeQuestion[];
  error: string | null;
}> {
  const table = questionsTable();
  try {
    const supabase = await getSupabaseForQuestions();
    const { data, error } = await supabase.from(table).select("*").order("id");
    if (error) {
      return {
        questions: [],
        error: formatPostgrestError(error),
      };
    }

    const rows = (data ?? []) as QuestionBankRow[];
    if (rows.length === 0) {
      return {
        questions: [],
        error:
          `已連上 Supabase，但表「${table}」回傳 0 筆。常見原因：① 表內尚無資料 ② 已開啟 RLS，且 anon 沒有 SELECT 權限（查詢仍成功但列被全部擋下）。請在 Dashboard 確認資料列，或執行專案內 scripts/supabase-vector-questions-anon-read.sql（或於 .env.local 設定 SUPABASE_SERVICE_ROLE_KEY 僅供伺服端讀題）。`,
      };
    }

    const questions: PracticeQuestion[] = [];
    const mapErrors: string[] = [];
    for (const row of rows) {
      try {
        questions.push(bankRowToPracticeQuestion(row));
      } catch (e) {
        mapErrors.push(
          `${row?.id ?? "?"}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }

    if (questions.length === 0 && mapErrors.length > 0) {
      return {
        questions: [],
        error: `表「${table}」有 ${rows.length} 筆，但轉成題目格式失敗：${mapErrors.slice(0, 3).join("；")}`,
      };
    }

    return {
      questions,
      error:
        mapErrors.length > 0
          ? `已載入 ${questions.length} 題；略過 ${mapErrors.length} 筆格式異常列。`
          : null,
    };
  } catch (e) {
    return {
      questions: [],
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function loadQuestionByIdFromDb(
  id: string,
): Promise<PracticeQuestion | null> {
  const table = questionsTable();
  try {
    const supabase = await getSupabaseForQuestions();
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return null;
    return bankRowToPracticeQuestion(data as QuestionBankRow);
  } catch {
    return null;
  }
}
