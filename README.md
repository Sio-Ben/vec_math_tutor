# AI 向量教學助手（Math Tutor）

面向**澳門高中數學「平面向量」**的課後輔學 Web 原型：**診斷問卷** → **結構化練習** → **蘇格拉底式導師對話**（可選 **RAG**）→ **批次小結** → **掌握儀表板**。無登入，狀態以 **`sessionStorage`** 保存。

**技術棧**：Next.js 16（App Router）、React 19、TypeScript、Tailwind 4、Supabase（PostgreSQL + 可選 **pgvector**）、DeepSeek Chat Completions、KaTeX、MathLive。

---

## 快速開始

```bash
npm install
cp .env.example .env.local   # Windows: copy .env.example .env.local
# 編輯 .env.local：至少 NEXT_PUBLIC_SUPABASE_*；若要 AI 則填 DEEPSEEK_API_KEY
npm run dev
```

瀏覽 `http://localhost:3000`：`/` 導覽、`/diagnostic` 診斷、`/practice` 練習、`/mastery` 掌握度。

```bash
npm run build    # 正式建置
npm run lint
```

---

## 常用指令（`package.json`）

| 指令 | 說明 |
|------|------|
| `npm run dev` | 開發伺服器 |
| `npm run build` / `npm run start` | 建置與正式執行 |
| `npm run table3` | 自 Supabase 統計 **topic × 難度（L1–L4）**，輸出 `docs/generated/table3-topic-difficulty.{md,csv}` |
| `npm run embed:backfill` | 為題庫列補 **embedding**（需 OpenAI 或已設定的 embedding 供應商金鑰） |
| `npm run db:fix-backslash` | 題庫字串雙反斜線修正（dry-run；加 `--apply` 寫回） |

---

## 環境變數

複製 `.env.example` 為 `.env.local`（**勿提交** `.env.local`）。

| 變數 | 說明 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 前端與伺服端讀題（匿名 RLS 需允許 `SELECT`） |
| `SUPABASE_SERVICE_ROLE_KEY` | 僅伺服端；**建議**用於讀題／向量 RPC，避開 RLS 導致 0 筆 |
| `SUPABASE_QUESTIONS_TABLE` | 題庫表名，預設 `vector_questions` |
| `DEEPSEEK_API_KEY` | 啟用各 LLM 端點；未設時多數 API 回傳本機 fallback |
| `DEEPSEEK_MODEL` | 預設 `deepseek-chat`；可改 `deepseek-reasoner` |
| `DEEPSEEK_MODEL_GENERATE` / `DEEPSEEK_MODEL_VALIDATE` | 練習補題生成／驗題分模型（可選） |
| `AI_VALIDATE_MAX_ROUNDS` | 驗題補生輪數上限（預設 2） |
| `AI_TRACE_LOG=1` | 將 prompt／response 等寫入 `.debug/ai-traces/*.jsonl`（已 gitignore） |
| `OPENAI_API_KEY` 等 | 見 `lib/rag/embedding.ts`：`EMBEDDING_PROVIDER`、`EMBEDDING_MODEL` |
| `RAG_TOP_K` | RAG 片段數量上限 |

向量檢索需執行專案內 SQL（例如 `scripts/supabase-create-rag-rpc.sql`）建立 **`vector` 擴展**與 **`match_vector_questions`** RPC；未建時會降級為同 topic 取樣與 ILIKE。

---

## 功能與路由

| 路徑 | 說明 |
|------|------|
| `/` | 三階段流程導覽 |
| `/diagnostic` | 8 題診斷（L1–L3） |
| `/diagnostic/report` | `POST /api/diagnostic/analyze` → ClientReport |
| `/practice` | 練習 + 向量老師 + 提示層 + MathLive |
| `/practice/report` | 批次練習回饋 |
| `/mastery` | `POST /api/mastery/report` → 雷達圖、分級、趨勢 |

**學習閉環（簡圖）**：診斷 → ClientReport → AI 編序／補題（雙階段 Generate & Validate）→ 單題 Socratic（`UI_SIGNAL`）→ 每 5 題批次報告 → 總掌握 JSON → 儀表板。

---

## HTTP API 摘要

| 方法 | 路徑 | 說明 |
|------|------|------|
| POST | `/api/diagnostic/analyze` | 診斷結果 → ClientReport（含填空 AI 複核） |
| GET | `/api/practice/questions` | 題庫列表（Supabase 或 fallback） |
| POST | `/api/practice/ai-curation` | 排序、補 AI 題、驗題迴圈；回傳 `meta` |
| POST | `/api/practice/batch-report` | 每批 5 題小結 |
| POST | `/api/tutor/chat` | Socratic 主對話 + RAG + `inferHintIndexFromThoughts` |
| POST | `/api/tutor/hint` | 依題庫提示改寫為教練語氣 |
| POST | `/api/tutor/question-recap` | 單題收束小結 |
| POST | `/api/mastery/report` | MasteryReportV2（正規化 + mock fallback） |

