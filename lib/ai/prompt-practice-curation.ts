/**
 * 練習題 AI：① 依診斷報告排序既有題目 ② 題庫不足時參考樣式生成新題（不必逐題抄 DB）。
 */

export const PRACTICE_ORDER_SYSTEM = `你只輸出一段合法 JSON 物件，不要 markdown、不要程式碼围栏、不要 JSON 以外文字。`;

export function buildPracticeOrderUser(input: {
  reportJson: string;
  masteryJson?: string;
  catalogJson: string;
  catalogIds: string[];
  targetCount: number;
}): string {
  return `你是澳門高中數學向量單元的題組編排助手。下面有一份「診斷掌握報告」以及目前題庫中可練習的題目清單（僅含 id、知識標籤、難度、題型、題幹摘要）。

===== 診斷報告（JSON）=====
${input.reportJson}

===== 總掌握摘要（JSON，可為 null）=====
${input.masteryJson ?? "null"}

===== 題目清單（JSON 陣列，每題一筆）=====
${input.catalogJson}

===== 題目 id 列表（與上表一致，供你核對）=====
${JSON.stringify(input.catalogIds)}

===== 本輪需輸出題數 =====
${input.targetCount}

===== 任務 =====
請輸出 JSON，格式嚴格如下：
{
  "selected_ids": ["題目id1", "題目id2", ...],
  "rationale": "用繁體中文簡短說明排序邏輯（給教學系統備查，不直接給學生看）"
}

規則：
1. selected_ids 僅可從「上面題目 id 列表」中挑選，不可新增不存在的 id，且不可重複。
2. selected_ids 長度必須等於「本輪需輸出題數」。
3. 請先遵循「總掌握摘要」的 recommendedTopicOrder / recommendedDifficulty；再參考診斷報告 weak_topics／recommended_start_level／mastery_score。弱項與建議難度對應題應優先入選；強項可稍後；題型可穿插避免單調。
4. 若候選清單少於本輪需輸出題數，selected_ids 請輸出候選清單全部 id（仍保持不重複），並在 rationale 說明不足情況。`;
}

export const PRACTICE_GENERATE_SYSTEM = `你只輸出一段合法 JSON 物件，不要 markdown、不要程式碼围栏。JSON 內須含鍵 "questions"，其值為陣列。`;

export function buildPracticeGenerateUser(input: {
  reportJson: string;
  masteryJson?: string;
  sampleRowsJson: string;
  ragContext?: string;
  weakTopicTags: string[];
  generateCount: number;
}): string {
  return `你是澳門高中數學向量單元的命題助手。下面有診斷報告、題庫中**少量範例題**（僅作風格與欄位參考，**不要**抄寫或只改數字複製成新題），以及需要補強的 topic 標籤。

===== 診斷報告（JSON）=====
${input.reportJson}

===== 總掌握摘要（JSON，可為 null）=====
${input.masteryJson ?? "null"}

===== 題庫範例（JSON 陣列，欄位結構請模仿；內容勿照抄）=====
${input.sampleRowsJson}

===== RAG 檢索片段（同主題題幹／講解，供命題參考；可為空）=====
${input.ragContext?.trim() || "（本輪未取回 RAG 片段；代表向量檢索／資料庫未回傳內容，請僅依診斷與範例結構命題）"}

===== 建議優先命題的 topic 標籤（向量題庫 topic 欄慣用英文 snake_case）=====
${JSON.stringify(input.weakTopicTags.length ? input.weakTopicTags : ["（請綜合報告自行推斷）"])}

===== 任務 =====
請新命 ${input.generateCount} 題**全新**練習題（情境、數字、敘述皆須原創），可混合選擇題與填空題。難度先遵循總掌握摘要中的 recommendedDifficulty（可到 L4），再呼應診斷報告。
若 generateCount >= 3，至少包含 2 題選擇題且至少 1 題填空題；若 generateCount < 3，至少要混入 1 題選擇題。

每題物件欄位須與題庫一致（方便系統匯入），使用下列鍵名（填空題無選項時 option_* 可為 null）：
- id：字串，唯一，建議 ai- 前綴加英文短碼與序號，例如 "ai-vec-001"
- type：選擇題 或 mcq 或 填空題 或 fill（選擇題須四選項時 type 用「選擇題」）
- difficulty：L1 / L2 / L3 / L4（L4 代表進階挑戰）
- topic：英文 topic 標籤，須與上方弱項之一對得上或合理延伸
- question_text：題幹，LaTeX 用 $...$ 包住式子
- option_a, option_b, option_c, option_d：選擇題必填（latex 片段，**不要加 $...$ 或 $$...$$ 包裹**）；填空題可全 null
- answer：選擇題為 A/B/C/D；填空題為可接受答案字串（允許簡短形式，請輸出數學答案本體，不要解釋句子）
- hint1, hint2, hint3：三層提示，由淺入深
- common_mistakes：一句常見迷思（可為 null）
- explanation：簡短講解要點（可為 null）
補充規則：
- 可參考 RAG 片段的知識點與錯誤型態，但題幹文字、數字、選項不可直接抄寫或僅做微幅替換。
- 題目要多樣化：盡量避免同一輪都用同一模板句型與同一計算套路。


輸出 JSON 格式：
{
  "questions": [ { ...一題一物件... } ],
  "design_note": "繁體中文，說明命題取向（系統用）"
}`;
}

export const PRACTICE_VALIDATE_SYSTEM = `你是嚴格的高中向量題品質審核器。你只輸出一段合法 JSON 物件，不要 markdown、不要程式碼围栏、不要額外文字。`;

export function buildPracticeValidateUser(input: {
  reportJson: string;
  masteryJson?: string;
  questionsJson: string;
}): string {
  return `請審核以下 AI 生成題，找出邏輯或答案問題，並僅回傳 JSON。

===== 診斷報告（JSON）=====
${input.reportJson}

===== 總掌握摘要（JSON，可為 null）=====
${input.masteryJson ?? "null"}

===== 待審核題目（JSON）=====
${input.questionsJson}

===== 審核規則 =====
1) 檢查選擇題 answer 是否與正確計算一致；若不一致標為 ANSWER_MISMATCH。
2) 檢查 option_a~d 是否有重複或等價敘述；若有標為 OPTIONS_DUPLICATE。
3) 檢查題幹條件與選項/答案是否互相矛盾；若有標為 STEM_OPTION_CONTRADICTION。
4) 檢查是否不可解、無實數解或答案不在選項中；若有標為 UNSOLVABLE_OR_NO_VALID_CHOICE。
5) 欄位缺漏或格式錯誤標為 FORMAT_INVALID。

輸出 JSON schema（嚴格）：
{
  "valid_questions": [ { ...原題物件... } ],
  "invalid": [
    { "id": "題目id", "reason_code": "ANSWER_MISMATCH|OPTIONS_DUPLICATE|STEM_OPTION_CONTRADICTION|UNSOLVABLE_OR_NO_VALID_CHOICE|FORMAT_INVALID", "reason_detail": "繁中簡述" }
  ],
  "summary": { "total": 0, "valid_count": 0, "invalid_count": 0 }
}

注意：
- valid_questions 必須是原輸入中被判定可用的完整題目物件，不可自行改寫。
- invalid 與 valid_questions 合計需覆蓋所有輸入題目（以 id 對應）。`;
}
