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

> 下列章節可直接貼給寫作 AI 作為 **outline prompt**；請要求其每一節引用「本系統實際模組／流程／限制」。

1. **緒論**：向量單元學習困難、ITS 與 LLM 文獻缺口（澳門課程本地化）、研究問題與貢獻宣告。  
2. **文獻與理論基礎**：ITS、適性學習、LLM tutor、RAG 於數學教育的風險與護欄。  
3. **需求分析與教學設計**：使用者角色、學習閉環、Socratic 原則量化為系統規則。  
4. **系統架構**：Next.js 前後端一體、Supabase 資料層、DeepSeek 服務邊界、session 資料模型。  
5. **核心演算法與流程**  
   - 診斷加權分與 **ClientReport** 生成／校驗（`validate-client-report`、`enrich-report`）  
   - 練習推薦池與 AI 編序（`report-candidate-pool`、`practice-order-utils`）  
   - **雙階段命題**與 invalid reason 統計  
   - RAG 三層降級與命題／對話注入點  
   - 導師對話：`UI_SIGNAL` 協議、hint 解鎖推斷  
6. **實作細節**：LaTeX 管線（MathLive + KaTeX）、題庫 schema、型別安全。  
7. **評估與實驗設計**（即使樣本小也可寫探索性研究）：指標（正確率、用時、提示層數、問句重複度、主觀問卷）、對照（有／無 RAG、有／無雙階段驗題）。  
8. **結果與討論**：配合 `meta` 與 trace 的質性分析。  
9. **倫理、限制與未來工作**：資料留存、幻覺、過度依賴 AI、帳號系統、題庫授權。  
10. **結論**。

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
