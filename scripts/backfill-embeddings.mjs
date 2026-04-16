import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const TABLE = process.env.SUPABASE_QUESTIONS_TABLE || "vector_questions";
const MODEL = process.env.EMBEDDING_MODEL || "text-embedding-3-small";
const BATCH = Number(process.env.EMBEDDING_BATCH || "20");

if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error("缺少 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY");
}
if (!OPENAI_API_KEY) {
  throw new Error("缺少 OPENAI_API_KEY（用於 embedding）");
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function buildEmbedText(row) {
  if (row.embed_text && row.embed_text.trim()) return row.embed_text.trim();
  return [
    `topic:${row.topic || ""}`,
    `difficulty:${row.difficulty || ""}`,
    `question:${row.question_text || ""}`,
    row.explanation ? `explanation:${row.explanation}` : "",
  ]
    .filter(Boolean)
    .join("\n")
    .trim();
}

async function embed(input) {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model: MODEL, input }),
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(`OpenAI embedding 失敗: ${res.status} ${raw.slice(0, 220)}`);
  const data = JSON.parse(raw);
  const vec = data?.data?.[0]?.embedding;
  if (!Array.isArray(vec) || vec.length === 0) {
    throw new Error("embedding 回傳格式錯誤");
  }
  return `[${vec.map((n) => Number(n).toFixed(8)).join(",")}]`;
}

async function main() {
  let offset = 0;
  let processed = 0;
  console.log(`[embed] table=${TABLE}, batch=${BATCH}, model=${MODEL}`);

  while (true) {
    const { data, error } = await supabase
      .from(TABLE)
      .select("id, topic, difficulty, question_text, explanation, embed_text, embedding")
      .order("id")
      .range(offset, offset + BATCH - 1);

    if (error) throw new Error(`讀取資料失敗: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const row of data) {
      if (row.embedding) continue;
      const text = buildEmbedText(row);
      if (!text) continue;
      const vec = await embed(text);
      const { error: upErr } = await supabase
        .from(TABLE)
        .update({ embed_text: text, embedding: vec })
        .eq("id", row.id);
      if (upErr) {
        console.error(`[embed] 更新失敗 id=${row.id}: ${upErr.message}`);
        continue;
      }
      processed += 1;
      console.log(`[embed] updated ${row.id}`);
    }

    offset += data.length;
  }

  console.log(`[embed] done. updated=${processed}`);
}

main().catch((e) => {
  console.error("[embed] fatal:", e.message || e);
  process.exit(1);
});