健康檢查：`GET /api/health/llm`、`GET /api/health/supabase`。

### 導師端點：題目載入（題庫 id + 未入庫 AI 題）

`/api/tutor/chat` 與 `/api/tutor/hint` 透過 **`lib/tutor/resolve-practice-question.ts`** 解析題目，順序為：

1. **Supabase** `loadQuestionByIdFromDb(questionId)`
2. 內建示範 **`PRACTICE_QUESTIONS`**（`lib/tutor/practice-questions.ts`）
3. 若仍無：**請求內可選 `inlineQuestion`**（與 `questionId` 同 id 的 **`PracticeQuestion` JSON 快照**），經 `parseInlinePracticeQuestion` 驗證後採用

練習頁對 **`source === "ai"`** 的題會附上 `inlineQuestion`，因此 **AI 生成且未入庫**的題仍可導師對話與提示改寫。題庫能查到時**以伺服端為準**，不被客戶端快照覆蓋。

請求型別見 `lib/tutor/types.ts`（`TutorChatRequest.inlineQuestion`）。

---

## 目錄導覽（精簡）

```
app/
  (tutor)/           # 診斷、練習、報告、掌握 UI
  api/
    diagnostic/analyze/
    practice/        # questions, ai-curation, batch-report
    tutor/           # chat, hint, question-recap
    mastery/report/
lib/
  ai/                # DeepSeek、prompts、JSON 解析、trace
  rag/               # embedding、retrieve-context（三層降級）
  tutor/             # PracticeQuestion、evaluate、resolve-practice-question
  progress/          # sessionStorage 鍵名
  practice/          # session 快取、推薦池
components/          # MathText、MathLive、版面
scripts/             # embeddings、table3、SQL 範例
docs/
  appendix_prompts.txt   # 與程式 1:1 的 Prompt 附錄（論文可引用）
  generated/             # `npm run table3` 輸出
```

---

## LLM 溫度（論文可引用）

| 區塊 | 約略 temperature |
|------|-------------------|
| 練習排序 | 0.25 |
| 練習生成 | 0.3 |
| 練習驗題 | 0.1 |
| 診斷報告 / 單題 recap | 0.35 / 0.35 |
| 診斷填空複核 | 0.1 |
| 導師 chat / hint | 0.45 |
| 總掌握報告 | 0.25 |
| 批次小結 | 0.3 |

實際以各 `route.ts` 與 `lib/ai/deepseek.ts` 呼叫為準。

---

## Prompt 與論文引用

- **完整 System／User Prompt 原文（與源碼字串一致）**：[`docs/appendix_prompts.txt`](docs/appendix_prompts.txt)  
- 源碼位置：`lib/ai/prompt-*.ts`、`lib/ai/prompts/`、`app/api/diagnostic/analyze/route.ts`（填空複核）等。  
- 論文引用建議註明 **Git commit**，程式調整後以源碼與 `appendix_prompts.txt` 為準。

合併版 LaTeX 草稿（若使用）：`docs/thesis_combined.tex`。

---

## 設計重點（論文「貢獻／創新」可寫）

- **雙階段命題**：生成與驗題分離（`lib/ai/prompt-practice-curation.ts`、`app/api/practice/ai-curation/route.ts`）。
- **`UI_SIGNAL`**：導師回覆末段 JSON，驅動提示層與流程（`lib/ai/prompt-b.ts`、`lib/ai/parse-tutor-reply.ts`）。
- **`inferHintIndexFromThoughts`**：由學生思路文字推斷已涵蓋提示層，必要時覆寫模型回傳的 `hint_index_used`（`app/api/tutor/chat/route.ts`）。
- **RAG 三層降級**：同 topic → pgvector RPC → ILIKE（`lib/rag/retrieve-context.ts`）。
- **AI Trace**：`AI_TRACE_LOG=1` 時 JSONL 觀測（`lib/ai/trace-logger.ts`）。

---

## 授權與安全提醒

本專案為學術／原型用途。**API 金鑰僅放伺服端環境變數**；`inlineQuestion` 屬原型階段對未入庫題的信任邊界，正式產品宜改入庫或伺服端 session。

---

## 維護

修改 Prompt 或 API 契約後，請同步更新 **`docs/appendix_prompts.txt`** 與論文相關段落；題庫分佈表可執行 **`npm run table3`** 重新產生。
