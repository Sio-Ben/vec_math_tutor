# AI 向量教學助手（Math Tutor · 平面向量）

面向**澳門高中數學「平面向量」單元**的智能輔學 Web 應用：結合診斷問卷、結構化題庫練習、**蘇格拉底式（Socratic）**對話引導、掌握度視覺化與可選的 **RAG（檢索增強生成）**。本專案可作為畢業設計／學位論文的**系統實作章節**與**技術路線說明**；以下內容亦對齊作者《開題報告》中的研究邊界、創新點與論文骨架，並補充**實際落地後**的技術決策與迭代經驗。

---

## 一、專案定位與研究問題

### 1.1 教學場景

- **課程邊界**：高中平面向量（運算、模長、數量積、垂直／共線、幾何表達、綜合應用等），題目與用語貼近本地教學敘述。
- **學習痛點**：向量同時涉及**幾何直觀**與**代數演算**，學生常出現「步驟跳太快」「只記公式不理解」或「多步驗算錯一處全盤皆錯」等問題。
- **設計假設**：以 LLM 的語言推理與對話能力，提供**一對一、可負擔成本**的練習與引導；**不取代**教師課堂，而是作為課後鞏固與診斷輔具。

### 1.2 核心研究／工程問題（可寫入論文「問題陳述」）

1. 如何將「診斷結果 + 練習行為」轉成**可解釋、可追蹤**的推薦與回饋？
2. 如何在**延遲與成本可控**的前提下，降低 **AI 生成題**的錯題率（答案錯、選項重複、題幹矛盾）？
3. 如何避免 Socratic 引導流於「模板化問句」，並在學生**已答對**或**思路已涵蓋某層提示**時，減少無效重複？
4. 如何在小規模題庫與有限基礎設施下，實作 **RAG 降級策略**（向量檢索不可用時仍可運作）？

### 1.3 名詞與縮寫（論文「術語表」可重用）

| 術語 | 說明 |
|------|------|
| **LLM** | Large Language Model；本專案主線為 DeepSeek Chat Completions。 |
| **ITS** | Intelligent Tutoring System。 |
| **RAG** | Retrieval-Augmented Generation；本專案以 Supabase 題庫列為知識來源。 |
| **Socratic** | 蘇格拉底式教學：以問句鷹架取代直接給答案。 |
| **ClientReport** | 診斷後結構化報告（強弱項、建議起點難度等），見 `lib/report-from-results.ts` 與 AI 合併邏輯。 |
| **AGC** | AI-Generated Content；此處主要指 AI 補題與 AI 文字回饋。 |
| **UI_SIGNAL** | 模型回覆末段之 JSON，驅動前端按鈕與掌握度增量。 |

---

## 二、系統功能總覽（產品視角）

| 模組 | 路徑／入口 | 說明 |
|------|------------|------|
| 首頁導覽 | `/` | 說明問卷、報告、練習引導三階段流程。 |
| 診斷問卷 | `/diagnostic` | **8 題**混合難度（L1–L3），記錄正誤、耗時、知識標籤。 |
| 診斷報告 | `/diagnostic/report` | 呼叫 `/api/diagnostic/analyze`，產出結構化 **ClientReport**（強弱項、建議起點難度、摘要）。 |
| 練習與引導 | `/practice` | 題目區 +「向量老師」對話；支援 MCQ／填空、**MathLive** 輸入、**KaTeX** 渲染；批次完成後可產生小結。 |
| 練習批次報告 | `/practice/report` | 展示單批練習回饋（含答對與思路分欄等 UI 設計）。 |
| 掌握儀表板 | `/mastery` | 讀取 session 內診斷／練習事件／批次報告，呼叫 `/api/mastery/report`，以**雷達圖 + 分級卡片 + 趨勢**呈現。 |

### 2.1 學習閉環（論文可畫「流程圖」）

```text
診斷（8 題）→ ClientReport 入 session
        ↓
練習題組（AI 編序 + 必要時 AI 補題）→ 單題 Socratic 對話（可帶 RAG）
        ↓
批次完成 → 批次 AI 小結（答案回饋 + 思路回饋）
        ↓
累積事件 → 總掌握報告（DeepSeek JSON）→ 儀表板視覺化
```

### 2.2 與《開題報告》的對應關係

開題報告中強調的：**本地課程邊界**、**Socratic 引導**、**動態個性化閉環**、**AGC 與前端數學渲染整合**、**低成本可複製原型**，在本 repo 中均有對應實作。實作階段另補充了：**雙階段命題（生成 + 驗題）**、**全鏈路 AI Trace**、**以程式推斷解鎖提示層級**等工程創新，可作為論文「實作深化」小節。

### 2.3 各模組使用者視角與資料流（寫論文「用例」可用）

- **診斷（`/diagnostic`）**  
  前端依 `lib/diagnostic-data.ts` 出題；提交後將結果 JSON 存 `sessionStorage`，再導向報告頁呼叫 `POST /api/diagnostic/analyze`。若設定了 DeepSeek：先對**填空題**做第二意見複核（見附錄 A.2），再以 **Prompt A** 產出 `ClientReport`；後端另以 `mergeAiClientReport`、`reconcileReportTopics`、`enrichReportTopicTags` 等做結構校驗與 topic 對齊，降低模型幻覺對欄位的破壞。

