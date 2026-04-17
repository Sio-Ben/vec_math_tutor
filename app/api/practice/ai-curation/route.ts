import { NextResponse } from "next/server";
import { deepseekChat, getDeepseekChatConfig } from "@/lib/ai/deepseek";
import { coerceLlMQuestionRows } from "@/lib/ai/coerce-llm-question-bank";
import { parseJsonFromModelText } from "@/lib/ai/parse-model-json";
import {
  buildPracticeGenerateUser,
  buildPracticeOrderUser,
  PRACTICE_GENERATE_SYSTEM,
  PRACTICE_ORDER_SYSTEM,
} from "@/lib/ai/prompt-practice-curation";
import { reorderQuestionsByIds } from "@/lib/ai/practice-order-utils";
import { stemToPlainWithLatex } from "@/lib/ai/prompt-b";
import { retrieveRagContext } from "@/lib/rag/retrieve-context";
import type { ClientReport } from "@/lib/report-from-results";
import {
  reportCandidatePool,
  weakTopicTagsFromReport,
} from "@/lib/practice/report-candidate-pool";
import { bankRowToPracticeQuestion } from "@/lib/tutor/question-bank";
import type { PracticeQuestion } from "@/lib/tutor/practice-questions";
import type { MasteryReportV2 } from "@/lib/progress/types";

export const runtime = "nodejs";

type Body = {
  report?: ClientReport | null;
  masterySummary?: Pick<
    MasteryReportV2,
    "topicScores" | "recommendedTopicOrder" | "recommendedDifficulty"
  > | null;
  questions: PracticeQuestion[];
  options?: {
    minWeakTopicCoverage?: number;
    minTotalQuestions?: number;
    maxGenerate?: number;
  };
};

function normalizeTargetLevel(v: unknown): "L1" | "L2" | "L3" | "L4" | null {
  if (v === "L1" || v === "L2" || v === "L3" || v === "L4") return v;
  return null;
}

function countWeakMatches(
  questions: PracticeQuestion[],
  weakTags: string[],
): number {
  if (!weakTags.length) return questions.length;
  return questions.filter((q) =>
    weakTags.some((t) => q.topicTag === t),
  ).length;
}

function splitByTargetLevel(
  questions: PracticeQuestion[],
  targetLevel: "L1" | "L2" | "L3" | "L4" | null,
): { preferred: PracticeQuestion[]; others: PracticeQuestion[] } {
  if (!targetLevel) return { preferred: questions, others: [] };
  const preferred = questions.filter((q) => q.difficulty === targetLevel);
  const others = questions.filter((q) => q.difficulty !== targetLevel);
  return { preferred, others };
}

function catalogForOrder(questions: PracticeQuestion[]) {
  return questions.map((q) => ({
    id: q.id,
    topic_tag: q.topicTag ?? null,
    difficulty: q.difficulty ?? null,
    kind: q.kind,
    stem_preview: stemToPlainWithLatex(q).slice(0, 140),
  }));
}

function sampleRowsFromQuestions(questions: PracticeQuestion[], n: number) {
  return questions.slice(0, n).map((q) => {
    const stem = stemToPlainWithLatex(q);
    if (q.kind === "mcq") {
      return {
        type: "選擇題",
        difficulty: q.difficulty ?? "L2",
        topic: q.topicTag ?? "synthesis",
        question_text: stem.slice(0, 400),
        option_a: q.options.find((o) => o.key === "A")?.latex ?? null,
        option_b: q.options.find((o) => o.key === "B")?.latex ?? null,
        option_c: q.options.find((o) => o.key === "C")?.latex ?? null,
        option_d: q.options.find((o) => o.key === "D")?.latex ?? null,
        answer: q.correctKey,
        hint1: q.hintSteps[0] ?? null,
        hint2: q.hintSteps[1] ?? null,
        hint3: q.hintSteps[2] ?? null,
      };
    }
    return {
      type: "填空題",
      difficulty: q.difficulty ?? "L2",
      topic: q.topicTag ?? "synthesis",
      question_text: stem.slice(0, 400),
      option_a: null,
      option_b: null,
      option_c: null,
      option_d: null,
      answer: q.fillAnswer,
      hint1: q.hintSteps[0] ?? null,
      hint2: q.hintSteps[1] ?? null,
      hint3: q.hintSteps[2] ?? null,
    };
  });
}

