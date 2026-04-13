import type { PracticeQuestion } from "@/lib/tutor/practice-questions";

/**
 * 將 weak topic 標籤對應的題目排到前面（同組內維持原本順序）。
 */
export function prioritizeQuestionsByTopicTags(
  questions: PracticeQuestion[],
  weakTopicTags: string[],
): PracticeQuestion[] {
  const want = new Set(weakTopicTags.filter(Boolean));
  if (want.size === 0) return [...questions];

  const primary: PracticeQuestion[] = [];
  const rest: PracticeQuestion[] = [];
  for (const q of questions) {
    const tag = q.topicTag?.trim();
    if (tag && want.has(tag)) primary.push(q);
    else rest.push(q);
  }
  return [...primary, ...rest];
}
