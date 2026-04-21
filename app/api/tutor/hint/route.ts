import { NextResponse } from "next/server";
import { deepseekChat, readDeepseekApiKey } from "@/lib/ai/deepseek";
import { mockHintCoachReply } from "@/lib/ai/hint-coach-mock";
import { logAiTrace } from "@/lib/ai/trace-logger";
import type { PracticeQuestion } from "@/lib/tutor/practice-questions";
import { resolvePracticeQuestion } from "@/lib/tutor/resolve-practice-question";

type Body = {
  questionId: string;
  hintIndex: number;
  studentThought?: string | null;
  inlineQuestion?: PracticeQuestion;
};

/**
 * 依題庫 hint 作 grounding，產出導師改寫／提問式回覆（不直接回傳 DB 原句）。
 */
export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const id = body.questionId?.trim();
  if (!id) {
    return NextResponse.json({ error: "questionId required" }, { status: 400 });
  }
  const hintIndex =
    typeof body.hintIndex === "number" && body.hintIndex >= 0 ? body.hintIndex : 0;

  const q = await resolvePracticeQuestion(id, body.inlineQuestion);
  if (!q) {
    return NextResponse.json({ error: "unknown question" }, { status: 404 });
  }

  const hintSourceText = q.hintSteps[hintIndex] ?? "";

  if (readDeepseekApiKey() && hintSourceText) {
    try {
      const promptPayload = {
        questionId: id,
        hintIndex,
        hintSourceText,
        studentThought: (body.studentThought ?? "").trim() || "（無）",
      };
      await logAiTrace({
        route: "/api/tutor/hint",
        phase: "prompt",
        payload: promptPayload,
      });
      const coachReply = (
        await deepseekChat(
          [
            {
              role: "system",
              content:
                "你是澳門高中數學向量單元的導師。接下來會給你「參考提示」僅供理解題意；請用繁體中文、自己的話改寫成簡短引導（多為提問），且不可連續複製參考提示超過 6 個字。不要直接給出最終數值答案。",
            },
            {
              role: "user",
              content: `參考提示（第 ${hintIndex + 1} 層）：\n${hintSourceText}\n\n學生剛寫的思路（可為空）：\n${(body.studentThought ?? "").trim() || "（無）"}`,
            },
          ],
          { temperature: 0.45 },
        )
      ).trim();
      await logAiTrace({
        route: "/api/tutor/hint",
        phase: "response",
        meta: { rawChars: coachReply.length },
        payload: coachReply,
      });
      if (coachReply) {
        await logAiTrace({
          route: "/api/tutor/hint",
          phase: "result",
          payload: { coachReply, hintIndex, source: "deepseek" },
        });
        return NextResponse.json({ coachReply, hintIndex });
      }
    } catch {
      await logAiTrace({
        route: "/api/tutor/hint",
        phase: "error",
        payload: { message: "deepseek_hint_failed" },
      });
      /* fallback */
    }
  }

  const coachReply = mockHintCoachReply({
    hintSourceText,
    hintIndex,
    questionId: id,
    studentThought: body.studentThought,
  });

  return NextResponse.json({ coachReply, hintIndex });
}
