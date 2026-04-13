import type { ClientReport } from "@/lib/report-from-results";

function isLevel(x: unknown): x is ClientReport["overall_level"] {
  return x === "L1" || x === "L2" || x === "L3";
}

function mapStrong(raw: unknown): ClientReport["strong_topics"] {
  if (!Array.isArray(raw)) return [];
  const out: ClientReport["strong_topics"] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    if (typeof o.topic !== "string" || !o.topic.trim()) continue;
    const evidence =
      typeof o.evidence === "string" && o.evidence.trim()
        ? o.evidence.trim()
        : "—";
    out.push({ topic: o.topic.trim(), evidence });
  }
  return out;
}

function mapWeak(raw: unknown): ClientReport["weak_topics"] {
  if (!Array.isArray(raw)) return [];
  const out: ClientReport["weak_topics"] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    if (typeof o.topic !== "string" || !o.topic.trim()) continue;
    const gap =
      typeof o.gap === "string" && o.gap.trim() ? o.gap.trim() : "—";
    const topic_tag =
      typeof o.topic_tag === "string" && o.topic_tag.trim()
        ? o.topic_tag.trim()
        : undefined;
    out.push({ topic: o.topic.trim(), gap, topic_tag });
  }
  return out;
}

/** 將模型 JSON 合併進本機 fallback（欄位無效時保留 fallback） */
export function mergeAiClientReport(raw: unknown, fallback: ClientReport): ClientReport {
  if (!raw || typeof raw !== "object") return fallback;
  const o = raw as Record<string, unknown>;

  const overall_level = isLevel(o.overall_level)
    ? o.overall_level
    : fallback.overall_level;

  let mastery_score = fallback.mastery_score;
  if (typeof o.mastery_score === "number" && Number.isFinite(o.mastery_score)) {
    mastery_score = Math.round(
      Math.min(100, Math.max(0, o.mastery_score)),
    );
  }

  const strongAi = mapStrong(o.strong_topics);
  const weakAi = mapWeak(o.weak_topics);

  const recommended_start_level = isLevel(o.recommended_start_level)
    ? o.recommended_start_level
    : fallback.recommended_start_level;

  const student_summary =
    typeof o.student_summary === "string" && o.student_summary.trim()
      ? o.student_summary.trim()
      : fallback.student_summary;

  const teacher_note =
    typeof o.teacher_note === "string" && o.teacher_note.trim()
      ? o.teacher_note.trim()
      : fallback.teacher_note;

  return {
    overall_level,
    mastery_score,
    strong_topics: strongAi.length ? strongAi : fallback.strong_topics,
    weak_topics: weakAi.length ? weakAi : fallback.weak_topics,
    recommended_start_level,
    student_summary,
    teacher_note,
  };
}
