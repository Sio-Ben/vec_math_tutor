# AI 向量教學助手（Math Tutor）

面向澳門高中「平面向量」單元的智慧輔學原型。  
系統流程為：**診斷測驗 -> 練習引導 -> Socratic 對話 -> 批次報告 -> 掌握追蹤**。

本專案採 **無登入、單工作階段（sessionStorage）** 設計，重點在教學流程與 AI 輔助策略，而非帳號系統。

## 專案目標

- 提供可落地的向量單元學習閉環（診斷、練習、回饋、追蹤）
- 讓 AI 參與出題與教學對話，但保留可控的後端規則約束
- 支援論文撰寫所需的 prompt 附錄、可觀測紀錄與可重現資料輸出

## 技術棧

- 前端與全端框架：`Next.js 16`（App Router）、`React 19`、`TypeScript`
- UI：`Tailwind CSS v4`、`KaTeX`、`MathLive`
- 資料庫：`Supabase (PostgreSQL)`，可搭配 `pgvector`
- LLM：`DeepSeek Chat Completions`
- 觀測與研究輸出：`JSONL trace`、題庫統計腳本（Table 3）

## 快速開始

```bash
npm install
cp .env.example .env.local
npm run dev
```

Windows 可用：

```powershell
copy .env.example .env.local
```

啟動後開啟 `http://localhost:3000`。

## 常用指令

| 指令 | 用途 |
|---|---|
| `npm run dev` | 開發模式 |
| `npm run build` | 生產建置 |
| `npm run start` | 啟動生產伺服器 |
| `npm run lint` | 程式檢查 |
| `npm run table3` | 匯出 topic x difficulty 分佈（論文表 3） |
| `npm run embed:backfill` | 回填題庫 embedding |
| `npm run db:fix-backslash` | 修正題庫反斜線資料格式 |

## 環境變數重點

至少需要：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

啟用 AI 功能需要：

- `DEEPSEEK_API_KEY`

常用進階設定：

- `SUPABASE_SERVICE_ROLE_KEY`（伺服端查詢與 RPC）
- `SUPABASE_QUESTIONS_TABLE`（預設 `vector_questions`）
- `DEEPSEEK_MODEL` / `DEEPSEEK_MODEL_GENERATE` / `DEEPSEEK_MODEL_VALIDATE`
- `AI_VALIDATE_MAX_ROUNDS`
- `AI_TRACE_LOG=1`（輸出到 `.debug/ai-traces/*.jsonl`）
- `RAG_TOP_K`

若要使用向量檢索，請先在 Supabase 建立 `vector` 擴展與對應 RPC（例如 `match_vector_questions`）。

## 產品流程（學習閉環）

1. `診斷測驗`（`/diagnostic`）產生初始能力概況
2. `練習引導`（`/practice`）依弱項與建議等級安排題組
3. `Socratic 導師`（`/api/tutor/chat`）根據學生思路給提示與追問
4. `批次報告`（`/api/practice/batch-report`）每 5 題輸出策略回饋
5. `掌握追蹤`（`/mastery`）匯總診斷 + 練習歷程形成總報告

## 題目推薦與 AI 生成機制（現況）

練習編排由 `/api/practice/ai-curation` 負責，流程為：

1. 先從題庫取得候選題（含弱項優先）
2. 以 AI 做題目排序（order）
3. 若觸發條件成立（題量不足、弱項覆蓋不足、L4、缺 AI 題）則補 AI 題
4. 新題先 generate，再經 validate，無效題淘汰
5. 輸出最終題組與 `meta`（如生成數、fallback 數、驗題統計）

## 升降級策略（研究重點）

批次報告端點：`/api/practice/batch-report`

- 輸入：當批作答結果 + `baselineLevel`（上一輪建議等級）
- 輸出：`difficultyAdvice`（up/keep/down）+ `recommendedLevel`（L1-L4）
- 後端綁定：以規則確保 advice 與 level 方向一致，避免語意矛盾

> 簡述：AI 提供分析與建議語意，伺服端規則保證決策一致性。

## 主要路由與 API

### 頁面

- `/`：首頁與流程導覽
- `/diagnostic`：診斷題
- `/diagnostic/report`：診斷結果頁
- `/practice`：練習引導 + 導師互動
- `/practice/report`：每批練習小結
- `/mastery`：總掌握度報告

### API

- `POST /api/diagnostic/analyze`
- `GET /api/practice/questions`
- `POST /api/practice/ai-curation`
- `POST /api/practice/batch-report`
- `POST /api/tutor/chat`
- `POST /api/tutor/hint`
- `POST /api/tutor/question-recap`
- `POST /api/mastery/report`

健康檢查：

- `GET /api/health/llm`
- `GET /api/health/supabase`

## AI 題未入庫的相容設計

`/api/tutor/chat` 與 `/api/tutor/hint` 支援 `inlineQuestion`：

- 先查 DB 題目 id
- 查不到則使用內建題庫
- 再查不到時，允許用 `inlineQuestion`（需通過格式驗證）

因此 AI 新生成但尚未入庫的題目，也可進行導師對話與提示改寫。

## Prompt 與論文附錄

- 完整 prompt 原文（1:1）請見：`docs/appendix_prompts.txt`
- 主要 prompt 程式碼位置：`lib/ai/prompt-*.ts`
- 論文引用建議固定 commit hash，避免文字與程式版本不一致

## 研究資料與可重現輸出

- Table 3（topic x difficulty）：`npm run table3`
- AI trace（prompt/response/result）：設定 `AI_TRACE_LOG=1`
- 若要做章節對照，建議把本 README 與 `docs/appendix_prompts.txt` 一起鎖定版本

## 專案目錄（精簡）

```text
app/
  (tutor)/         # 診斷、練習、報告、掌握頁面
  api/             # 各 AI 與資料端點
components/        # UI 元件與數學輸入/渲染
lib/
  ai/              # prompts、LLM 呼叫、trace
  rag/             # embedding 與檢索
  tutor/           # 題型、評分、題目解析
  practice/        # 練習會話與快取
docs/
  appendix_prompts.txt
scripts/
```

## 安全與限制

- `.env.local` 不可提交版本庫
- API 金鑰僅放伺服端變數
- `inlineQuestion` 屬原型期權衡，正式產品建議改為伺服端持久化題目

## 維護建議

每次調整 prompt、升降級規則、或 L4 策略時，請同步更新：

1. `docs/appendix_prompts.txt`
2. 論文章節（方法、實驗、限制）
3. 研究指標與圖表（若有新增 meta/trace 欄位）
