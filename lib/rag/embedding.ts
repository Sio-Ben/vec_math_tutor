import { readDeepseekApiKey } from "@/lib/ai/deepseek";

type EmbeddingProvider = "openai" | "deepseek";

function provider(): EmbeddingProvider {
  return process.env.EMBEDDING_PROVIDER === "deepseek" ? "deepseek" : "openai";
}

function endpointBase(): string {
  if (provider() === "deepseek") {
    return process.env.DEEPSEEK_API_BASE?.trim().replace(/\/$/, "") || "https://api.deepseek.com";
  }
  return process.env.EMBEDDING_API_BASE?.trim().replace(/\/$/, "") || "https://api.openai.com/v1";
}

function modelName(): string {
  if (provider() === "deepseek") {
    return process.env.EMBEDDING_MODEL?.trim() || "text-embedding-3-small";
  }
  return process.env.EMBEDDING_MODEL?.trim() || "text-embedding-3-small";
}

function apiKey(): string | undefined {
  if (provider() === "deepseek") return readDeepseekApiKey();
  const k = process.env.OPENAI_API_KEY?.trim();
  return k || undefined;
}

export function embeddingConfigured(): boolean {
  return Boolean(apiKey());
}

export async function embedText(input: string): Promise<number[]> {
  const key = apiKey();
  if (!key) {
    throw new Error(
      provider() === "deepseek"
        ? "缺少 DEEPSEEK_API_KEY，無法產生 embedding"
        : "缺少 OPENAI_API_KEY，無法產生 embedding",
    );
  }

  const res = await fetch(`${endpointBase()}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: modelName(),
      input,
    }),
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`embedding HTTP ${res.status}: ${raw.slice(0, 220)}`);
  }

  const data = JSON.parse(raw) as {
    data?: Array<{ embedding?: unknown }>;
  };
  const vec = data.data?.[0]?.embedding;
  if (!Array.isArray(vec) || vec.length === 0) {
    throw new Error("embedding 回傳格式不正確");
  }

  const out = vec.map((x) => Number(x)).filter((n) => Number.isFinite(n));
  if (out.length !== vec.length) {
    throw new Error("embedding 含非數值元素");
  }
  return out;
}

export function toVectorLiteral(vec: number[]): string {
  return `[${vec.map((n) => Number(n).toFixed(8)).join(",")}]`;
}
