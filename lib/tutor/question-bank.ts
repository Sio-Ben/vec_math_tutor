import type { PracticeQuestion, QuestionKind, StemSeg } from "./practice-questions";

/** 與設計稿 `vector_tutor_system_prompt` 對齊的 topic 標籤 → 顯示用 */
export const TOPIC_LABELS: Record<string, string> = {
  vec_magnitude: "向量 · 模長",
  vec_addition: "向量 · 加減",
  scalar_mult: "向量 · 數乘",
  vec_collinear: "向量 · 共線",
  dot_product: "向量 · 數量積",
  vec_angle: "向量 · 夾角",
  vec_geometry: "向量 · 幾何表達",
  synthesis: "向量 · 綜合",
  vec_perpendicular: "向量 · 垂直",
  vec_section: "向量 · 分點／中點",
  vec_projection: "向量 · 投影",
  vec_3d_coord: "空間向量 · 坐標",
  vec_proof: "向量 · 證明",
};

export type QuestionBankRow = {
  idx?: number | null;
  id: string;
  type: string;
  difficulty: string;
  topic: string;
  question_text: string;
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
  answer: string | null;
  explanation: string | null;
  hint1: string | null;
  hint2: string | null;
  hint3: string | null;
  common_mistakes: string | null;
  image_url: string | null;
  image_position: string | null;
  embed_text: string | null;
  embedding?: unknown;
};

/** 將 `question_text` 裡 `$...$` 切成文字／LaTeX 片段（與題庫 LaTeX 慣例一致） */
export function splitQuestionStem(text: string): StemSeg[] {
  const parts = text.split("$");
  if (parts.length < 2) {
    return [{ t: "text", v: text }];
  }
  const out: StemSeg[] = [];
  for (let i = 0; i < parts.length; i++) {
    const chunk = parts[i] ?? "";
    if (!chunk && i > 0 && i < parts.length - 1) continue;
    if (i % 2 === 0) {
      if (chunk) out.push({ t: "text", v: chunk });
    } else {
      out.push({ t: "math", m: chunk.trim() });
    }
  }
  return out.length ? out : [{ t: "text", v: text }];
}

function unitPillFromTopic(topic: string): string {
  const t = topic?.trim() ?? "";
  return TOPIC_LABELS[t] ?? (t ? `向量 · ${t}` : "向量");
}

function buildThoughtReply(row: QuestionBankRow, unitPill: string): string {
  const cm = row.common_mistakes?.trim();
  let base = `謝謝你寫下想法。這題屬於「${unitPill}」（${row.difficulty ?? ""}）。我們先不急著對答案——你覺得自己卡在最前面的是「定義」還是「計算步驟」？`;
  if (cm) {
    base += ` 常見易錯點之一是：${cm.slice(0, 120)}${cm.length > 120 ? "…" : ""}`;
  }
  return base;
}

function hintTutorLine(raw: string, layer: number, total: number): string {
  const body = raw.trim();
  if (!body) return "";
  if (total <= 1) return body;
  return `【第 ${layer + 1} 層提示】${body}\n\n你可以先對照題幹試一小步；若仍卡住，再按「需要提示」解鎖下一層。`;
}

export function bankRowToPracticeQuestion(row: QuestionBankRow): PracticeQuestion {
  const unitPill = unitPillFromTopic(row.topic);
  const stemLatex = splitQuestionStem(row.question_text ?? "");
  const hints = [row.hint1, row.hint2, row.hint3].filter(
    (h): h is string => typeof h === "string" && h.trim().length > 0,
  );
  const hintSteps = hints.map((h) => h.trim());
  const hintReplies = hints.map((h, i) => hintTutorLine(h, i, hints.length));

  const isMcq = row.type === "選擇題" || row.type?.toLowerCase() === "mcq";
  const kind: QuestionKind = isMcq ? "mcq" : "fill";

  if (kind === "mcq") {
    const options = (
      [
        ["A", row.option_a],
        ["B", row.option_b],
        ["C", row.option_c],
        ["D", row.option_d],
      ] as const
    )
      .filter(([, v]) => v != null && String(v).trim() !== "")
      .map(([key, latex]) => ({ key, latex: String(latex).trim() }));

    const ans = (row.answer ?? "").trim().toUpperCase();
    const correctKey = /^[ABCD]$/.test(ans) ? ans : "A";

    return {
      id: row.id,
      unitPill,
      typeLabel: "選擇題",
      kind: "mcq",
      topicTag: row.topic?.trim() || undefined,
      difficulty: row.difficulty ?? undefined,
      stemLatex,
      options: options.length ? options : [{ key: "A", latex: "—" }],
      correctKey,
      fillAnswer: null,
      hintSteps: hintSteps.length ? hintSteps : ["（本題尚未設定提示）"],
      hintReplies: hintReplies.length
        ? hintReplies
        : ["可先回頭讀題幹中的已知與所求。"],
      thoughtReply: buildThoughtReply(row, unitPill),
      explanation: row.explanation ?? undefined,
      commonMistakes: row.common_mistakes ?? undefined,
      embedText: row.embed_text ?? undefined,
      imageUrl: row.image_url,
      imagePosition: row.image_position,
    };
  }

  return {
    id: row.id,
    unitPill,
    typeLabel: "填空題",
    kind: "fill",
    topicTag: row.topic?.trim() || undefined,
    difficulty: row.difficulty ?? undefined,
    stemLatex,
    options: [],
    correctKey: "",
    fillAnswer: (row.answer ?? "").trim() || null,
    hintSteps: hintSteps.length ? hintSteps : ["（本題尚未設定提示）"],
    hintReplies: hintReplies.length
      ? hintReplies
      : ["可先回頭讀題幹中的已知與所求。"],
    thoughtReply: buildThoughtReply(row, unitPill),
    explanation: row.explanation ?? undefined,
    commonMistakes: row.common_mistakes ?? undefined,
    embedText: row.embed_text ?? undefined,
    imageUrl: row.image_url,
    imagePosition: row.image_position,
  };
}
