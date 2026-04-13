import type { QuestionBankRow } from "@/lib/tutor/question-bank";

function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t : null;
}

/** 將模型輸出的一筆題目盡量轉成 QuestionBankRow；失敗則 null */
export function coerceLlMQuestionRow(
  raw: unknown,
  index: number,
): QuestionBankRow | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  const id =
    str(o.id) ??
    str(o.question_id) ??
    `ai-gen-${Date.now()}-${index}`;

  const question_text = str(o.question_text) ?? str(o.questionText);
  if (!question_text) return null;

  const type = str(o.type) ?? "選擇題";
  const difficulty = str(o.difficulty) ?? "L2";
  const topic = str(o.topic) ?? "synthesis";

  const row: QuestionBankRow = {
    id,
    type,
    difficulty,
    topic,
    question_text,
    option_a: str(o.option_a) ?? str(o.optionA),
    option_b: str(o.option_b) ?? str(o.optionB),
    option_c: str(o.option_c) ?? str(o.optionC),
    option_d: str(o.option_d) ?? str(o.optionD),
    answer: str(o.answer),
    explanation: str(o.explanation),
    hint1: str(o.hint1),
    hint2: str(o.hint2),
    hint3: str(o.hint3),
    common_mistakes: str(o.common_mistakes) ?? str(o.commonMistakes),
    image_url: null,
    image_position: null,
    embed_text: null,
  };

  const isMcq =
    type === "選擇題" || type.toLowerCase() === "mcq" || type === "MCQ";
  if (isMcq) {
    const opts = [row.option_a, row.option_b, row.option_c, row.option_d].filter(
      Boolean,
    );
    if (opts.length < 2) return null;
    if (!row.answer || !/^[ABCD]$/i.test(row.answer)) return null;
  } else {
    if (!row.answer) return null;
  }

  return row;
}

export function coerceLlMQuestionRows(raw: unknown): QuestionBankRow[] {
  if (!raw || typeof raw !== "object") return [];
  const o = raw as Record<string, unknown>;
  const arr = o.questions;
  if (!Array.isArray(arr)) return [];
  const out: QuestionBankRow[] = [];
  arr.forEach((item, i) => {
    const row = coerceLlMQuestionRow(item, i);
    if (row) out.push(row);
  });
  return out;
}