- **練習（`/practice`）**  
  `GET /api/practice/questions` 拉題；必要時 `POST /api/practice/ai-curation` 依診斷／掌握摘要**重排**並**補 AI 題**（雙階段）。學生於單題可：選 MCQ、以 MathLive 填寫、開啟題庫提示層、在「你的思路」欄多次提交短句。每次導師回合呼叫 `POST /api/tutor/chat`，後端可併行 `retrieveRagContext` 注入 RAG。完成 5 題觸發 `POST /api/practice/batch-report`；單題結束亦可選 `question-recap`。

- **掌握（`/mastery`）**  
  匯總 session 內診斷、練習事件、歷史批次報告與上一版總報告，呼叫 `POST /api/mastery/report`；回傳之 `topicScores`、`recommendedTopicOrder`、`recommendedDifficulty` 驅動雷達圖與卡片 UI。

### 2.4 非 LLM 的規則式元件（論文「混合式系統」論點）

以下降低純端到端 LLM 風險，宜在論文中與「純聊天教練」對照：

- **作答判定**：`lib/tutor/evaluate-practice.ts`、`lib/evaluate-answer.ts`、`lib/tutor/fill-answer-equivalence.ts` 等，對 MCQ／填空做確定性比對。  
- **診斷加權分**：`lib/report-from-results.ts` 之 `masteryPercentFromResults` 與等級推論，作為 **Prompt A** 的 fallback 與合併基準。  
- **批次報告本地 fallback**：`batch-report/route.ts` 內 `fallbackSummary`、`thoughtFeedbackForAttempt` 等，API 失敗時仍可回傳合理文字。  
- **題庫列強制約束**：`coerce-llm-question-bank.ts` 將模型輸出轉成內部 row 型別，再經 `bankRowToPracticeQuestion` 映射為 `PracticeQuestion`。

---

## 三、技術棧與架構

### 3.1 前端

- **Next.js** `16.x`（App Router）、**React** `19.x`、**TypeScript**
- **Tailwind CSS** `4.x`
- **KaTeX**（`react-katex`）顯示靜態 LaTeX
- **MathLive** 作為填空／數學輸入元件

### 3.2 後端（同倉庫 API Routes）

- **Route Handlers**：`app/api/**/route.ts`（`runtime = "nodejs"` 為主）
- **LLM**：**DeepSeek** OpenAI 相容 **Chat Completions**（`lib/ai/deepseek.ts`）
- **JSON 輸出**：多處使用 `response_format: json_object`，並以 `parseJsonFromModelText` 做容錯解析

### 3.3 資料與 RAG

- **Supabase**（`@supabase/supabase-js`）：題庫表（預設 `vector_questions` 可透過環境變數覆寫）
- **Embeddings**：`lib/rag/embedding.ts`（預設 OpenAI embeddings，可切換 provider）
- **檢索**：`lib/rag/retrieve-context.ts`
  - 優先：**同 topic 結構化取樣**（小題庫友善）
  - 其次：**向量 RPC** `match_vector_questions`（若已建索引且 embedding 可用）
  - 最後：**ILIKE 文字後備**

### 3.4 客戶端狀態（無登入原型）

- 以 **`sessionStorage`** 保存診斷 bundle、練習事件、批次報告、掌握報告 v2、練習 session 等（鍵名見 `lib/progress/storage-keys.ts`）。
- 論文可討論：**隱私與資料持久化**取捨（易部署 vs 無多裝置同步）。

### 3.5 瀏覽器端儲存鍵（`sessionStorage`）

實作見 `lib/progress/storage-keys.ts` 與 `lib/diagnostic-types.ts`（診斷 bundle 鍵名）。

| 用途 | 常數／鍵 | 說明 |
|------|----------|------|
| 診斷問卷結果 | `DIAGNOSTIC_STORAGE_KEY`（`vector-tutor:diagnostic-session`） | 含 8 題 outcomes、耗時、提交時間等；餵給掌握報告與練習推薦。 |
| 練習事件流 | `PRACTICE_EVENTS_STORAGE_KEY` | 每題作答、正誤、topic 等序列資料。 |
| 批次報告歷史 | `PRACTICE_BATCH_REPORTS_STORAGE_KEY` | 每完成 5 題一筆 AI／fallback 小結。 |
| 總掌握報告 v2 | `MASTERY_REPORT_V2_STORAGE_KEY` | `/api/mastery/report` 回傳之結構化報告快取。 |
| 練習 session | `PRACTICE_SESSION_STORAGE_KEY` | 已 AI 編排之題序與進度，避免離開頁面後重複呼叫編排。 |

### 3.6 HTTP API 一覽（伺服端）

