/**
 * DeepSeek OpenAI 相容 Chat Completions（Bearer）。
 * @see https://api-docs.deepseek.com/
 */

const DEFAULT_BASE = "https://api.deepseek.com";
const DEFAULT_MODEL = "deepseek-chat";

function normalizeApiKey(raw: string | undefined): string | undefined {
  if (raw == null) return undefined;
  let k = raw.replace(/^\uFEFF/, "").trim();
  if (
    (k.startsWith('"') && k.endsWith('"')) ||
    (k.startsWith("'") && k.endsWith("'"))
  ) {
    k = k.slice(1, -1).trim();
  }
  return k || undefined;
}

export function readDeepseekApiKey(): string | undefined {
  return normalizeApiKey(process.env.DEEPSEEK_API_KEY);
}

export type DeepseekChatConfig = {
  key: string;
  base: string;
  model: string;
};

export function getDeepseekChatConfig(): DeepseekChatConfig | null {
  const key = readDeepseekApiKey();
  if (!key) return null;
  return {
    key,
    base:
      process.env.DEEPSEEK_API_BASE?.replace(/\/$/, "").trim() || DEFAULT_BASE,
    model: process.env.DEEPSEEK_MODEL?.trim() || DEFAULT_MODEL,
  };
}

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type DeepseekChatOptions = {
  jsonObject?: boolean;
  temperature?: number;
  model?: string;
};

export async function deepseekChat(
  messages: ChatMessage[],
  options?: DeepseekChatOptions,
): Promise<string> {
  const cfg = getDeepseekChatConfig();
  if (!cfg) {
    throw new Error("缺少 DEEPSEEK_API_KEY：請在 .env.local 設定");
  }

  const body: Record<string, unknown> = {
    model: options?.model?.trim() || cfg.model,
    messages,
    temperature: options?.temperature ?? 0.4,
  };
  if (options?.jsonObject) {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch(`${cfg.base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.key}`,
    },
    body: JSON.stringify(body),
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`DeepSeek HTTP ${res.status}: ${raw.slice(0, 500)}`);
  }
  let data: { choices?: { message?: { content?: string } }[] };
  try {
    data = JSON.parse(raw) as typeof data;
  } catch {
    throw new Error("DeepSeek 回傳非 JSON");
  }
  const text = data.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("DeepSeek 回傳內容為空");
  }
  return text;
}
