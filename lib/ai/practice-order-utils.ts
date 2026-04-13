import type { PracticeQuestion } from "@/lib/tutor/practice-questions";

/** 依模型回傳的 id 順序重排；未知 id 接在原序之末 */
export function reorderQuestionsByIds(
  questions: PracticeQuestion[],
  orderedIds: string[],
): PracticeQuestion[] {
  const map = new Map(questions.map((q) => [q.id, q]));
  const out: PracticeQuestion[] = [];
  const seen = new Set<string>();
  for (const id of orderedIds) {
    const q = map.get(id);
    if (q && !seen.has(id)) {
      out.push(q);
      seen.add(id);
    }
  }
  for (const q of questions) {
    if (!seen.has(q.id)) out.push(q);
  }
  return out;
}
