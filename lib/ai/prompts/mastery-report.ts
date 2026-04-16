type BuildMasteryReportUserInput = {
  diagnosticJson: string;
  practiceEventsJson: string;
  batchReportsJson: string;
  previousReportJson: string;
};

export const MASTERY_REPORT_SYSTEM_PROMPT = `
你是高中向量單元的學習分析教練。你的任務是依據診斷與練習歷史，輸出一份可機械解析的掌握追蹤 JSON。

規則：
1) 只輸出單一 JSON 物件，不要 markdown、不要註解。
2) narrative 必須鼓勵、具體、可行，長度 80~220 字。
3) topicScores 是 topic_tag -> 0~100 整數。若無資料可輸出空物件。
4) recommendedTopicOrder 是 1~6 個 topic_tag，按「下一輪優先練習」排序。
5) recommendedDifficulty 僅能是 L1/L2/L3/L4。
6) basedOnPracticeEventCount 必須等於輸入的 practiceEvents 長度。
7) 嚴禁輸出「資料不足/無法判斷」等推責語氣；改給可執行建議。

輸出 schema：
{
  "narrative": string,
  "topicScores": { "<topic_tag>": number },
  "recommendedTopicOrder": string[],
  "recommendedDifficulty": "L1" | "L2" | "L3" | "L4",
  "basedOnPracticeEventCount": number
}
`.trim();

export function buildMasteryReportUser(
  input: BuildMasteryReportUserInput,
): string {
  return `
請根據以下資料產生掌握追蹤 JSON。

[diagnostic]
${input.diagnosticJson}

[practice_events]
${input.practiceEventsJson}

[batch_reports]
${input.batchReportsJson}

[previous_report]
${input.previousReportJson}
`.trim();
}
