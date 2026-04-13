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
import type { ClientReport } from "@/lib/report-from-results";
import { bankRowToPracticeQuestion } from "@/lib/tutor/question-bank";
import type { PracticeQuestion } from "@/lib/tutor/practice-questions";

export const runtime = "nodejs";

type Body = {
  report?: ClientReport | null;
  questions: PracticeQuestion[];
  options?: {
    minWeakTopicCoverage?: number;
    minTotalQuestions?: number;
    maxGenerate?: number;
  };
};

function weakTopicTagsFromReport(r: ClientReport): string[] {
  return [
    ...new Set(
      r.weak_topics
        .map((w) => w.topic_tag?.trim())
        .filter((t): t is string => Boolean(t)),
    ),
  ];
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

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "無效 JSON" }, { status: 400 });
  }

  const incoming = Array.isArray(body.questions) ? body.questions : [];
  let qs = [...incoming];
  const report = body.report ?? null;
  const minWeak = body.options?.minWeakTopicCoverage ?? 1;
  const minTotal = body.options?.minTotalQuestions ?? 4;
  const maxGen = Math.min(8, Math.max(1, body.options?.maxGenerate ?? 5));

  const meta: {
    orderedByAi: boolean;
    generatedCount: number;
    orderRationale?: string | null;
    designNote?: string | null;
    skippedReason?: string;
  } = {
    orderedByAi: false,
    generatedCount: 0,
  };

  if (!getDeepseekChatConfig()) {
    meta.skippedReason = "no_deepseek_key";
    return NextResponse.json({ questions: qs, meta });
  }

  if (!report) {
    meta.skippedReason = "no_report";
    return NextResponse.json({ questions: qs, meta });
  }

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

    const weakTags = weakTopicTagsFromReport(report);
    const weakMatches = countWeakMatches(qs, weakTags);
    const needGen =
      qs.length === 0 ||
      qs.length < minTotal ||
      (weakTags.length > 0 && weakMatches < minWeak);

    if (needGen) {
      const generateCount =
        qs.length === 0
          ? maxGen
          : Math.min(maxGen, Math.max(2, minTotal - qs.length + 2));
      const samples = sampleRowsFromQuestions(
        incoming.length > 0 ? incoming : qs,
        3,
      );
      const genText = await deepseekChat(
        [
          { role: "system", content: PRACTICE_GENERATE_SYSTEM },
          {
            role: "user",
            content: buildPracticeGenerateUser({
              reportJson: JSON.stringify(report),
              sampleRowsJson: JSON.stringify(samples),
              weakTopicTags: weakTags,
              generateCount,
            }),
          },
        ],
        { jsonObject: true, temperature: 0.55 },
      );
      const genParsed = parseJsonFromModelText(genText);
      const genObj =
        genParsed && typeof genParsed === "object"
          ? (genParsed as Record<string, unknown>)
          : {};
      const rows = coerceLlMQuestionRows(genParsed);
      const generated: PracticeQuestion[] = [];
      for (const row of rows) {
        try {
          generated.push(bankRowToPracticeQuestion(row));
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
        const prepend =
          weakTags.length > 0 && weakMatches < minWeak || qs.length === 0;
        qs = prepend ? [...generated, ...rest] : [...rest, ...generated];
      }
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