| 方法 | 路徑 | 主要輸入／輸出 |
|------|------|----------------|
| POST | `/api/diagnostic/analyze` | 診斷 results + 選填 `answerMap` → `ClientReport` + 複核後 results |
| GET | `/api/practice/questions` | Query `prioritize=topic1,topic2` → 題庫陣列（Supabase 或內建 fallback） |
| POST | `/api/practice/ai-curation` | `report` + `questions` + 選填 `masterySummary` → 編序後題列 + `meta`（含生成／驗題統計） |
| POST | `/api/practice/batch-report` | 5 題 attempts + results → 批次 JSON 小結 + 本地規則之 `answerFeedback`／`thoughtFeedback` |
| POST | `/api/tutor/chat` | 單題上下文 + 對話 + RAG → 導師文字 + `UI_SIGNAL` JSON |
| POST | `/api/tutor/hint` | `questionId` + `hintIndex` + 選填思路 → 改寫後提示句 |
| POST | `/api/tutor/question-recap` | 單題摘要請求 → 純文字小結 |
| POST | `/api/mastery/report` | 診斷 + practiceEvents + batchReports + previousReport → `MasteryReportV2` |

健康檢查：`/api/health/llm`、`/api/health/supabase`（部署／除錯用）。

### 3.7 結構化輸出與 `UI_SIGNAL` 契約

- **診斷／練習編排／批次／掌握／驗題**等多為 **`response_format: { type: "json_object" }`**，並經 `lib/ai/parse-model-json.ts` 解析。  
- **導師對話**（`prompt-b`）要求模型在回覆**最末**輸出：

```text
<!-- UI_SIGNAL -->
{ "action": "...", "update_mastery": ..., "mastery_delta": ..., "topic_status": {...}, "hint_index_used": ... }
```

前端以 `lib/ai/parse-tutor-reply.ts` 分離「給學生看的文字」與機器可讀信號；`action` 含 `next_question`、`show_hint_button`、`show_answer`、`encourage_retry`、`auto_reveal_hint` 等，與本題提示層級、掌握度增量連動。

---

## 四、創新點（建議寫入論文「貢獻」）

### 4.1 教學設計創新

1. **雙通道回饋**：單題對話（微觀）+ 每 5 題批次報告（中觀）+ 總掌握報告（宏觀），形成多時間尺度回饋。
2. **思路可見性**：將學生在單題的**歷史思路**串入導師 prompt 與批次報告，支援「以學生思路為主軸」的引導，而非只看最終答案。
3. **提示鷹架與 UI 同步**：Prompt 明確列出「畫面上已解鎖的題庫提示原文」，減少模型與 UI 狀態不一致；並輔以**關鍵字／層級推斷**在學生已觸及某層概念時**提前對齊 hint 進度**（見 `app/api/tutor/chat/route.ts` 與 `lib/ai/prompt-b.ts`）。

### 4.2 工程與品質創新

1. **練習題雙階段管線（Generate → Validate）**  
   - 生成 prompt 專注題型與多樣性（`lib/ai/prompt-practice-curation.ts`）  
   - 驗題 prompt 專注邏輯一致性（答案、選項唯一性、可解性等）  
   - 路由：`app/api/practice/ai-curation/route.ts`  
   - 可設定 **`DEEPSEEK_MODEL_GENERATE` / `DEEPSEEK_MODEL_VALIDATE`**、**`AI_VALIDATE_MAX_ROUNDS`**；預設驗題模型為 **`deepseek-chat`**（較 `reasoner` 穩定、延遲較低）。
2. **編排與可見性一致**：AI 生成題在合併題單時**置前**，避免「後端宣稱有 AI 題但前端每批只顯示前 5 題卻全是題庫」的體驗 bug；前端橫幅改以「本批可見 AI 題數」輔助說明（`app/(tutor)/practice/page.tsx`）。
3. **全鏈路可觀測性**：`lib/ai/trace-logger.ts` + 環境變數 **`AI_TRACE_LOG=1`**，將主要 AI 端點的 prompt／response／result／error 以 **JSONL** 追加寫入 `.debug/ai-traces/`（已 `.gitignore`，不進版控）。
4. **RAG 擴展到命題**：除導師對話外，練習題生成亦注入 RAG 片段，並在 `meta` 回報 `ragContextUsed` / `ragContextChars` 以利實驗記錄。

### 4.3 視覺化掌握儀表板

- `/mastery`：雷達圖、四段分級、強弱 topic 卡片、建議練習順序、近期批次趨勢等（論文可放「評估儀表設計」插圖）。

---

## 五、目錄與關鍵檔案導覽（給論文「系統設計」執筆用）

```text
app/
  (tutor)/                 # 學習者 UI（診斷、練習、報告、掌握）
  api/
    diagnostic/analyze/    # 診斷 → ClientReport（含填空複核等）
    practice/
      ai-curation/         # 題序 AI + AI 補題 + 雙階段驗題
      batch-report/        # 每批 5 題小結
      questions/           # 題庫題載入
    tutor/
      chat/                # Socratic 主對話 + RAG + hint 推斷
      hint/                # 提示改寫
      question-recap/      # 單題收束小結
    mastery/report/        # 總掌握報告（DeepSeek JSON）
lib/
  ai/                      # DeepSeek、prompts、JSON 解析、trace
  rag/                     # embedding + retrieve-context
  tutor/                   # 題型、評分、題庫映射
  diagnostic-*            # 診斷資料與型別
  progress/              # session 鍵與型別
  practice/              # 推薦池、排序工具
components/              # MathLive、KaTeX 包裝、導覽
scripts/                   # embeddings backfill、資料修復等
```

---

## 六、環境變數與本機執行

### 6.1 必要／常用變數

請複製 `.env.example` 為 `.env.local` 並填入真值（**勿提交** `.env.local`）。

