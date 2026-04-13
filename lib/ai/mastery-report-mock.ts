import type { MasteryReportRequestBody, MasteryReportV2 } from "@/lib/progress/types";

/** 未接 LLM 時的示範輸出；之後改為解析模型 JSON。 */
export function mockMasteryReportV2(body: MasteryReportRequestBody): MasteryReportV2 {
  const n = body.practiceEvents.length;
  const weak =
    body.diagnostic?.report.weak_topics
      ?.map((w) => w.topic_tag)
      .filter((t): t is string => Boolean(t && String(t).trim())) ?? [];

  const narrative =
    `【示範框架】目前已累積 **${n}** 筆練習紀錄。` +
    (body.diagnostic
      ? ` 診斷整體層級為 **${body.diagnostic.report.overall_level}**（掌握分 ${body.diagnostic.report.mastery_score}）。`
      : " 尚未偵測到診斷資料，建議先完成診斷問卷。") +
    (weak.length
      ? ` 依診斷弱項標籤：${weak.join("、")}，建議優先混排相關題型。`
      : "") +
    " 接上 LLM 後，本段將改為模型依你的 prompt 產生的完整分析與鼓勵語氣敘述。";

  const topicScores: Record<string, number> = {};
  for (const ev of body.practiceEvents) {
    const t = ev.topicTag?.trim();
    if (!t) continue;
    topicScores[t] = Math.min(100, (topicScores[t] ?? 50) + 3);
  }

  const recommendedTopicOrder = [
    ...new Set([...weak, ...Object.keys(topicScores)]),
  ];

  return {
    narrative,
    topicScores,
    recommendedTopicOrder,
    generatedAt: new Date().toISOString(),
    basedOnPracticeEventCount: n,
    modelNote: "mock_v0",
  };
}
