import type { ClientReport } from "@/lib/report-from-results";
import type { DiagnosticSessionPayload } from "@/lib/diagnostic-types";

/** 單次練習紀錄（之後可同步到 Supabase） */
export type PracticeEvent = {
  questionId: string;
  topicTag?: string;
  at: string;
  /** 是否按過「下一題／完成」離開該題 */
  completed: boolean;
  /** 該題解鎖到的提示層級，0-based；-1 表示未開提示 */
  maxHintLayer: number;
  hadThoughtSubmit: boolean;
};

/** 診斷階段快照（與 sessionStorage 結構一致） */
export type DiagnosticBundle = {
  payload: DiagnosticSessionPayload;
  report: ClientReport;
};

/**
 * 動態掌握報告（隨練習次數累加更新）。
 * 正式文案由 LLM 依 `lib/ai/prompts/mastery-report.ts` 生成。
 */
export type MasteryReportV2 = {
  narrative: string;
  /** 各 topic 0–100，可為空物件 */
  topicScores: Record<string, number>;
  /** 建議下一輪練習的 topic 順序 */
  recommendedTopicOrder: string[];
  generatedAt: string;
  /** 產生時納入的練習事件筆數 */
  basedOnPracticeEventCount: number;
  /** 佔位：之後接真實模型版本號或 hash */
  modelNote?: string;
};

export type MasteryReportRequestBody = {
  diagnostic: DiagnosticBundle | null;
  practiceEvents: PracticeEvent[];
  previousReport?: MasteryReportV2 | null;
};