| 變數 | 用途 |
|------|------|
| `DEEPSEEK_API_KEY` | 呼叫 DeepSeek Chat Completions |
| `DEEPSEEK_MODEL` | 預設模型（建議 `deepseek-chat`） |
| `DEEPSEEK_MODEL_GENERATE` / `DEEPSEEK_MODEL_VALIDATE` | 練習補題：生成與驗題分模型（可選） |
| `AI_VALIDATE_MAX_ROUNDS` | 驗題補生最大輪數（預設 2） |
| `AI_TRACE_LOG=1` | 開啟 AI JSONL trace |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 讀題／RAG |
| `OPENAI_API_KEY` 或 DeepSeek 金鑰 | Embeddings（依 `lib/rag/embedding.ts`） |
| `EMBEDDING_PROVIDER` / `EMBEDDING_MODEL` / `EMBEDDING_API_BASE` | 向量維度與 API 端點細節（見 `embedding.ts`） |
| `SUPABASE_QUESTIONS_TABLE` | 題庫表名（預設 `vector_questions`） |
| `RAG_TOP_K` | 每次檢索片段數量上限（見 `retrieve-context.ts`） |

### 6.2 指令

```bash
npm install
npm run dev          # 開發
npm run build        # 正式建置
npm run embed:backfill   # 若需寫入向量欄位（見 package.json）
```

---

## 七、LLM 溫度與端點一覽（實驗章節可引用）

以下為程式內**明確指定**的 `temperature`（未列者使用 `deepseekChat` 內建預設 0.4）：

| 端點 | 檔案 | temperature |
|------|------|----------------|
| 練習題排序 | `app/api/practice/ai-curation/route.ts` | 0.25 |
| 練習題生成 | 同上 | 0.3 |
| 練習題驗題 | 同上 | 0.1 |
| 總掌握報告 | `app/api/mastery/report/route.ts` | 0.25 |
| 批次小結 | `app/api/practice/batch-report/route.ts` | 0.3 |
| 導師對話／提示 | `app/api/tutor/chat/route.ts`、`hint/route.ts` | 0.45 |
| 單題 recap | `app/api/tutor/question-recap/route.ts` | 0.35 |
| 診斷填空複核／診斷報告 | `app/api/diagnostic/analyze/route.ts` | 0.1 / 0.35 |

論文可討論：**低溫用於結構化 JSON 與驗題**、**中溫用於敘事與引導語氣**的取捨。

### 7.1 模型與 `deepseekChat` 參數

- 預設模型：`lib/ai/deepseek.ts` 之 `DEFAULT_MODEL` 與環境變數 `DEEPSEEK_MODEL`。  
- `deepseekChat(messages, options)`：`options.model` 可**單次覆寫**全域模型（練習「生成／驗題」分開設定時使用）；`options.jsonObject: true` 對應 `response_format: { type: "json_object" }`；`options.temperature` 覆寫預設 0.4。

---

## 附錄 A：全專案 LLM Prompt 原文與檔案對照

> **維護說明**：以下與程式碼同步；論文引用建議附 **Git commit**。模板中的 `${…}` 表示執行期由 TypeScript 字串模板代入；若日後程式調整 prompt，請以 `lib/ai/` 與相關 `app/api/**/route.ts` 為準並回寫本附錄。

### A.1 診斷掌握分析 · Prompt A（`lib/ai/prompt-a.ts`）

**System（`PROMPT_A_SYSTEM`）**

```
你只輸出一段合法 JSON 物件，不要 markdown、不要程式碼围栏、不要任何 JSON 以外文字。
```

**User（`buildPromptAUser`）** — 完整模板如下（變數：`studentId`、`totalTimeSeconds`、`questionResultsJson`）：

```
你是一位澳門高中數學向量單元的資深教師助手。
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

補充：weak_topics 的 topic 應與學生資料「知識點」欄一致；topic_tag 僅在該題列的「知識點標籤」非空時填入且須逐字相同，供系統對齊題庫 topic 欄，否則省略 topic_tag。
```

### A.2 診斷填空題複核（`app/api/diagnostic/analyze/route.ts` 內 `aiReviewFillAnswers`）

**System**

```
你是嚴謹的數學閱卷助理。只輸出 JSON 物件，不要 markdown，不要其他文字。
```

**User**（`fillPayload` 為 JSON 陣列，每筆含 `q`、`stem`、`student_answer`、`expected_hint`）

```
請複核以下填空題作答。學生答案可能包含解題過程或多餘文字，請判斷其最終數學答案是否正確。

輸入（JSON）：
${JSON.stringify(fillPayload)}

請輸出：
{
  "reviews": [
    { "q": 題號, "correct": true/false }
  ]
}

規則：
1) 只回傳輸入裡出現的題號。
2) 若最終答案正確，即使夾雜過程文字也判 correct=true。
3) 不確定時偏保守判 false。
```

### A.3 練習題 AI — 排序（`lib/ai/prompt-practice-curation.ts`）

**System（`PRACTICE_ORDER_SYSTEM`）**

```
你只輸出一段合法 JSON 物件，不要 markdown、不要程式碼围栏、不要 JSON 以外文字。
```

**User（`buildPracticeOrderUser`）**

