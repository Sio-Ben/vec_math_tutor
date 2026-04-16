import type { BatchQuestionResult } from "@/lib/tutor/types";

export const BATCH_REPORT_SYSTEM = `你是澳門高中向量單元的學習分析助教。只輸出合法 JSON 物件，不要 markdown、不要程式碼區塊、不要其他文字。`;

export function buildBatchReportUser(input: {
  batchIndex: number;
  results: BatchQuestionResult[];
  attemptsSummary?: {
    total: number;
    mcqTotal: number;
    fillTotal: number;
    aiTotal: number;
    thoughtSubmitted: number;
    hintUsed: number;
  };
}): string {
  return `下面是學生在第 ${input.batchIndex + 1} 組（5題）練習的作答結果 JSON：
${JSON.stringify(input.results)}

===== 本組作答結構摘要（JSON）=====
${JSON.stringify(input.attemptsSummary ?? null)}

請輸出 JSON，格式必須為：
{
  "summary": "繁體中文，120~220字，須包含：整體表現、題型表現、策略建議",
  "weak_topics": ["topic_tag1", "topic_tag2"],
  "next_topic_suggestions": ["topic_tag1", "topic_tag2", "topic_tag3"],
  "difficulty_advice": "up 或 keep 或 down",
  "recommended_level": "L1 或 L2 或 L3 或 L4"
}

規則：
1. weak_topics / next_topic_suggestions 盡量用英文 snake_case topic tag。
2. 若資訊不足，difficulty_advice 用 keep。
3. summary 必須專注學生表現與學習策略，禁止提及「題庫、資料庫、資料量、樣本不足、系統限制、現有資料、資料不足、無法判斷、無法識別弱點」。
4. 即使本組幾乎全對，也要給具體可執行的下一步（例如提高題型跨度、速度、證明嚴謹度），不要寫「無法判斷／無法識別」。
5. recommended_level：依表現建議下一組練習等級；若表現明顯超出 L3，可給 L4。
6. 嚴禁輸出 JSON 以外內容。`;
}
