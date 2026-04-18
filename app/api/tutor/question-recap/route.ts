import { NextResponse } from "next/server";
import { deepseekChat, readDeepseekApiKey } from "@/lib/ai/deepseek";
import { logAiTrace } from "@/lib/ai/trace-logger";
import {
  buildQuestionRecapUser,
  QUESTION_RECAP_SYSTEM,
} from "@/lib/ai/prompt-question-recap";
import { splitTutorReplyAndUiSignal } from "@/lib/ai/parse-tutor-reply";
import type {
  QuestionRecapRequest,
  QuestionRecapResponse,
} from "@/lib/tutor/types";

export async function POST(req: Request) {
  let body: QuestionRecapRequest;
  try {
    body = (await req.json()) as QuestionRecapRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body?.questionId?.trim()) {
    return NextResponse.json({ error: "questionId required" }, { status: 400 });
  }

  const resBody: QuestionRecapResponse = {
    recap: null,
    source: "skipped",
  };

  if (!readDeepseekApiKey()) {
    return NextResponse.json(resBody);
  }

  try {
    const user = buildQuestionRecapUser(body);
    await logAiTrace({
      route: "/api/tutor/question-recap",
      phase: "prompt",
      payload: { questionId: body.questionId, userPrompt: user },
    });
    const raw = await deepseekChat(
      [
        { role: "system", content: QUESTION_RECAP_SYSTEM },
        { role: "user", content: user },
      ],
      { temperature: 0.35 },
    );
    await logAiTrace({
      route: "/api/tutor/question-recap",
      phase: "response",
      meta: { rawChars: raw.length },
      payload: raw,
    });
    const { visible } = splitTutorReplyAndUiSignal(raw);
    const recap = visible.trim() || null;
    await logAiTrace({
      route: "/api/tutor/question-recap",
      phase: "result",
      payload: { recap, source: "deepseek" },
    });
    return NextResponse.json({
      recap,
      source: "deepseek" as const,
    } satisfies QuestionRecapResponse);
  } catch (e) {
    console.error("[tutor/question-recap]", e);
    await logAiTrace({
      route: "/api/tutor/question-recap",
      phase: "error",
      payload: { message: e instanceof Error ? e.message : String(e) },
    });
    return NextResponse.json({
      recap: null,
      source: "error" as const,
    } satisfies QuestionRecapResponse);
  }
}