```
你是澳門高中數學向量單元的題組編排助手。下面有一份「診斷掌握報告」以及目前題庫中可練習的題目清單（僅含 id、知識標籤、難度、題型、題幹摘要）。

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
3. 若清單僅 1 題，ordered_ids 長度仍為 1。
```

### A.4 練習題 AI — 生成（同上檔案）

**System（`PRACTICE_GENERATE_SYSTEM`）**

```
你只輸出一段合法 JSON 物件，不要 markdown、不要程式碼围栏。JSON 內須含鍵 "questions"，其值為陣列。
```

**User（`buildPracticeGenerateUser`）**

```
你是澳門高中數學向量單元的命題助手。下面有診斷報告、題庫中**少量範例題**（僅作風格與欄位參考，**不要**抄寫或只改數字複製成新題），以及需要補強的 topic 標籤。

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
}
```

### A.5 練習題 AI — 驗題（同上檔案）

**System（`PRACTICE_VALIDATE_SYSTEM`）**

```
你是嚴格的高中向量題品質審核器。你只輸出一段合法 JSON 物件，不要 markdown、不要程式碼围栏、不要額外文字。
```

**User（`buildPracticeValidateUser`）**

```
請審核以下 AI 生成題，找出邏輯或答案問題，並僅回傳 JSON。

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
- invalid 與 valid_questions 合計需覆蓋所有輸入題目（以 id 對應）。
```

### A.6 練習批次報告（`lib/ai/prompt-batch-report.ts`）

**System（`BATCH_REPORT_SYSTEM`）**

```
你是澳門高中向量單元的學習分析助教。只輸出合法 JSON 物件，不要 markdown、不要程式碼區塊、不要其他文字。
```

**User（`buildBatchReportUser`）**

```
下面是學生在第 ${input.batchIndex + 1} 組（5題）練習的作答結果 JSON：
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
6. 嚴禁輸出 JSON 以外內容。
```

### A.7 總掌握報告（`lib/ai/prompts/mastery-report.ts`）

**System（`MASTERY_REPORT_SYSTEM_PROMPT`）**

```
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
```

**User（`buildMasteryReportUser`）**

```
請根據以下資料產生掌握追蹤 JSON。

[diagnostic]
${input.diagnosticJson}

[practice_events]
${input.practiceEventsJson}

[batch_reports]
${input.batchReportsJson}

[previous_report]
${input.previousReportJson}
```

### A.8 單題收束小結（`lib/ai/prompt-question-recap.ts`）

**System（`QUESTION_RECAP_SYSTEM`）**

```
你是高中數學向量單元導師。請用繁體中文寫一段精簡的「本題小結」（約 4～8 句，或精簡條列），語氣溫和、第二人稱「你」。
必須涵蓋：這題在考什麼（一句）；學生寫了／選了什麼與思路；是否到位或偏在哪；往後值得鞏固的一個重點或易錯點。
勿冗長重講完整解題；總長以 220 字內為宜。數學式用行內 LaTeX $...$。不要輸出 JSON 或程式碼围栏。
```

**User（`buildQuestionRecapUser`）**（與 `prompt-question-recap.ts` 字串模板一致；`??`／`||` 為程式端邏輯）

```
題幹要點（LaTeX 混排）：
${input.questionStemPlain}

知識向度：${input.topicLabel}
題型：${input.kind}
學生最終作答：${input.studentAnswerSummary}
標準參考（內部對照用，勿整段抄給學生當標準答案展示）：${input.standardAnswerSummary}
系統判斷：${input.isCorrect ? "正確（含填空在格式寬鬆比對下視為等价）" : "未達標或未選對"}

學生在「你的思路」欄的內容：
${input.thoughtSummary?.trim() || "（未填寫）"}

上一則導師回覆（若有）：
${input.lastTutorReply?.trim() || "（無）"}

已解鎖提示最高層索引（-1 表示未開提示；否則為 0-based 最高層）：${input.hintsUnlockedLayerMax}

請直接輸出「本題小結」正文。
```

### A.9 Socratic 導師主對話（`lib/ai/prompt-b.ts`）

**System（`PROMPT_B_SYSTEM`）**

```
你是澳門高中數學向量單元的 AI 教學助手「向量老師」。教學風格為 Socratic：不直接給出答案或完整解法，用提問引導。回應語言：繁體中文。
使用者訊息中會單獨列出「學生畫面上已可見的提示進度」原文；凡列出的內容學生都已讀到，請與網頁狀態一致，勿假裝對方仍不知道當中公式。

【數學式 LaTeX 規範（必須遵守）】
- 凡涉及公式、向量符號、分數、根號、角標、集合、不等式等，一律用 LaTeX，不要用純文字拼寫公式。
- 行內公式用單一美元符包裹：$...$（例：$\mathbf{a}\cdot\mathbf{b}$、$\sqrt{x^2+y^2}$）。
- 需要獨立成行的較長推導或多行式，用區塊：$$...$$（中間可換行）。
- 與題幹一致時優先使用 \mathbf{} 表示向量；常用指令：\frac{}{}、\sqrt{}、\pm、\cdot、\parallel、\angle。
- 一般敘述仍用繁體中文；只有數學片段放在 $ 或 $$ 內。
```

