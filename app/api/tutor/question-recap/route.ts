import { NextResponse } from "next/server";
import { deepseekChat, readDeepseekApiKey } from "@/lib/ai/deepseek";
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
    const raw = await deepseekChat(
      [
        { role: "system", content: QUESTION_RECAP_SYSTEM },
        { role: "user", content: user },
      ],
      { temperature: 0.35 },
    );
    const { visible } = splitTutorReplyAndUiSignal(raw);
    const recap = visible.trim() || null;
    return NextResponse.json({
      recap,
      source: "deepseek" as const,
    } satisfies QuestionRecapResponse);
  } catch (e) {
    console.error("[tutor/question-recap]", e);
    return NextResponse.json({
      recap: null,
      source: "error" as const,
    } satisfies QuestionRecapResponse);
  }
}
