# 基於大語言模型的向量智能教學助手

面向澳門高中「平面向量」單元的 AI 教學原型，核心目標是 **引導思考而非直接代答**。  
系統主軸為：

`診斷 -> 練習 -> Socratic 對話 -> 批次回饋 -> 掌握追蹤`

---

## 研究與工程重點

- **策略**：演算法主控、AI 輔助（規則決策優先，AI 給語意建議）
- **選題**：`selected_ids` Top-k 子集輸出（主路徑），相容舊版 `ordered_ids`
- **命題**：Generate + Validate 雙階段，降低幻覺與格式錯誤風險
- **降級**：RAG 三層後備（topic -> pgvector -> ILIKE）
- **可觀測**：`AI_TRACE_LOG=1` 輸出 JSONL 追蹤 prompt/response/result/error

---

## 技術棧

- `Next.js 16`（App Router）
- `React 19` + `TypeScript`
- `Tailwind CSS v4`
- `MathLive` + `KaTeX`
- `Supabase (PostgreSQL)` + 選配 `pgvector`
- `DeepSeek Chat Completions`

---

## 主要路由

- `/`：首頁
- `/diagnostic`：診斷問卷
- `/diagnostic/report`：診斷結果
- `/practice`：練習與導師互動
- `/practice/report`：批次回饋
- `/mastery`：掌握追蹤

---

## 主要 API

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

---

## 快速啟動

```bash
npm install
cp .env.example .env.local
npm run dev
```

Windows:

```powershell
copy .env.example .env.local
```

---

## 常用指令

- `npm run dev`：開發模式
- `npm run build`：生產建置
- `npm run start`：啟動 production
- `npm run lint`：靜態檢查
- `npm run table3`：輸出 topic x difficulty（論文表 3）
- `npm run embed:backfill`：回填 embedding
- `npm run db:fix-backslash`：修復題庫字串

---

## MathLive 輸入行為（目前設定）

為改善中文輸入體驗，練習頁思路欄位採以下設定：

- 使用 `MathLive` 的 `text` 起始模式（避免整段數式化）
- 關閉 `smartMode`（減少不必要自動推斷）
- 統一中文字體為網站主字體（`Noto Sans TC`）
- 調整 selection/highlight 顏色，降低輸入中干擾

> 註：中文輸入法（IME）在「尚未選字」時的組字標記屬系統層行為，可能仍顯示暫時高亮。

---

## 環境變數

必要：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `DEEPSEEK_API_KEY`

常用進階：

- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_QUESTIONS_TABLE`（預設 `vector_questions`）
- `DEEPSEEK_MODEL`
- `DEEPSEEK_MODEL_GENERATE`
- `DEEPSEEK_MODEL_VALIDATE`
- `AI_VALIDATE_MAX_ROUNDS`
- `AI_TRACE_LOG=1`
- `RAG_TOP_K`

---

## 研究附錄（本機常見命名）

以下文件通常為本機維護，clone 後未必存在：

- `appendix_prompts.txt`
- `thesis_combined.tex`

---

## 安全提醒

- `.env.local` 不應提交到版本控制
- 金鑰只放伺服端環境變數
- trace 檔（`.debug/ai-traces/*.jsonl`）可能含敏感內容，請妥善管理
