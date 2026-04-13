import type { QuestionRecapRequest } from "@/lib/tutor/types";

export const QUESTION_RECAP_SYSTEM = `你是高中數學向量單元導師。請用繁體中文寫一段精簡的「本題小結」（約 4～8 句，或精簡條列），語氣溫和、第二人稱「你」。
必須涵蓋：這題在考什麼（一句）；學生寫了／選了什麼與思路；是否到位或偏在哪；往後值得鞏固的一個重點或易錯點。
勿冗長重講完整解題；總長以 220 字內為宜。數學式用行內 LaTeX $...$。不要輸出 JSON 或程式碼围栏。`;

export function buildQuestionRecapUser(input: QuestionRecapRequest): string {
  const thought = input.thoughtSummary?.trim() || "（未填寫）";
  const tutor = input.lastTutorReply?.trim() || "（無）";
  const judge = input.isCorrect ? "正確（含填空在格式寬鬆比對下視為等价）" : "未達標或未選對";
  return `題幹要點（LaTeX 混排）：
${input.questionStemPlain}

知識向度：${input.topicLabel}
題型：${input.kind}
學生最終作答：${input.studentAnswerSummary}
標準參考（內部對照用，勿整段抄給學生當標準答案展示）：${input.standardAnswerSummary}
系統判斷：${judge}

學生在「你的思路」欄的內容：
${thought}

上一則導師回覆（若有）：
${tutor}

已解鎖提示最高層索引（-1 表示未開提示；否則為 0-based 最高層）：${input.hintsUnlockedLayerMax}

請直接輸出「本題小結」正文。`;
}
