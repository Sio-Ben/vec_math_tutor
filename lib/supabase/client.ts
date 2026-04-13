import { createBrowserClient } from "@supabase/ssr";

/**
 * 在 Client Component 使用（瀏覽器）。
 * 需 NEXT_PUBLIC_SUPABASE_URL、NEXT_PUBLIC_SUPABASE_ANON_KEY。
 */
export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) {
    throw new Error(
      "缺少 Supabase 環境變數：請在 .env.local 設定 NEXT_PUBLIC_SUPABASE_URL 與 NEXT_PUBLIC_SUPABASE_ANON_KEY，並重新啟動開發伺服器。",
    );
  }
  return createBrowserClient(url, key);
}
