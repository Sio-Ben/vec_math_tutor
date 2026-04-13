/** Prompt A — 診斷問卷後掌握度分析（與設計稿一致） */

export const PROMPT_A_SYSTEM = `你只輸出一段合法 JSON 物件，不要 markdown、不要程式碼围栏、不要任何 JSON 以外文字。`;

export function buildPromptAUser(input: {
  studentId: string;
  totalTimeSeconds: number;
  questionResultsJson: string;
}): string {
  return `你是一位澳門高中數學向量單元的資深教師助手。
學生剛完成了一份 8 題的初始診斷問卷，請根據作答結果分析其掌握程度。

===== 學生作答資料 =====
學生ID：${input.studentId}
作答時間：${input.totalTimeSeconds} 秒

題目結果（每題：題號 | 知識點 | 知識點標籤 | 難度 | 是否正確 | 耗時秒數；「知識點標籤」對應題庫與練習排序用的 topic 代碼，無則留空）：
${input.questionResultsJson}

===== 你的任務 =====
請生成一份 JSON 格式的掌握度分析報告，格式嚴格如下，不要輸出任何其他內容：

{
  "overall_level": "L1" | "L2" | "L3",
  "mastery_score": <0-100的整數，基於正確率與難度加權>,
  "strong_topics": [
    { "topic": "知識點名稱", "evidence": "一句話說明為什麼認為掌握好" }
  ],
  "weak_topics": [
    { "topic": "向量的模", "gap": "……", "topic_tag": "vec_magnitude" }
  ],
  "recommended_start_level": "L1" | "L2" | "L3",
  "student_summary": "用第二人稱（你）、溫和鼓勵的語氣，2-3句話向學生說明其目前狀況，不要說「根據分析」，要像老師跟學生說話。語言：繁體中文。",
  "teacher_note": "給系統後端的內部備注（英文），說明初始難度設置建議和需要重點關注的知識點，不展示給學生。"
}

難度加權規則：L1 題答對得 1 分，L2 答對得 2 分，L3 答對得 3 分。
總分 = Σ(答對題加權分) / Σ(所有題加權分) × 100，取整。

補充：weak_topics 的 topic 應與學生資料「知識點」欄一致；topic_tag 僅在該題列的「知識點標籤」非空時填入且須逐字相同，供系統對齊題庫 topic 欄，否則省略 topic_tag。`;
}
