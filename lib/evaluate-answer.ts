import type { DiagnosticQuestion } from "./diagnostic-types";

export function isAnswerCorrect(
  q: DiagnosticQuestion,
  raw: string | undefined,
): boolean {
  if (raw == null || raw === "") return false;
  if (q.kind === "mcq" && q.correctKey) {
    return raw.trim().toUpperCase() === q.correctKey.toUpperCase();
  }
  if (q.kind === "fill" && q.matchFill) {
    return q.matchFill(raw);
  }
  return false;
}
