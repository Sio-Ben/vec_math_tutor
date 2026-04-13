import { NextResponse } from "next/server";
import { readDeepseekApiKey } from "@/lib/ai/deepseek";

/**
 * 僅回傳伺服端是否讀得到 DEEPSEEK_API_KEY（不洩漏金鑰）。
 * 開發時可 GET /api/health/llm 確認練習頁為何顯示「未偵測到 DEEPSEEK_API_KEY」。
 */
export async function GET() {
  const configured = Boolean(readDeepseekApiKey());

  if (!configured) {
    return NextResponse.json({
      deepseekConfigured: false,
      hint: "請在專案根目錄 .env.local 設定 DEEPSEEK_API_KEY（變數名須完全一致），勿註解、勿多空格；修改後務必重啟 npm run dev。若曾只用 ZAI_API_KEY，目前專案不會讀取。",
    });
  }

  return NextResponse.json({
    deepseekConfigured: true,
  });
}