（註：源碼字串內為 `\\mathbf` 等轉義；顯示給模型時為單反斜線 LaTeX。）

**User（`buildPromptBUser`）**（源碼先將 `ragContext` trim 後代入變數 `rag`；此處已展開為單一表達式。`topic_status` 內的 `topic` 在源碼為嵌套模板字面量，送進模型的為當題知識點字串，非字面 `${…}`。）

```
===== 學生背景 =====
掌握程度等級：${input.studentLevel}
掌握良好的知識點：${JSON.stringify(input.strongTopics)}
需要加強的知識點：${JSON.stringify(input.weakTopics)}
當前總體掌握分：${input.masteryScore}

===== 當前題目資料 =====
題目編號：${input.questionId}
題目內容（LaTeX）：${input.questionLatex}
題目難度：${input.questionLevel}
涉及知識點：${input.questionTopic}
正確答案（僅供你參考，不得直接透露）：${input.correctAnswer}
解題關鍵步驟提示池（按層次排列）：
${input.hintPoolJson}
（與源碼等價：若 hintStepsCount 為 0 則插入「（本題尚無提示池；hint_index_used 請填 -1。）」；否則插入「（共 ${input.hintStepsCount} 層，layer 索引 0 至 ${input.hintLayerMaxIndex}。）」）

===== RAG 補充片段（題庫／講義檢索，可為空）=====
${input.ragContext?.trim() ?? "（尚未接入 RAG；之後在此注入向量檢索到的題庫片段。）"}

===== 學生畫面上已可見的「提示進度」（與網頁同步）=====
${input.unlockedHintsBlock}
（說明：以上若出現具體公式或步驟，代表學生正在畫面上讀到這些文字；請視為已知，勿再請對方「回想／猜」同一條定義。）

===== 當前作答狀態 =====
學生本題嘗試次數：${input.attemptCount}
學生已解鎖提示層數（由「提示進度」計）：${input.hintsGiven}
學生本次輸入的答案/問題：${input.studentInput}
學生目前作答摘要：${input.studentAnswerSummary}
學生目前答案是否正確：${input.isCurrentAnswerCorrect}
本題是否已達最大嘗試次數（3次）：${input.maxAttemptsReached}

===== 對話歷史（本題範圍內）=====
${input.conversationHistoryJson}

===== 學生本題歷史思路（user-only）=====
${input.thoughtHistoryJson}

===== 教學規則（不得違反）=====
1. 絕對不直接說出正確答案的數值或完整解題步驟（除非 MAX_ATTEMPTS_REACHED 且規範允許）。
2. 每次回應必須以引導性問題結尾。
3. 根據上文「需要加強的知識點」調整關注點。
4. 語氣溫暖鼓勵。
5. 所有數學式須符合上方【數學式 LaTeX 規範】，方便前端用 KaTeX 渲染。
6. 【與介面一致】若「學生畫面上已可見的提示進度」區塊列有某層原文，你必須承認學生已看到該內容；接著在該基礎上追問（例如如何代入本題、下一步運算），**禁止**再請學生憶測該區塊已寫明的定義或公式。
7. 若學生目前答案已正確（isCurrentAnswerCorrect=true），回覆第一句必須先明確肯定答對與亮點；接著最多補 1 個思維提醒，避免忽視答案本身。
8. 若學生本次或歷史思路已明確提到某些 hint 的核心概念，你應直接承認其已掌握該層，跳過重複提示，把重點放在「下一步該怎麼做」；以學生思路為主軸，hint 只作輔助鷹架。

【按嘗試次數的行為規範】
- ATTEMPT_COUNT = 1：對錯不直接宣判；可用提示池第一層方向。
- ATTEMPT_COUNT = 2：若仍錯，指出可能偏差但不說正確步驟；用提示池第二層。
- ATTEMPT_COUNT = 3 且 MAX_ATTEMPTS_REACHED：若仍錯，可展示完整解法與答案，並反思提問。

【卡關時主動解鎖提示（不必等學生按鈕）】
若出現以下任一情況，你可自行決定在本則回應的**主文**中，把「下一層（或多層）」提示的**意涵**寫進去（須依提示池改寫、引導式表達，不可整句抄寫題庫原句）：
- 學生連續多輪對話仍停在同一迷思、沒有新進展；
- 學生明說仍不懂、卡住、想直接看提示；
- ATTEMPT_COUNT 已 ≥2 且仍明顯需要鷹架。
同時在 UI_SIGNAL 設定 hint_index_used 為「本則回應已相當於解鎖到的最高層索引」（0 起算，與提示池 layer 對齊）。若本則未解鎖任何新層，維持 hint_index_used 為 -1。若一次釋放多層意涵，hint_index_used 取最高層索引。

【UI 交互信號】
每次回應最後在單獨一行輸出標記與 JSON（不展示給學生）：
<!-- UI_SIGNAL -->
{
  "action": "next_question" | "show_hint_button" | "show_answer" | "encourage_retry" | "auto_reveal_hint",
  "update_mastery": true | false,
  "mastery_delta": 0,
  "topic_status": { "topic": "${input.questionTopic}", "result": "mastered" | "partial" | "needs_review" },
  "hint_index_used": -1
}
（hint_index_used：-1 表示本則不解鎖「提示進度」面板；若本題有提示池，可填 0 至 ${input.hintLayerMaxIndex} 表示解鎖至該層（含）。主動給提示時 action 建議用 auto_reveal_hint。）

===== 你的回應開始 =====
```

