export type Level = "L1" | "L2" | "L3";
export type QuestionKind = "mcq" | "fill";

export type StemPart =
  | { type: "text"; value: string }
  | { type: "math"; latex: string };

export interface McqOption {
  key: string;
  latex: string;
}

export interface DiagnosticQuestion {
  id: number;
  topic: string;
  topicTag: string;
  level: Level;
  kind: QuestionKind;
  stem: StemPart[];
  options?: McqOption[];
  /** MCQ: e.g. "C" */
  correctKey?: string;
  /** fill: returns true if student answer is acceptable */
  matchFill?: (raw: string) => boolean;
  fillPlaceholder?: string;
  fillRows?: number;
}

export interface QuestionOutcome {
  q: number;
  topic: string;
  /** 與題庫 `vector_questions.topic` 對齊，供推薦排序 */
  topicTag?: string;
  level: Level;
  correct: boolean;
  timeSeconds: number;
}

export interface DiagnosticSessionPayload {
  results: QuestionOutcome[];
  totalTimeSeconds: number;
  submittedAt: string;
}

export const DIAGNOSTIC_STORAGE_KEY = "vector-tutor:diagnostic-session";

const LEVEL_WEIGHT: Record<Level, number> = { L1: 1, L2: 2, L3: 3 };

export function masteryPercentFromResults(
  results: Pick<QuestionOutcome, "level" | "correct">[],
): number {
  let earned = 0;
  let total = 0;
  for (const r of results) {
    const w = LEVEL_WEIGHT[r.level];
    total += w;
    if (r.correct) earned += w;
  }
  if (total === 0) return 0;
  return Math.round((earned / total) * 100);
}

export function inferOverallLevel(
  mastery: number,
  results: Pick<QuestionOutcome, "level" | "correct">[],
): Level {
  const l1 = results.filter((r) => r.level === "L1");
  const l1Wrong = l1.filter((r) => !r.correct).length;
  if (l1Wrong >= 2) return "L1";
  if (mastery >= 85) return "L3";
  if (mastery >= 55) return "L2";
  return "L1";
}

export function recommendedStartLevel(overall: Level, mastery: number): Level {
  if (overall === "L3" && mastery >= 90) return "L3";
  if (overall === "L2" || mastery >= 65) return "L2";
  return "L1";
}
