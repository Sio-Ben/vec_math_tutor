-- =============================================================================
-- vector_questions：RLS 已開啟但「沒有任何 policy」時，anon 無法 SELECT
-- 在 Supabase → SQL Editor 整段貼上執行一次即可。
-- =============================================================================
--
-- 說明：
-- - 「開 RLS + 零條 policy」= 沒人被允許通過 RLS，查詢常回 0 筆。
-- - 下列建立一條「匿名（anon）可讀整張表」的 policy，適合題庫完全公開的情境。
-- - 若題庫不應公開：不要執行 anon 這條，改在 .env.local 使用 SUPABASE_SERVICE_ROLE_KEY，
--   讓 Next 伺服端用 service role 讀表（會繞過 RLS）；或改用「僅 authenticated 可讀」policy。
-- =============================================================================

alter table public.vector_questions enable row level security;

drop policy if exists "vector_questions_select_anon" on public.vector_questions;

create policy "vector_questions_select_anon"
  on public.vector_questions
  for select
  to anon
  using (true);

-- ---------------------------------------------------------------------------
-- 可選：已登入使用者也可讀（與 anon 並存；若題庫只給會員看可「只保留」這一段、刪掉上面 anon）
-- ---------------------------------------------------------------------------
-- drop policy if exists "vector_questions_select_authenticated" on public.vector_questions;
--
-- create policy "vector_questions_select_authenticated"
--   on public.vector_questions
--   for select
--   to authenticated
--   using (true);
