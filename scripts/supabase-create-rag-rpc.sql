-- ============================================================================
-- 建立向量檢索 RPC：match_vector_questions
-- 需求：public.vector_questions 已有 embedding vector 欄位，且已啟用 pgvector
-- ============================================================================

create extension if not exists vector;

create or replace function public.match_vector_questions(
  query_embedding vector,
  match_count int default 3
)
returns table (
  id text,
  topic text,
  difficulty text,
  question_text text,
  explanation text,
  embed_text text,
  score float8
)
language sql
stable
as $$
  select
    q.id,
    q.topic,
    q.difficulty,
    q.question_text,
    q.explanation,
    q.embed_text,
    1 - (q.embedding <=> query_embedding) as score
  from public.vector_questions q
  where q.embedding is not null
  order by q.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;

-- 若你有 RLS，RPC 仍會遵守權限；建議用 service role 在伺服端呼叫
