/**
 * 掌握程度報告（隨練習累積更新）— 系統／使用者提示詞預留。
 * 之後你提供完整 prompt 時，把主要內容放在此常數，並在
 * `app/api/mastery/report/route.ts` 內組進 Anthropic 呼叫。
 */
export const MASTERY_REPORT_SYSTEM_PROMPT_PLACEHOLDER = `TODO: 在此貼上「動態掌握報告」的系統提示詞（繁中、輸出 JSON 或 Markdown 等格式約定）。`;

export const MASTERY_REPORT_USER_PROMPT_TEMPLATE_PLACEHOLDER = `TODO: 使用者訊息模板（注入診斷摘要、練習事件列表、上一版報告等）。`;
