import { NextResponse } from "next/server";
import { deepseekChat, getDeepseekChatConfig } from "@/lib/ai/deepseek";
import { coerceLlMQuestionRows } from "@/lib/ai/coerce-llm-question-bank";
import { parseJsonFromModelText } from "@/lib/ai/parse-model-json";
import {
  buildPracticeGenerateUser,
  buildPracticeOrderUser,
  buildPracticeValidateUser,
  PRACTICE_GENERATE_SYSTEM,
  PRACTICE_ORDER_SYSTEM,
  PRACTICE_VALIDATE_SYSTEM,
} from "@/lib/ai/prompt-practice-curation";
import { reorderQuestionsByIds } from "@/lib/ai/practice-order-utils";
import { stemToPlainWithLatex } from "@/lib/ai/prompt-b";
import { retrieveRagContext } from "@/lib/rag/retrieve-context";
import { logAiTrace } from "@/lib/ai/trace-logger";
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

type InvalidReasonCode =
  | "ANSWER_MISMATCH"
  | "OPTIONS_DUPLICATE"
  | "STEM_OPTION_CONTRADICTION"
  | "UNSOLVABLE_OR_NO_VALID_CHOICE"
  | "FORMAT_INVALID";

type ValidateParsed = {
  valid_questions?: unknown[];
  invalid?: Array<{ id?: unknown; reason_code?: unknown; reason_detail?: unknown }>;
  summary?: { total?: unknown; valid_count?: unknown; invalid_count?: unknown };
};

