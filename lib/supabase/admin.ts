import { createClient } from "@supabase/supabase-js";

/**
 * 僅在 Route Handler / Server Action 等伺服端使用，繞過 RLS。
 * 需在 .env.local 設定 SUPABASE_SERVICE_ROLE_KEY；切勿暴露給前端。
 */
export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceRole) {
    throw new Error(
      "缺少 SUPABASE_SERVICE_ROLE_KEY 或 NEXT_PUBLIC_SUPABASE_URL（僅伺服端使用）",
    );
  }
  return createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
