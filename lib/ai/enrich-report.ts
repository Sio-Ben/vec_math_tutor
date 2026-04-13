import type { QuestionOutcome } from "@/lib/diagnostic-types";
import type { ClientReport } from "@/lib/report-from-results";

/** 把診斷題 outcome 的 topicTag 盡量對回 AI 產生的 weak_topics（依題名比對） */
export function enrichReportTopicTags(
  report: ClientReport,
  results: QuestionOutcome[],
): ClientReport {
  const byTopic = new Map<string, string>();
  for (const r of results) {
    if (r.topicTag) byTopic.set(r.topic.trim(), r.topicTag);
  }
  return {
    ...report,
    weak_topics: report.weak_topics.map((w) => {
      if (w.topic_tag) return w;
      const tag = byTopic.get(w.topic.trim());
      if (tag) return { ...w, topic_tag: tag };
      const fuzzy = results.find(
        (r) => w.topic.includes(r.topic) || r.topic.includes(w.topic),
      );
      return { ...w, topic_tag: fuzzy?.topicTag ?? w.topic_tag };
    }),
  };
}
