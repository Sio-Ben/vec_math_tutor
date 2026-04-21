import { loadQuestionByIdFromDb } from "@/lib/tutor/load-questions";
import {
  PRACTICE_QUESTIONS,
  type PracticeQuestion,
  type QuestionKind,
  type StemSeg,
} from "@/lib/tutor/practice-questions";

function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t : null;
}

function parseStemSeg(x: unknown): StemSeg | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  if (o.t === "text" && typeof o.v === "string") return { t: "text", v: o.v };
  if (o.t === "math" && typeof o.m === "string") return { t: "math", m: o.m };
  return null;
}

function parseKind(v: unknown): QuestionKind | null {
  const s = str(v);
  if (s === "mcq" || s === "fill") return s;
  return null;
}

/**
 * 驗證前端附上的題目快照（未入庫的 AI 題等）。通過則回傳乾淨物件。
 * `expectedId` 必須與快照內 `id` 一致，避免誤用他題。
 */
export function parseInlinePracticeQuestion(
  raw: unknown,
  expectedId: string,
): PracticeQuestion | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = str(o.id);
  if (!id || id !== expectedId.trim()) return null;

  const kind = parseKind(o.kind);
  if (!kind) return null;

  const unitPill = str(o.unitPill) ?? "向量";
  const typeLabel = str(o.typeLabel) ?? (kind === "mcq" ? "選擇題" : "填空題");
  const difficulty = str(o.difficulty) ?? undefined;
  const topicTag = str(o.topicTag) ?? undefined;
  const source = o.source === "ai" || o.source === "bank" ? o.source : undefined;

  if (!Array.isArray(o.stemLatex) || o.stemLatex.length === 0) return null;
  const stemLatex: StemSeg[] = [];
  for (const seg of o.stemLatex) {
    const p = parseStemSeg(seg);
    if (!p) return null;
    stemLatex.push(p);
  }

  let options: { key: string; latex: string }[] = [];
  let correctKey = "";
  let fillAnswer: string | null = null;

  if (kind === "mcq") {
    if (!Array.isArray(o.options) || o.options.length === 0) return null;
    for (const opt of o.options) {
      if (!opt || typeof opt !== "object") return null;
      const r = opt as Record<string, unknown>;
      const key = str(r.key)?.toUpperCase();
      const latex = str(r.latex);
      if (!key || !/^[ABCD]$/.test(key) || latex == null) return null;
      options.push({ key, latex });
    }
    const ck = str(o.correctKey)?.toUpperCase();
    if (!ck || !/^[ABCD]$/.test(ck)) return null;
    correctKey = ck;
  } else {
    fillAnswer = str(o.fillAnswer);
    if (fillAnswer == null) return null;
  }

  if (!Array.isArray(o.hintSteps)) return null;
  let hintSteps = o.hintSteps
    .map((h) => (typeof h === "string" ? h.trim() : ""))
    .filter((h) => h.length > 0);
  if (hintSteps.length === 0) {
    hintSteps = ["（本題尚未設定提示）"];
  }

  let hintReplies: string[] = [];
  if (Array.isArray(o.hintReplies)) {
    hintReplies = o.hintReplies
      .map((h) => (typeof h === "string" ? h.trim() : ""))
      .filter((h) => h.length > 0);
  }
  while (hintReplies.length < hintSteps.length) {
    hintReplies.push("可先回頭讀題幹中的已知與所求。");
  }
  if (hintReplies.length > hintSteps.length) {
    hintReplies = hintReplies.slice(0, hintSteps.length);
  }

  const thoughtReply =
    str(o.thoughtReply) ?? "謝謝你寫下想法。我們先不急著對答案——你覺得自己卡在哪一步？";

  const out: PracticeQuestion = {
    id,
    source,
    unitPill,
    typeLabel,
    kind,
    stemLatex,
    options: kind === "mcq" ? options : [],
    correctKey: kind === "mcq" ? correctKey : "",
    fillAnswer: kind === "fill" ? fillAnswer : null,
    difficulty,
    topicTag,
    hintSteps,
    hintReplies,
    thoughtReply,
    explanation: str(o.explanation) ?? undefined,
    commonMistakes: str(o.commonMistakes) ?? undefined,
    embedText: str(o.embedText) ?? undefined,
    imageUrl: str(o.imageUrl) ?? undefined,
    imagePosition: str(o.imagePosition) ?? undefined,
  };

  return out;
}

/**
 * 題庫 id：先 DB、再靜態示範題；皆無則採用可選的 `inline` 快照（須與 id 對齊）。
 */
export async function resolvePracticeQuestion(
  questionId: string,
  inline: unknown,
): Promise<PracticeQuestion | null> {
  const id = questionId?.trim();
  if (!id) return null;

  const fromDb = await loadQuestionByIdFromDb(id);
  if (fromDb) return fromDb;

  const fromStatic = PRACTICE_QUESTIONS.find((q) => q.id === id);
  if (fromStatic) return fromStatic;

  return parseInlinePracticeQuestion(inline, id);
}