function isMcqType(typeRaw: string): boolean {
  const t = typeRaw.trim().toLowerCase();
  return t === "選擇題" || t === "mcq";
}

function balanceGeneratedRows(rows: ReturnType<typeof coerceLlMQuestionRows>) {
  if (rows.length < 2) return rows;
  const mcq = rows.filter((r) => isMcqType(r.type));
  const fill = rows.filter((r) => !isMcqType(r.type));
  if (mcq.length === 0 || fill.length === 0) return rows;
  return [...mcq, ...fill];
}

function isValidPermutation(
  orderedIds: string[],
  catalogIds: Set<string>,
): boolean {
  if (orderedIds.length !== catalogIds.size) return false;
  const seen = new Set<string>();
  for (const id of orderedIds) {
    if (!catalogIds.has(id) || seen.has(id)) return false;
    seen.add(id);
  }
  return true;
}

function uniqueAiQuestionId(index: number): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `ai-gen-${crypto.randomUUID()}-${index}`;
  }
  return `ai-gen-${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${index}`;
}

async function buildGenerationRagContext(
  weakTags: string[],
  samples: ReturnType<typeof sampleRowsFromQuestions>,
  report: ClientReport,
): Promise<string | undefined> {
  const prompts: Array<{ topicTag?: string; questionStem: string }> = [];
  for (const t of weakTags.slice(0, 2)) {
    prompts.push({ topicTag: t, questionStem: `${t} 練習題` });
  }
  for (const s of samples.slice(0, 2)) {
    prompts.push({
      topicTag: typeof s.topic === "string" ? s.topic : undefined,
      questionStem: String(s.question_text ?? "").slice(0, 140),
    });
  }
  const contexts = await Promise.all(
    prompts.map((p) =>
      retrieveRagContext({
        studentThought: report.student_summary ?? "",
        questionTopic: p.topicTag ?? "synthesis",
        questionStem: p.questionStem,
        topicTag: p.topicTag,
      }).catch(() => undefined),
    ),
  );
  const uniq = [...new Set(contexts.filter((c): c is string => Boolean(c?.trim())))];
  if (uniq.length === 0) return undefined;
  return uniq.slice(0, 2).join("\n\n---\n\n");
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "無效 JSON" }, { status: 400 });
  }

  const incoming = Array.isArray(body.questions) ? body.questions : [];
  const report = body.report ?? null;
  const masterySummary = body.masterySummary ?? null;
  const targetLevel =
    normalizeTargetLevel(masterySummary?.recommendedDifficulty) ??
    report?.recommended_start_level ??
    null;
  const minWeak = body.options?.minWeakTopicCoverage ?? 1;
  const minTotal = Math.max(5, body.options?.minTotalQuestions ?? 5);
  const maxGen = Math.max(1, body.options?.maxGenerate ?? 20);

  const meta: {
    orderedByAi: boolean;
    generatedCount: number;
    orderRationale?: string | null;
    designNote?: string | null;
    skippedReason?: string;
    /** 本輪補題是否成功注入 RAG 片段（字元數 > 0） */
    ragContextUsed?: boolean;
    ragContextChars?: number;
  } = {
    orderedByAi: false,
    generatedCount: 0,
  };

  if (!getDeepseekChatConfig()) {
    meta.skippedReason = "no_deepseek_key";
    return NextResponse.json({ questions: incoming, meta });
  }

  if (!report) {
    meta.skippedReason = "no_report";
    return NextResponse.json({ questions: incoming, meta });
  }

  let pool = reportCandidatePool(incoming, report);
  if (pool.length === 0) pool = [...incoming];
  const poolIds = new Set(pool.map((q) => q.id));
  const tail = incoming.filter((q) => !poolIds.has(q.id));
  let qs = [...pool];

  try {
    if (qs.length > 0) {
      const catalog = catalogForOrder(qs);
      const catalogIds = catalog.map((c) => c.id);
      const idSet = new Set(catalogIds);
      const orderText = await deepseekChat(
        [
          { role: "system", content: PRACTICE_ORDER_SYSTEM },
          {
            role: "user",
            content: buildPracticeOrderUser({
              reportJson: JSON.stringify(report),
              masteryJson: JSON.stringify(masterySummary),
              catalogJson: JSON.stringify(catalog),
              catalogIds,
            }),
          },
        ],
        { jsonObject: true, temperature: 0.25 },
      );
      const orderParsed = parseJsonFromModelText(orderText) as {
        ordered_ids?: unknown;
        rationale?: string;
      };
      const orderedIds = Array.isArray(orderParsed.ordered_ids)
        ? orderParsed.ordered_ids.filter((x): x is string => typeof x === "string")
        : [];
      if (isValidPermutation(orderedIds, idSet)) {
        qs = reorderQuestionsByIds(qs, orderedIds);
        meta.orderedByAi = true;
        meta.orderRationale =
          typeof orderParsed.rationale === "string"
            ? orderParsed.rationale.slice(0, 500)
            : null;
      }
    }

    qs = [...qs, ...tail];
    let others: PracticeQuestion[] = [];
    if (targetLevel) {
      const split = splitByTargetLevel(qs, targetLevel);
      qs = split.preferred;
      others = split.others;
    }

    const weakTags = weakTopicTagsFromReport(report);
    const weakMatches = countWeakMatches(qs, weakTags);
    const hasAiQuestion = qs.some((q) => q.source === "ai");
    const needGen =
      qs.length === 0 ||
      qs.length < minTotal ||
      (weakTags.length > 0 && weakMatches < minWeak) ||
      !hasAiQuestion;

    if (needGen) {
      const shortage = Math.max(0, minTotal - qs.length);
      const generateCount = Math.min(
        maxGen,
        Math.max(!hasAiQuestion ? 2 : 0, shortage),
      );
      if (generateCount <= 0) {
        if (others.length > 0) qs = [...qs, ...others];
        return NextResponse.json({ questions: qs, meta });
      }
      const samples = sampleRowsFromQuestions(
        pool.length > 0 ? pool : incoming,
        3,
      );
      const ragContext = await buildGenerationRagContext(weakTags, samples, report);
      const ragTrim = ragContext?.trim() ?? "";
      meta.ragContextUsed = ragTrim.length > 0;
      meta.ragContextChars = ragTrim.length;
      const genText = await deepseekChat(
        [
          { role: "system", content: PRACTICE_GENERATE_SYSTEM },
          {
            role: "user",
            content: buildPracticeGenerateUser({
              reportJson: JSON.stringify(report),
              masteryJson: JSON.stringify(masterySummary),
              sampleRowsJson: JSON.stringify(samples),
              ragContext,
              weakTopicTags: weakTags,
              generateCount,
            }),
          },
        ],
        { jsonObject: true, temperature: 0.38 },
      );
      const genParsed = parseJsonFromModelText(genText);
      const genObj =
        genParsed && typeof genParsed === "object"
          ? (genParsed as Record<string, unknown>)
          : {};
      const rows = balanceGeneratedRows(coerceLlMQuestionRows(genParsed));
      const generated: PracticeQuestion[] = [];
      for (const [i, row] of rows.entries()) {
        try {
          const adjustedRow = targetLevel
            ? { ...row, difficulty: targetLevel, id: uniqueAiQuestionId(i) }
            : { ...row, id: uniqueAiQuestionId(i) };
          generated.push({ ...bankRowToPracticeQuestion(adjustedRow), source: "ai" });
        } catch {
          /* skip bad row */
        }
      }
      meta.generatedCount = generated.length;
      meta.designNote =
        typeof genObj.design_note === "string"
          ? genObj.design_note.slice(0, 500)
          : null;

      if (generated.length > 0) {
        const genIds = new Set(generated.map((g) => g.id));
        const rest = qs.filter((q) => !genIds.has(q.id));
        // 練習頁每批只做前 5 題：AI 題必須置前，否則 meta.generatedCount > 0
        // 但使用者本組只會看到題庫題，與橫幅說明不符。
        qs = [...generated, ...rest];
      }
    }
    if (others.length > 0) {
      qs = [...qs, ...others];
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[practice/ai-curation]", msg);
    return NextResponse.json(
      {
        questions: incoming,
        meta: { ...meta, error: msg.slice(0, 300) },
      },
      { status: 200 },
    );
  }

  return NextResponse.json({ questions: qs, meta });
}
