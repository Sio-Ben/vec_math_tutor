# 基於大語言模型的向量智能教學助手

## 1. 研究定位

本專案是一個面向澳門高中數學「平面向量」單元的 Intelligent Tutoring System（ITS）原型。系統目標不是提供直接答案，而是透過可追蹤、可降級、可量化的 AI 輔助流程，支援學生在課後進行結構化練習與反思。

本系統採用「診斷 -> 練習 -> 對話引導 -> 批次回饋 -> 掌握追蹤」學習閉環，並以工程可重現性為核心，提供 Prompt 附錄、指標欄位與 trace 日誌，供研究者與自動化評審系統直接檢視。

## 2. 核心研究問題

- 如何將診斷結果與練習事件轉化為可解釋的推薦與回饋？
- 如何在成本與延遲可控下，降低 AI 自動命題錯誤率？
- 如何讓 Socratic 對話與前端提示狀態保持一致？
- 如何在向量檢索不可用時，仍保證系統可運作？

## 3. 方法總覽

### 3.1 系統決策策略

本專案採「**演算法主控、AI 輔助**」：

- AI：提供語意分析與候選建議（排序、生成、摘要）。
- 演算法：決定最終升降級與組批行為，確保規則一致性。

批次升降級以 `baselineLevel -> difficultyAdvice -> recommendedLevel` 執行單步轉移（最多 ±1 級），避免 advice 與 level 方向矛盾。

### 3.2 題目編排與命題流程

`/api/practice/ai-curation` 執行下列流程：

1. 建立候選池（弱項優先）
2. **AI 選題／編序（order）**：模型讀入候選清單的簡化目錄（id、topic、難度、題型、題幹摘要），依診斷與掌握摘要輸出 **`selected_ids`**（長度須等於本輪 **`targetCount`**，通常為 `min(每批題數, 候選池長度)`）。後端以子集規則驗證：id 必須全部來自候選池、不可重複、長度須與 `targetCount` 一致；不通過則保留候選池原序，避免壞 JSON 破壞題單。為相容舊版回應，仍可比對 **`ordered_ids` 全排列**：若長度等於候選池且為合法排列，則取前 `targetCount` 題套用，並在 `meta.orderMode` 標記為 `legacy_permutation`；主路徑為 `top_k_selection`。
3. 條件式補題（題量不足、弱項覆蓋不足、L4 模式、缺 AI 題）
4. 生成與驗題雙階段（Generate -> Validate）
5. 輸出題組與可觀測 `meta`

相較「要求模型輸出候選池完整排列」，Top‑k 輸出可降低排序階段 token 與延遲，並與「每批可見題數」對齊；候選池仍可由演算法先行收斂，AI 負責在可見子集內做語意化取捨。

L4 採 `soft-ai-priority`：提高 AI 題比重，但不硬性要求 5/5 全 AI，生成不足時允許題庫補位並記錄補位率。

### 3.3 Socratic 對話與未入庫題相容

`/api/tutor/chat` 與 `/api/tutor/hint` 支援 `inlineQuestion`，使「AI 生成但尚未入庫」題目也可進行導師對話。伺服端解析順序為：DB 題目 -> 內建題庫 -> inline 快照（驗證後）。

### 3.4 RAG 三層降級

檢索策略：

1. 同 topic 取樣
2. pgvector RPC（若可用）
3. ILIKE 文字後備

確保 embedding 或 RPC 不可用時，系統仍可產生可用上下文。

## 4. 量化指標與可觀測性

### 4.1 批次與命題指標

- `advice_level_consistency_rate`
- `l4_ai_coverage`
- `l4_fallback_rate`
- `validation_reject_rate`
- `invalidReasonStats`
- `orderMode`（`top_k_selection` / `legacy_permutation`）：排序階段實際採用的輸出型別，便於對照論文與 trace

### 4.2 Trace 機制

啟用 `AI_TRACE_LOG=1` 後，系統會將 prompt/response/result/error 輸出為 JSONL（`.debug/ai-traces`），便於後續 A/B 對照與效能分析。

## 5. 技術與版本

- Framework：`Next.js 16`（App Router）、`React 19`、`TypeScript`
- Styling / Math：`Tailwind CSS v4`、`KaTeX`、`MathLive`
- Data：`Supabase (PostgreSQL)` + 可選 `pgvector`
- LLM：`DeepSeek Chat Completions`

## 6. 系統路由與 API

### 6.1 前端路由

- `/`：流程入口
- `/diagnostic`：診斷問卷
- `/diagnostic/report`：診斷報告
- `/practice`：練習與導師互動
- `/practice/report`：批次練習回饋
- `/mastery`：掌握追蹤儀表板

### 6.2 後端 API

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

## 7. 可重現性

### 7.1 快速啟動

```bash
npm install
cp .env.example .env.local
npm run dev
```

Windows：

```powershell
copy .env.example .env.local
```

### 7.2 常用命令

| 指令 | 用途 |
|---|---|
| `npm run dev` | 開發模式 |
| `npm run build` / `npm run start` | 建置與啟動 |
| `npm run lint` | 靜態檢查 |
| `npm run table3` | 匯出 topic x difficulty（論文表 3） |
| `npm run embed:backfill` | 回填 embedding |
| `npm run db:fix-backslash` | 修正題庫字串 |

### 7.3 研究附錄文件

研究附錄文件以本機維護為主，clone 後若未看到附錄檔案屬正常情況；常見命名為：

- Prompt 原文彙編：`appendix_prompts.txt`
- 論文 LaTeX 整合稿：`thesis_combined.tex`

## 8. 環境變數摘要

必要：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `DEEPSEEK_API_KEY`（啟用 AI）

常用進階：

- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_QUESTIONS_TABLE`（預設 `vector_questions`）
- `DEEPSEEK_MODEL` / `DEEPSEEK_MODEL_GENERATE` / `DEEPSEEK_MODEL_VALIDATE`
- `AI_VALIDATE_MAX_ROUNDS`
- `AI_TRACE_LOG=1`
- `RAG_TOP_K`

## 9. 已知限制

- 無帳號系統與跨裝置同步（session-based）
- 題庫規模仍可擴充
- LLM 幻覺可被降低但不可完全消除
- L4 為高 AI 比重，非硬性全 AI

## 10. 安全聲明

- `.env.local` 不可提交版本控制
- API 金鑰僅可置於伺服端環境變數
- `inlineQuestion` 為原型期相容機制，正式部署建議採伺服端持久化
