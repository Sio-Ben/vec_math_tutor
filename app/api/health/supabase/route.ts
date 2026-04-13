import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * 僅回傳是否連得上 Supabase，不回傳任何金鑰或敏感資料。
 * 開發時可 GET /api/health/supabase 自測。
 */
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !key) {
    return NextResponse.json(
      {
        ok: false,
        reason: "missing_env",
        message: "請在 .env.local 設定 NEXT_PUBLIC_SUPABASE_URL 與 NEXT_PUBLIC_SUPABASE_ANON_KEY",
      },
      { status: 503 },
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.getSession();
    if (error) {
      return NextResponse.json({
        ok: true,
        client: "supabase_js_initialized",
        authProbe: "getSession_returned_error",
        note: error.message,
      });
    }
    return NextResponse.json({
      ok: true,
      client: "supabase_js_initialized",
      authProbe: "getSession_ok",
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        reason: "client_error",
        message: e instanceof Error ? e.message : String(e),
      },
      { status: 503 },
    );
  }
}
