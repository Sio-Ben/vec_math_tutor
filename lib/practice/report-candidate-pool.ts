import type { ClientReport } from "@/lib/report-from-results";
import type { PracticeQuestion } from "@/lib/tutor/practice-questions";

const MIN_POOL = 4;

function levelNum(s: string | undefined): number {
  const t = (s ?? "L2").trim().toUpperCase();
  if (t.startsWith("L1")) return 1;
  if (t.startsWith("L3")) return 3;
  if (t.startsWith("L4")) return 4;
  return 2;
}

function inDifficultyBand(
  qDiff: string | undefined,
  rec: "L1" | "L2" | "L3" | "L4",
): boolean {
  const q = levelNum(qDiff);
  const r = levelNum(rec);
  return Math.abs(q - r) <= 1;
}

export function weakTopicTagsFromReport(r: ClientReport): string[] {
  return [
    ...new Set(
      r.weak_topics
        .map((w) => w.topic_tag?.trim())
        .filter((t): t is string => Boolean(t)),
    ),
  ];
}

/**
 * 依診斷報告組「練習候選池」：先弱項 topic，不足則依 recommended_start_level 難度帶補滿，再不足則納入其餘題（維持原陣列順序）。
 */
export function reportCandidatePool(
  questions: PracticeQuestion[],
  report: ClientReport,
): PracticeQuestion[] {
  const weakTags = weakTopicTagsFromReport(report);
  if (weakTags.length === 0) return [...questions];

  const want = new Set(weakTags);
  const poolIds = new Set<string>();

  for (const q of questions) {
    const tag = q.topicTag?.trim();
    if (tag && want.has(tag)) poolIds.add(q.id);
  }

  if (poolIds.size < MIN_POOL) {
    const rec = report.recommended_start_level;
    for (const q of questions) {
      if (!poolIds.has(q.id) && inDifficultyBand(q.difficulty, rec)) {
        poolIds.add(q.id);
      }
    }
  }

  if (poolIds.size < MIN_POOL) {
    for (const q of questions) {
      if (!poolIds.has(q.id)) poolIds.add(q.id);
    }
  }

  return questions.filter((q) => poolIds.has(q.id));
}
