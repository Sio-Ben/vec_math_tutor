/** 診斷摘要（由練習頁從 session 讀取後帶上） */
export type TutorDiagnosticContext = {
  studentLevel: string;
  strongTopics: string[];
  weakTopics: string[];
  masteryScore: number;
};

export type TutorChatTurn = { role: "user" | "assistant"; content: string };

/** 前端 → API（可帶對話歷史、之後可帶 RAG 片段） */
export type TutorChatRequest = {
  questionId: string;
  thought: string;
  selectedChoice: string | null;
  /** 填空題時學生輸入（可選，供之後 LLM） */
  studentFillAnswer?: string | null;
  diagnosticContext?: TutorDiagnosticContext | null;
  /** 本題第幾次提交「你的思路」（從 1 起算） */
  attemptCount?: number;
  /** 已解鎖提示層數（1＝第 1 層原文已在「提示進度」顯示，以此類推；供後端還原畫面狀態） */
  hintsGiven?: number;
  maxAttemptsReached?: boolean;
  conversationHistory?: TutorChatTurn[];
};

/** API → 前端（visible 已截掉 UI_SIGNAL 區塊） */
export type TutorUiSignal = {
  /** 例：auto_reveal_hint（AI 主動揭露提示並同步「提示進度」） */
  action?: string;
  update_mastery?: boolean;
  mastery_delta?: number;
  topic_status?: { topic?: string; result?: string };
  /** -1 不解鎖；0..n 表示「提示進度」解鎖至該層（含） */
  hint_index_used?: number;
};

export type TutorReplySource = "deepseek" | "no_api_key" | "error";

export type TutorChatResponse = {
  assistantMessage: string;
  uiSignal?: TutorUiSignal | null;
  /** 本輪回覆是否來自模型（供前端提示設定金鑰或重試） */
  replySource?: TutorReplySource;
};

/** 單題完成後 AI 小結（POST /api/tutor/question-recap） */
export type QuestionRecapRequest = {
  questionId: string;
  questionStemPlain: string;
  topicLabel: string;
  kind: "mcq" | "fill";
  studentAnswerSummary: string;
  standardAnswerSummary: string;
  isCorrect: boolean;
  thoughtSummary: string;
  lastTutorReply: string | null;
  /** hintsThrough：-1 未解鎖，0 起為已解鎖最高層索引 */
  hintsUnlockedLayerMax: number;
};

export type QuestionRecapResponse = {
  recap: string | null;
  source: "deepseek" | "skipped" | "error";
};
