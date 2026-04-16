import { DIAGNOSTIC_STORAGE_KEY } from "@/lib/diagnostic-types";
import type { PracticeQuestion } from "@/lib/tutor/practice-questions";
import type { BatchQuestionAttempt, TutorChatTurn } from "@/lib/tutor/types";

export type PracticeSessionSnapshot = {
  v: 2;
  fingerprint: string;
  questions: PracticeQuestion[];
  questionIndex: number;
  currentBatchId: string;
  currentBatchIndex?: number;
  batchAttempts: BatchQuestionAttempt[];
  finished: boolean;
  loadNote: string | null;
  selected: string | null;
  fillInput: string;
  thought: string;
  tutorVisible: boolean;
  tutorText: string;
  hintsThrough: number;
  hintPanelVisible: boolean;
  thoughtSubmitCount: number;
  tutorTurns: TutorChatTurn[];
};

function djb2(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
  }
  return h >>> 0;
}

/** 診斷 raw + 弱項排序 + 總掌握摘要 任一變動即視為新 session，不重吃舊快取 */
export function buildPracticeSessionFingerprint(
  prioritizeTags: string[],
  masteryJson: string,
): string {
  if (typeof window === "undefined") return "";
  const diagRaw = sessionStorage.getItem(DIAGNOSTIC_STORAGE_KEY) ?? "";
  return `${prioritizeTags.join(",")}|${djb2(diagRaw)}|${djb2(masteryJson)}`;
}

export function readPracticeSession(
  storageKey: string,
  fingerprint: string,
): PracticeSessionSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return null;
    const snap = JSON.parse(raw) as PracticeSessionSnapshot;
    if (snap?.v !== 2 || snap.fingerprint !== fingerprint) return null;
    if (!Array.isArray(snap.questions) || snap.questions.length === 0) return null;
    return snap;
  } catch {
    return null;
  }
}

export function writePracticeSession(
  storageKey: string,
  snap: PracticeSessionSnapshot,
): void {
  try {
    sessionStorage.setItem(storageKey, JSON.stringify(snap));
  } catch {
    /* ignore quota */
  }
}

export function clearPracticeSession(storageKey: string): void {
  try {
    sessionStorage.removeItem(storageKey);
  } catch {
    /* ignore */
  }
}
