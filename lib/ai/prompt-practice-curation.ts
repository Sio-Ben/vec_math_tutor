/**
 * 練習題 AI：① 依診斷報告排序既有題目 ② 題庫不足時參考樣式生成新題（不必逐題抄 DB）。
 */

export const PRACTICE_ORDER_SYSTEM = `你只輸出一段合法 JSON 物件，不要 markdown、不要程式碼围栏、不要 JSON 以外文字。`;

export function buildPracticeOrderUser(input: {
  reportJson: string;
  masteryJson?: string;
  catalogJson: string;
  catalogIds: string[];
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

===== 任務 =====
請輸出 JSON，格式嚴格如下：
{
  "ordered_ids": ["題目id1", "題目id2", ...],
  "rationale": "用繁體中文簡短說明排序邏輯（給教學系統備查，不直接給學生看）"
}

規則：
1. ordered_ids 必須是「上面題目 id 列表」的**排列**：每個 id 恰好出現一次，不可新增不存在的 id、不可漏 id。
2. 排序優先：先遵循「總掌握摘要」的 recommendedTopicOrder / recommendedDifficulty；再參考診斷報告 weak_topics／recommended_start_level／mastery_score。弱項與建議難度對應題應靠前；強項可稍後；題型可穿插避免單調。
3. 若清單僅 1 題，ordered_ids 長度仍為 1。`;
}

export const PRACTICE_GENERATE_SYSTEM = `你只輸出一段合法 JSON 物件，不要 markdown、不要程式碼围栏。JSON 內須含鍵 "questions"，其值為陣列。

【正確性優先（必須遵守，且不增加輸出欄位）】
1) 每題在寫入 JSON 前，必須在內心完成獨立驗算；選擇題的 answer 所指選項必須與驗算結果完全一致。
2) 選擇題四個選項內容須互不相同；錯誤選項須合理但數值上必錯。
3) 凡含參數（如 k）與模長/方程式：先化簡再解；若得到無理根或非題幹所暗示的數字型態，必須改寫題幹或數字，使答案落在選項中且可驗證（優先使用整數或常見勾股數組合）。
4) RAG 片段僅供概念與錯因參考，不得假設其數值正確；最終以自行驗算為準。`;

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

【選擇題自檢流程（每題必做，勿寫進 JSON）】
- 步驟 A：依題幹列出方程式（例如 $\\vec{c}=\\vec{a}+k\\vec{b}$ 則寫出分量、再寫 $|\\vec{c}|^2=\\cdots$）。
- 步驟 B：解出未知數（可能為一元二次）；檢查判別式與根是否為實數、是否與題意一致。
- 步驟 C：將根逐一代入檢查模長/方程式是否成立；確認與且僅與 answer 對應的選項一致。
- 若任一步與四個選項皆不符：禁止硬選答案；應改寫題幹或選項數字直到步驟 C 成立。
- 避免「可能值為」且選項為多組整數 OR 的題型，除非已對每一組完成步驟 C 驗證；不確定時改為單一答案或改填空題。


輸出 JSON 格式：
{
  "questions": [ { ...一題一物件... } ],
  "design_note": "繁體中文，說明命題取向（系統用）"
}`;
}
