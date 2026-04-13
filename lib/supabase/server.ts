import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * 在 Server Component、Route Handler、Server Action 使用。
 * 會讀寫 Cookie 以配合 Auth 工作階段（若你之後啟用登入）。
 */
export async function createSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) {
    throw new Error(
      "缺少 Supabase 環境變數：請在專案根目錄的 .env.local 設定 NEXT_PUBLIC_SUPABASE_URL 與 NEXT_PUBLIC_SUPABASE_ANON_KEY，存檔後重新執行 npm run dev（部署環境則在平台後台設定同名變數）。",
    );
  }

  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // 在純 Server Component 等無法寫入 Set-Cookie 的情境下略過
        }
      },
    },
  });
}
