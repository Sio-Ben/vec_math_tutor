/**
 * RAG（檢索增強生成）在本專案的建議路線（摘要）：
 *
 * 1. **Embedding 管線**：以 `vector_questions.embed_text`（或題幹／講義分塊）呼叫 embedding
 *    API，將向量寫入 `embedding`（Supabase 需啟用 `vector` / pgvector 擴充與維度一致）。
 * 2. **檢索**：伺服端將「學生思路 + 當題關鍵字」轉成 query embedding，用 SQL
 *    `ORDER BY embedding <=> $query::vector LIMIT k` 或自訂 RPC `match_documents`。
 * 3. **組 prompt**：把 Top-K 片段串成文字，傳入 `buildPromptBUser` 的 `ragContext`（僅在
 *    Route Handler / Server Action 內組裝，勿把 service role key 給前端）。
 * 4. **與題庫同步**：新增／改題時重算 embedding；可排程或觸發器批次更新。
 */

export const RAG_PIPELINE_STEP_COUNT = 4;