### A.10 提示改寫 Coach（`app/api/tutor/hint/route.ts`）

**System**

```
你是澳門高中數學向量單元的導師。接下來會給你「參考提示」僅供理解題意；請用繁體中文、自己的話改寫成簡短引導（多為提問），且不可連續複製參考提示超過 6 個字。不要直接給出最終數值答案。
```

**User**（`hintIndex`、`hintSourceText` 為題庫第 n 層原文；學生思路為 trim 後字串，空則顯示「（無）」）

```
參考提示（第 {hintIndex + 1} 層）：
{hintSourceText}

學生剛寫的思路（可為空）：
{studentThought 或 （無）}
```

### A.11 Mock／後備文案（非主線 LLM，論文可略或附於「降級策略」）

- `lib/ai/mastery-report-mock.ts`、`lib/ai/hint-coach-mock.ts`：在無 API 金鑰或呼叫失敗時提供可讀後備字串，確保 UI 不中斷。

### 附錄 B：`AI_TRACE_LOG` 與 JSONL 紀錄格式（`lib/ai/trace-logger.ts`）

- 設定 **`AI_TRACE_LOG=1`**（或 `true`／`yes`／`on`）後，多個路由會呼叫 `logAiTrace({ route, phase, payload, meta })`。  
- **phase**：`prompt` | `response` | `result` | `error`。  
- **寫入路徑**：`.debug/ai-traces/YYYY-MM-DD.jsonl`（**已 gitignore**）。  
- **sanitize**：遮罩疑似敏感鍵名（如含 `api_key`、`token` 等）；字串與陣列長度截斷，避免單行過大。  
- **論文用途**：可做質性分析、提示詞迭代、錯題案例附錄；正式發表前須去識別化。

---

## 八、開發歷程中的典型問題與解決方案（論文「實作反思」素材）

### 8.1 AI 宣稱「已生成 N 題」但學生畫面全是題庫題

- **原因**：後端把 AI 題 append 在長清單末端，而練習 UI 每批只取前 **5** 題。  
- **解決**：合併時將 **AI 題置前**；前端訊息改以「本批可見 AI 題數」對齊使用者認知。

### 8.2 AI 選擇題品質：答案自洽但選項重複、或題幹與選項矛盾

- **原因**：單一 mega-prompt 同時「創作 + 自檢」，在上下文與模型行為下容易漏檢。  
- **解決**：拆成 **Prompt A（生成）** 與 **Prompt B（驗題）** 兩段；後端以有限輪數補生，並在 `meta` 統計 `invalidReasonStats`、`fallbackCount` 等供實驗分析。

### 8.3 Socratic 引導「無視學生已答對」或死守 hint 順序

- **原因**：系統提示未強制「先肯定再延伸」；模型預設偏教學碎碎唸。  
- **解決**：  
  - Prompt 規則：`isCurrentAnswerCorrect` 時先肯定（`lib/ai/prompt-b.ts`）。  
  - 將 **thoughtHistory** 餵給模型；後端以簡單規則從思路推斷已涵蓋的 hint 層級，必要時覆寫 `uiSignal`（`app/api/tutor/chat/route.ts`）。

### 8.4 總掌握報告「不夠智能」

- **原因**：早期 `mastery/report` 使用 mock／本地規則為主。  
- **解決**：改為 **DeepSeek 產出結構化 JSON**（敘事 + topic 分數 + 建議順序 + 建議難度），失敗時再 fallback mock，並納入 trace。

### 8.5 RAG「好像沒生效」或檢索不穩

- **原因**：小題庫下純向量檢索不一定最穩；RPC／embedding 未配置時易空結果。  
- **解決**：**三層降級**——同 topic 取樣 → 向量 match → ILIKE 文字（`retrieveRagContext`）；並在 ai-curation `meta` 標註是否注入成功。

### 8.6 模型回傳非嚴格 JSON 導致整條 API 失敗

- **原因**：即使 `json_object`，仍可能出現邊角格式問題或截斷。  
- **解決**：`safeParseModelJson` 包一層 try/catch，避免單次解析失敗拖垮整輪編排（`ai-curation/route.ts`）。

### 8.7 Windows／PowerShell 開發摩擦

- **問題**：`&&`、bash heredoc 在 PowerShell 下解析失敗。  
- **解決**：改用 `;` 分隔或 PowerShell here-string；CI／本機建置指令文件化。

### 8.8 `deepseek-reasoner` 驗題延遲過長或中斷

- **現象**：驗題階段耗時高，請求被中止時 trace 出現 `terminated`。  
- **調整**：預設驗題改 **`deepseek-chat`**；仍保留環境變數切回 reasoner 做對照實驗。

### 8.9 除錯與論文可重現性

- **作法**：`AI_TRACE_LOG=1` 將各階段 payload 寫入 JSONL；**敏感鍵名**在 logger 內遮罩、長字串與長陣列截斷，避免檔案暴長與外洩（`lib/ai/trace-logger.ts`）。

---

## 九、建議論文大綱（供另一個 AI 擴寫用）

