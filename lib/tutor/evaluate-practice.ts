import type { PracticeQuestion } from "@/lib/tutor/practice-questions";
import { fillAnswersEquivalent } from "@/lib/tutor/fill-answer-equivalence";

function norm(s: string): string {
  return s.replace(/\s+/g, "").toLowerCase();
}

export function isPracticeAnswerCorrect(
  q: PracticeQuestion,
  selectedChoice: string | null,
  studentFillAnswer: string | null | undefined,
): boolean {
  if (q.kind === "mcq") {
    return (
      (selectedChoice ?? "").trim().toUpperCase() ===
      q.correctKey.trim().toUpperCase()
    );
  }
  const ans = (studentFillAnswer ?? "").trim();
  const expected = (q.fillAnswer ?? "").trim();
  if (!expected) return false;
  if (norm(ans) === norm(expected)) return true;
  return fillAnswersEquivalent(ans, expected);
}
