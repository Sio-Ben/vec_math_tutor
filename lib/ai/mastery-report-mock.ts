import type { MasteryReportRequestBody, MasteryReportV2 } from "@/lib/progress/types";

/** 未接 LLM 時的示範輸出；之後改為解析模型 JSON。 */
export function mockMasteryReportV2(body: MasteryReportRequestBody): MasteryReportV2 {
  const n = body.practiceEvents.length;
  const batches = body.batchReports ?? [];
  const weak =
    body.diagnostic?.report.weak_topics
      ?.map((w) => w.topic_tag)
      .filter((t): t is string => Boolean(t && String(t).trim())) ?? [];

  const narrative =
    `【示範框架】目前已累積 **${n}** 筆練習紀錄。` +
    (batches.length > 0 ? ` 已完成 **${batches.length}** 組 5 題小結。` : "") +
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
  const levels = ["L1", "L2", "L3", "L4"] as const;
  type Level = (typeof levels)[number];
  const prev = body.previousReport?.recommendedDifficulty;
  const diagnosticLevel = body.diagnostic?.report.overall_level;
  const baseLevel: Level =
    prev === "L1" || prev === "L2" || prev === "L3" || prev === "L4"
      ? prev
      : diagnosticLevel === "L1" ||
          diagnosticLevel === "L2" ||
          diagnosticLevel === "L3" ||
          diagnosticLevel === "L4"
        ? diagnosticLevel
        : "L2";
  const latestAdvice = batches[batches.length - 1]?.difficultyAdvice;
  const lastTwoDown =
    batches.length >= 2 &&
    batches[batches.length - 1]?.difficultyAdvice === "down" &&
    batches[batches.length - 2]?.difficultyAdvice === "down";
  const idx = levels.indexOf(baseLevel);
  let recommendedDifficulty: Level = baseLevel;
  if (latestAdvice === "up") {
    recommendedDifficulty = levels[Math.min(levels.length - 1, idx + 1)];
  } else if (latestAdvice === "down" && lastTwoDown) {
    recommendedDifficulty = levels[Math.max(0, idx - 1)];
  }

  return {
    narrative,
    topicScores,
    recommendedTopicOrder,
    generatedAt: new Date().toISOString(),
    basedOnPracticeEventCount: n,
    modelNote: "mock_v0",
    recommendedDifficulty,
  };
}