> 下列章節可直接貼給寫作 AI 作為 **outline prompt**；請要求其每一節引用「本系統實際模組／流程／限制」，並在「方法／實作」章交叉引用 **附錄 A 提示詞**與 **附錄 B trace**。

### 第一章 緒論

- 研究背景：向量在高中數學的地位、認知負荷、澳門 DSEDJ 課程邊界（對齊開題報告）。  
- 問題陳述：傳統 ITS 語言彈性不足 vs 純 LLM 幻覺與不可控；本研究問題條列見本文 **§1.2**。  
- 貢獻宣告：教學設計（多尺度回饋、Socratic、思路可見）+ 工程設計（雙階段驗題、RAG 降級、trace）。

### 第二章 文獻與相關工作

- ITS 與適性學習經典脈絡；LLM tutor 與 Math 領域 benchmark 趨勢。  
- RAG 於教育場景：檢索品質、幻覺、**與本專案三層降級**對照。  
- Socratic／pedagogical dialogue 的評量維度（可引用開題報告所列文獻）。

### 第三章 需求分析與教學設計

- 利害關係人（學生、教師、開發者）與非功能需求（延遲、成本、無登入部署）。  
- 用例圖／活動圖：對應本文 **§2.3** 診斷—練習—批次—掌握閉環。  
- 教學原則如何落實為 **Prompt B 規則 1–8** 與 **UI_SIGNAL**（附錄 A.9）。

### 第四章 系統總體架構

- 邏輯架構圖：瀏覽器、Next API、Supabase、DeepSeek、（可選）OpenAI embedding。  
- 資料流與 **sessionStorage 鍵**（§3.5）。  
- **REST 表**（§3.6）與錯誤處理策略（fallback、HTTP 仍 200 等若適用）。

### 第五章 核心模組與演算法

- **診斷**：本地加權 + Prompt A + 填空複核（附錄 A.1、A.2）；`mergeAiClientReport` 之合併邏輯可摘要。  
- **練習編排與補題**：`report-candidate-pool`、`ai-curation` 狀態機、**meta** 欄位意義（`validationRounds`、`invalidReasonStats` 等）。  
- **雙階段命題**：附錄 A.3–A.5；可附流程圖（Generate → Validate → merge）。  
- **導師**：RAG 注入、`inferHintIndexFromThoughts`（關鍵字／簡化推斷）與 `parse-tutor-reply`。  
- **掌握報告**：`mastery-report` prompt（附錄 A.7）與正規化欄位（`route.ts`）。

### 第六章 前端與數學表達層

- MathLive 與 KaTeX 分工、STEM 無障礙簡述。  
- `/mastery` 雷達圖與四段分級的**教育意涵**（儀表板不只是「好看」）。

### 第七章 評估方法（探索性亦成立）

- 量化：`meta`、正確率、用時、每題提示層數、AI 題佔比、`invalidReasonStats` 分佈。  
- 質性：trace JSONL 節錄、同學訪談大綱。  
- 對照實驗設計範例：關閉 RAG、關閉驗題、切換 `DEEPSEEK_MODEL_VALIDATE`。

### 第八章 結果與討論

- 呈現數據與代表對話節錄；討論「為何雙階段降低某類錯誤」。  
- 失敗案例：reasoner 延遲、JSON 解析失敗等與工程對策（本文 **§八**）。

### 第九章 倫理、限制與展望

- 學術誠信、過度依賴 AI、題庫版權。  
- 技術債：帳號、持久化、後端數值驗算器、更大樣本實驗。

### 第十章 結論

- 回應研究問題；未來可擴展單元（平几、立几、線代選段）。

---

### 給「寫作 AI」的一鍵提示範本

將以下整段貼給論文寫作助手，並附上本 `README.md` 全文或 repo 連結：

```text
你正在撰寫一篇本科／專題學位論文，系統為「AI 向量教學助手」（Next.js + DeepSeek + Supabase + RAG + Socratic）。
請嚴格依 README 第九節章節順序寫作；每一章必須包含：(1) 與程式模組的對應關係；(2) 至少一處引用附錄 A 的具體 prompt 設計理由；(3) 誠實寫出限制（無登入、樣本、幻覺）。
語言：繁體中文；引用格式依學校規範；技術名詞首次出現請定義。
```

---

## 十、限制聲明（論文「誠實性」段落）

- **無帳號體系**：資料僅存瀏覽器 session，換裝置即丟失。  
- **LLM 幻覺與數值錯誤無法數學式完全證明消除**：工程上採「驗題 + 題庫 fallback + 低溫 JSON」降低風險。  
- **教育成效需實證**：本 README 描述系統能力邊界，**不等同**已通過大樣本嚴格 RCT 驗證。

---

## 十一、授權與致謝

- 本專案為學位／專題相關之教育科技原型；使用第三方 API（DeepSeek、OpenAI embeddings 等）時請遵守各供應商條款與在地法規。  
- 指導教師與試用同學的貢獻可於論文致謝中列名。

---

## 十二、Repository

- **GitHub**：`https://github.com/Sio-Ben/vec_math_tutor`（遠端 `origin`）

若論文需引用開題報告檔名，可註記：**《開題報告》（2025-03，Word 稿）**；其論點已盡量融入本 README 第一至四節與第九節大綱對照。