function readPositiveInt(raw: string | undefined, fallback: number, min = 1, max = 5): number {
  const n = Number(raw ?? "");
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

function parseInvalidReasonCode(v: unknown): InvalidReasonCode {
  return v === "ANSWER_MISMATCH" ||
    v === "OPTIONS_DUPLICATE" ||
    v === "STEM_OPTION_CONTRADICTION" ||
    v === "UNSOLVABLE_OR_NO_VALID_CHOICE" ||
    v === "FORMAT_INVALID"
    ? v
    : "FORMAT_INVALID";
}

function normalizeInvalidStats(
  invalid: Array<{ reason_code?: unknown }>,
): Record<InvalidReasonCode, number> {
  const base: Record<InvalidReasonCode, number> = {
    ANSWER_MISMATCH: 0,
    OPTIONS_DUPLICATE: 0,
    STEM_OPTION_CONTRADICTION: 0,
    UNSOLVABLE_OR_NO_VALID_CHOICE: 0,
    FORMAT_INVALID: 0,
  };
  for (const row of invalid) {
    const code = parseInvalidReasonCode(row.reason_code);
    base[code] += 1;
  }
  return base;
}

function mergeReasonStats(
  acc: Record<InvalidReasonCode, number>,
  add: Record<InvalidReasonCode, number>,
): Record<InvalidReasonCode, number> {
  return {
    ANSWER_MISMATCH: acc.ANSWER_MISMATCH + add.ANSWER_MISMATCH,
    OPTIONS_DUPLICATE: acc.OPTIONS_DUPLICATE + add.OPTIONS_DUPLICATE,
    STEM_OPTION_CONTRADICTION: acc.STEM_OPTION_CONTRADICTION + add.STEM_OPTION_CONTRADICTION,
    UNSOLVABLE_OR_NO_VALID_CHOICE:
      acc.UNSOLVABLE_OR_NO_VALID_CHOICE + add.UNSOLVABLE_OR_NO_VALID_CHOICE,
    FORMAT_INVALID: acc.FORMAT_INVALID + add.FORMAT_INVALID,
  };
}

function safeParseModelJson(text: string): unknown {
  try {
    return parseJsonFromModelText(text);
  } catch {
    return null;
  }
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
  const forceAiBatch = targetLevel === "L4";
  const minWeak = body.options?.minWeakTopicCoverage ?? 1;
  const minTotal = Math.max(5, body.options?.minTotalQuestions ?? 5);
  const maxGen = Math.max(1, body.options?.maxGenerate ?? 20);
  const maxValidateRounds = readPositiveInt(process.env.AI_VALIDATE_MAX_ROUNDS, 2, 1, 4);
  const generateModel =
    process.env.DEEPSEEK_MODEL_GENERATE?.trim() || process.env.DEEPSEEK_MODEL?.trim() || undefined;
  const validateModel = process.env.DEEPSEEK_MODEL_VALIDATE?.trim() || "deepseek-chat";

  const meta: {
    orderedByAi: boolean;
    generatedCount: number;
    orderRationale?: string | null;
    designNote?: string | null;
    skippedReason?: string;
    /** 本輪補題是否成功注入 RAG 片段（字元數 > 0） */
    ragContextUsed?: boolean;
    ragContextChars?: number;
    validationRounds?: number;
    validatedCount?: number;
    invalidCount?: number;
    invalidReasonStats?: Record<InvalidReasonCode, number>;
    fallbackCount?: number;
    targetLevel?: "L1" | "L2" | "L3" | "L4" | null;
    l4Mode?: boolean;
    l4AiCoverage?: number;
    l4FallbackRate?: number;
    validationRejectRate?: number;
    l4Policy?: "soft_ai_priority";
  } = {
    orderedByAi: false,
    generatedCount: 0,
    targetLevel,
    l4Mode: forceAiBatch,
    l4Policy: "soft_ai_priority",
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
      await logAiTrace({
        route: "/api/practice/ai-curation",
        phase: "prompt",
        meta: { step: "order" },
        payload: {
          reportJson: report,
          masteryJson: masterySummary,
          catalogJson: catalog,
          catalogIds,
        },
      });
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
      await logAiTrace({
        route: "/api/practice/ai-curation",
        phase: "response",
        meta: { step: "order", rawChars: orderText.length },
        payload: orderText,
      });
      const orderParsed = safeParseModelJson(orderText) as {
        ordered_ids?: unknown;
        rationale?: string;
      };
      await logAiTrace({
        route: "/api/practice/ai-curation",
        phase: "result",
        meta: { step: "order", parsed: true },
        payload: orderParsed,
      });
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
      forceAiBatch ||
      qs.length === 0 ||
      qs.length < minTotal ||
      (weakTags.length > 0 && weakMatches < minWeak) ||
      !hasAiQuestion;

    if (needGen) {
      const shortage = Math.max(0, minTotal - qs.length);
      const targetGenerateCount = Math.min(
        maxGen,
        forceAiBatch
          ? Math.max(5, minTotal)
          : Math.max(!hasAiQuestion ? 2 : 0, shortage),
      );
      if (targetGenerateCount <= 0) {
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
      let rounds = 0;
      let invalidCount = 0;
      let reviewedCount = 0;
      let reasonStats: Record<InvalidReasonCode, number> = {
        ANSWER_MISMATCH: 0,
        OPTIONS_DUPLICATE: 0,
        STEM_OPTION_CONTRADICTION: 0,
        UNSOLVABLE_OR_NO_VALID_CHOICE: 0,
        FORMAT_INVALID: 0,
      };
      let fallbackCount = 0;
      const accepted: PracticeQuestion[] = [];
      const acceptedIds = new Set<string>();
      while (accepted.length < targetGenerateCount && rounds < maxValidateRounds) {
        rounds += 1;
        const missingCount = targetGenerateCount - accepted.length;
        await logAiTrace({
          route: "/api/practice/ai-curation",
          phase: "prompt",
          meta: { step: "generate", round: rounds, missingCount },
          payload: {
            reportJson: report,
            masteryJson: masterySummary,
            sampleRowsJson: samples,
            weakTopicTags: weakTags,
            generateCount: missingCount,
            ragContext,
          },
        });
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
                generateCount: missingCount,
              }),
            },
          ],
          { jsonObject: true, temperature: 0.3, model: generateModel },
        );
        await logAiTrace({
          route: "/api/practice/ai-curation",
          phase: "response",
          meta: { step: "generate", round: rounds, rawChars: genText.length },
          payload: genText,
        });
        const genParsed = safeParseModelJson(genText);
        const genObj =
          genParsed && typeof genParsed === "object"
            ? (genParsed as Record<string, unknown>)
            : {};
        if (!meta.designNote && typeof genObj.design_note === "string") {
          meta.designNote = genObj.design_note.slice(0, 500);
        }
        const rows = balanceGeneratedRows(coerceLlMQuestionRows(genParsed));
        const generatedRows = rows.map((row, i) =>
          targetLevel
            ? {
                ...row,
                difficulty: targetLevel,
                id: uniqueAiQuestionId(rounds * 1000 + i),
              }
            : {
                ...row,
                id: uniqueAiQuestionId(rounds * 1000 + i),
              },
        );
        await logAiTrace({
          route: "/api/practice/ai-curation",
          phase: "prompt",
          meta: { step: "validate", round: rounds, candidateCount: generatedRows.length },
          payload: {
            reportJson: report,
            masteryJson: masterySummary,
            questionsJson: generatedRows,
          },
        });
        const validateText = await deepseekChat(
          [
            { role: "system", content: PRACTICE_VALIDATE_SYSTEM },
            {
              role: "user",
              content: buildPracticeValidateUser({
                reportJson: JSON.stringify(report),
                masteryJson: JSON.stringify(masterySummary),
                questionsJson: JSON.stringify(generatedRows),
              }),
            },
          ],
          { jsonObject: true, temperature: 0.1, model: validateModel },
        );
        await logAiTrace({
          route: "/api/practice/ai-curation",
          phase: "response",
          meta: { step: "validate", round: rounds, rawChars: validateText.length },
          payload: validateText,
        });
        const validateParsed = safeParseModelJson(validateText) as ValidateParsed;
        const validRowsRaw = Array.isArray(validateParsed.valid_questions)
          ? validateParsed.valid_questions
          : [];
        const invalidRowsRaw = Array.isArray(validateParsed.invalid) ? validateParsed.invalid : [];
        reviewedCount += generatedRows.length;
        reasonStats = mergeReasonStats(reasonStats, normalizeInvalidStats(invalidRowsRaw));
        const validIds = new Set(
          validRowsRaw
            .map((r) =>
              r && typeof r === "object" && typeof (r as Record<string, unknown>).id === "string"
                ? String((r as Record<string, unknown>).id)
                : "",
            )
            .filter(Boolean),
        );
        const invalidIds = new Set(
          invalidRowsRaw
            .map((r) => (typeof r.id === "string" ? r.id : ""))
            .filter(Boolean),
        );
        for (const row of generatedRows) {
          if (!validIds.has(row.id)) {
            if (!invalidIds.has(row.id)) {
              reasonStats.FORMAT_INVALID += 1;
            }
            invalidCount += 1;
            continue;
          }
          if (acceptedIds.has(row.id)) continue;
          try {
            const q = { ...bankRowToPracticeQuestion(row), source: "ai" as const };
            accepted.push(q);
            acceptedIds.add(row.id);
          } catch {
            invalidCount += 1;
            reasonStats.FORMAT_INVALID += 1;
          }
        }
        await logAiTrace({
          route: "/api/practice/ai-curation",
          phase: "result",
          meta: {
            step: "validate",
            round: rounds,
            validCount: validIds.size,
            invalidCount: invalidRowsRaw.length,
          },
          payload: validateParsed,
        });
      }
      fallbackCount = Math.max(0, targetGenerateCount - accepted.length);
      meta.validationRounds = rounds;
      meta.validatedCount = accepted.length;
      meta.invalidCount = invalidCount;
      meta.invalidReasonStats = reasonStats;
      meta.fallbackCount = fallbackCount;
      meta.generatedCount = accepted.length;
      meta.validationRejectRate =
        reviewedCount > 0
          ? Math.max(
              0,
              Math.min(1, (reviewedCount - accepted.length) / reviewedCount),
            )
          : 0;
      meta.l4FallbackRate =
        forceAiBatch && targetGenerateCount > 0
          ? Math.max(0, Math.min(1, fallbackCount / targetGenerateCount))
          : 0;
      await logAiTrace({
        route: "/api/practice/ai-curation",
        phase: "result",
        meta: {
          step: "final_selected",
          targetGenerateCount,
          acceptedCount: accepted.length,
          fallbackCount,
          rounds,
        },
        payload: {
          acceptedIds: accepted.map((q) => q.id),
          invalidReasonStats: reasonStats,
        },
      });

      if (accepted.length > 0) {
        const genIds = new Set(accepted.map((g) => g.id));
        const rest = qs.filter((q) => !genIds.has(q.id));
        qs = forceAiBatch ? [...accepted, ...rest.filter((q) => q.source === "ai")] : [...accepted, ...rest];
      }
    }
    if (others.length > 0) {
      qs = [...qs, ...others];
    }
    const visibleBatchSize = Math.min(minTotal, qs.length);
    const visibleAiCount = qs
      .slice(0, visibleBatchSize)
      .filter((q) => q.source === "ai").length;
    meta.l4AiCoverage =
      forceAiBatch && visibleBatchSize > 0
        ? Math.max(0, Math.min(1, visibleAiCount / visibleBatchSize))
        : 0;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[practice/ai-curation]", msg);
    await logAiTrace({
      route: "/api/practice/ai-curation",
      phase: "error",
      meta: { step: "main" },
      payload: { message: msg },
    });
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
