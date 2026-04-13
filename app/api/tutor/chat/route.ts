import { NextResponse } from "next/server";
import { deepseekChat, readDeepseekApiKey } from "@/lib/ai/deepseek";
import { splitTutorReplyAndUiSignal } from "@/lib/ai/parse-tutor-reply";
import {
  buildPromptBUser,
  formatUnlockedHintsForPrompt,
  PROMPT_B_SYSTEM,
  stemToPlainWithLatex,
} from "@/lib/ai/prompt-b";
import { isPracticeAnswerCorrect } from "@/lib/tutor/evaluate-practice";
import { loadQuestionByIdFromDb } from "@/lib/tutor/load-questions";
import { PRACTICE_QUESTIONS } from "@/lib/tutor/practice-questions";
import type { TutorChatRequest, TutorChatResponse } from "@/lib/tutor/types";

async function questionById(id: string) {
  const fromDb = await loadQuestionByIdFromDb(id);
  if (fromDb) return fromDb;
  return PRACTICE_QUESTIONS.find((q) => q.id === id);
}

function correctAnswerForModel(q: Awaited<ReturnType<typeof questionById>>) {
  if (!q) return "";
  if (q.kind === "mcq") return `選項 ${q.correctKey}`;
  return q.fillAnswer ?? "";
}

function topicLabel(q: NonNullable<Awaited<ReturnType<typeof questionById>>>) {
  return q.topicTag ?? q.unitPill ?? "向量";
}

export async function POST(req: Request) {
  let body: TutorChatRequest | null = null;
  try {
    body = (await req.json()) as TutorChatRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const q = body?.questionId ? await questionById(body.questionId) : undefined;
  if (!q) {
    return NextResponse.json({ error: "unknown questionId" }, { status: 400 });
  }

  if (!body.thought?.trim()) {
    return NextResponse.json({ error: "thought required" }, { status: 400 });
  }

  const dc = body.diagnosticContext;
  const studentLevel = dc?.studentLevel?.trim() || "L2";
  const strongTopics = dc?.strongTopics?.length
    ? dc.strongTopics
    : ["（尚無診斷摘要）"];
  const weakTopics = dc?.weakTopics?.length ? dc.weakTopics : ["（尚無診斷摘要）"];
  const masteryScore =
    typeof dc?.masteryScore === "number" && Number.isFinite(dc.masteryScore)
      ? Math.round(dc.masteryScore)
      : 50;

  const attemptCount =
    typeof body.attemptCount === "number" && body.attemptCount >= 1
      ? Math.min(5, Math.floor(body.attemptCount))
      : 1;

  const hintsGiven =
    typeof body.hintsGiven === "number" && body.hintsGiven >= 0
      ? Math.floor(body.hintsGiven)
      : 0;

  const isCorrect = isPracticeAnswerCorrect(
    q,
    body.selectedChoice ?? null,
    body.studentFillAnswer,
  );
  const maxAttemptsReached =
    typeof body.maxAttemptsReached === "boolean"
      ? body.maxAttemptsReached
      : attemptCount >= 3 && !isCorrect;

  const history = Array.isArray(body.conversationHistory)
    ? body.conversationHistory.filter(
        (m) =>
          m &&
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string",
      )
    : [];

  const hintPoolJson = JSON.stringify(
    q.hintSteps.map((text, i) => ({ layer: i + 1, text })),
  );
  const hintStepsCount = q.hintSteps.length;
  const hintLayerMaxIndex = hintStepsCount > 0 ? hintStepsCount - 1 : -1;
  const hintMaxUnlockedIndex =
    hintsGiven > 0 && hintLayerMaxIndex >= 0
      ? Math.min(hintsGiven - 1, hintLayerMaxIndex)
      : -1;
  const unlockedHintsBlock = formatUnlockedHintsForPrompt(
    q.hintSteps,
    hintMaxUnlockedIndex,
  );

  const userPrompt = buildPromptBUser({
    studentLevel,
    strongTopics,
    weakTopics,
    masteryScore,
    questionId: q.id,
    questionLatex: stemToPlainWithLatex(q),
    questionLevel: q.difficulty ?? "L2",
    questionTopic: topicLabel(q),
    correctAnswer: correctAnswerForModel(q),
    hintPoolJson,
    hintStepsCount,
    hintLayerMaxIndex,
    attemptCount,
    hintsGiven,
    studentInput: body.thought.trim(),
    maxAttemptsReached,
    conversationHistoryJson: JSON.stringify(history, null, 0),
    unlockedHintsBlock,
    ragContext: undefined,
  });

  const keyOk = Boolean(readDeepseekApiKey());

  if (!keyOk) {
    const res: TutorChatResponse = {
      assistantMessage: q.thoughtReply,
      uiSignal: null,
      replySource: "no_api_key",
    };
    return NextResponse.json(res);
  }

  try {
    const full = await deepseekChat(
      [
        { role: "system", content: PROMPT_B_SYSTEM },
        { role: "user", content: userPrompt },
      ],
      { temperature: 0.45 },
    );
    const { visible, uiSignal: rawSignal } = splitTutorReplyAndUiSignal(full);
    let uiSignal = rawSignal;
    if (uiSignal && hintLayerMaxIndex >= 0) {
      const hi = uiSignal.hint_index_used;
      if (typeof hi === "number" && Number.isFinite(hi)) {
        const clamped = Math.min(
          Math.max(-1, Math.floor(hi)),
          hintLayerMaxIndex,
        );
        uiSignal = { ...uiSignal, hint_index_used: clamped };
      }
    } else if (uiSignal) {
      uiSignal = { ...uiSignal, hint_index_used: -1 };
    }
    const res: TutorChatResponse = {
      assistantMessage: visible.trim() || q.thoughtReply,
      uiSignal,
      replySource: "deepseek",
    };
    return NextResponse.json(res);
  } catch (e) {
    console.error("[tutor/chat] DeepSeek 呼叫失敗:", e);
    const res: TutorChatResponse = {
      assistantMessage: q.thoughtReply,
      uiSignal: null,
      replySource: "error",
    };
    return NextResponse.json(res);
  }
}
