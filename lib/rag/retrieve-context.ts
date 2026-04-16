import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseForQuestions } from "@/lib/tutor/load-questions";
import { embedText, embeddingConfigured, toVectorLiteral } from "@/lib/rag/embedding";

type HitRow = {
  id: string;
  topic: string;
  difficulty: string;
  question_text: string;
  explanation: string | null;
  embed_text: string | null;
  score?: number;
};

function table() {
  return process.env.SUPABASE_QUESTIONS_TABLE?.trim() || "vector_questions";
}

function topK() {
  const n = Number(process.env.RAG_TOP_K ?? "3");
  if (!Number.isFinite(n)) return 3;
  return Math.min(8, Math.max(1, Math.floor(n)));
}

function compactText(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function rowToSnippet(row: HitRow): string {
  const title = `題號:${row.id}｜topic:${row.topic}｜難度:${row.difficulty}`;
  const stem = compactText(row.question_text || "");
  const expl = compactText(row.explanation || "");
  return [title, `題幹:${stem}`, expl ? `講解:${expl}` : ""].filter(Boolean).join("\n");
}

/** 不依向量：以題庫 topic 欄硬篩選，適合小題庫與 Phase 1。 */
async function fetchSameTopicRows(
  topicTag: string,
  k: number,
  excludeId?: string | null,
): Promise<HitRow[]> {
  const tag = topicTag.trim();
  if (!tag) return [];
  try {
    const supabase = await getSupabaseForQuestions();
    const { data, error } = await supabase
      .from(table())
      .select("id,topic,difficulty,question_text,explanation,embed_text")
      .eq("topic", tag)
      .limit(Math.min(50, k + 12));
    if (error || !Array.isArray(data)) return [];
    const rows = (data as HitRow[]).filter((r) => r.id !== excludeId);
    return rows.slice(0, k);
  } catch {
    return [];
  }
}

async function vectorSearch(query: string, k: number): Promise<HitRow[]> {
  if (!embeddingConfigured()) return [];
  const supabase = createSupabaseAdminClient();
  const qvec = toVectorLiteral(await embedText(query));
  const { data, error } = await supabase.rpc("match_vector_questions", {
    query_embedding: qvec,
    match_count: k,
  });
  if (error) throw new Error(`RAG RPC 失敗: ${error.message}`);
  if (!Array.isArray(data)) return [];
  return data as HitRow[];
}

async function textFallback(query: string, k: number): Promise<HitRow[]> {
  const like = `%${query.slice(0, 40).replace(/[%_]/g, "")}%`;
  if (!like || like === "%%") return [];
  try {
    const supabase = await getSupabaseForQuestions();
    const { data, error } = await supabase
      .from(table())
      .select("id,topic,difficulty,question_text,explanation,embed_text")
      .or(`embed_text.ilike.${like},question_text.ilike.${like}`)
      .limit(k);
    if (error || !Array.isArray(data)) return [];
    return data as HitRow[];
  } catch {
    return [];
  }
}

function hitsToContext(hits: HitRow[]): string {
  return hits.map((h, i) => `#${i + 1}\n${rowToSnippet(h)}`).join("\n\n");
}

export async function retrieveRagContext(input: {
  studentThought: string;
  questionTopic: string;
  questionStem: string;
  /** 與題庫 `topic` 欄一致時，優先取同 topic 小集合（無需向量）。 */
  topicTag?: string | null;
  excludeQuestionId?: string | null;
}): Promise<string | undefined> {
  const k = topK();

  const structural = await fetchSameTopicRows(
    input.topicTag ?? "",
    k,
    input.excludeQuestionId,
  );
  if (structural.length > 0) return hitsToContext(structural);

  const query = compactText(
    `${input.questionTopic} ${input.questionStem} ${input.studentThought}`,
  );
  if (!query) return undefined;

  try {
    const hits = await vectorSearch(query, k);
    if (hits.length > 0) return hitsToContext(hits);
  } catch {
    // RPC 未建立或 embedding 暫不可用時，降級文字檢索
  }

  const fallback = await textFallback(query, k);
  if (fallback.length === 0) return undefined;
  return hitsToContext(fallback);
}
