import { NextResponse } from "next/server";
import { mockMasteryReportV2 } from "@/lib/ai/mastery-report-mock";
import {
  MASTERY_REPORT_SYSTEM_PROMPT_PLACEHOLDER,
} from "@/lib/ai/prompts/mastery-report";
import type {
  MasteryReportRequestBody,
  MasteryReportV2,
} from "@/lib/progress/types";

/**
 * 依「診斷 + 練習事件累積」產生／更新掌握報告。
 * 之後：讀取 MASTERY_REPORT_SYSTEM_PROMPT_PLACEHOLDER 替換為你的 prompt，呼叫 Anthropic。
 */
export async function POST(req: Request) {
  let body: MasteryReportRequestBody;
  try {
    body = (await req.json()) as MasteryReportRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(body.practiceEvents)) {
    return NextResponse.json({ error: "practiceEvents required" }, { status: 400 });
  }

  void MASTERY_REPORT_SYSTEM_PROMPT_PLACEHOLDER;

  let report: MasteryReportV2;
  if (process.env.ANTHROPIC_API_KEY?.trim()) {
    // TODO: 用 body + prompt 呼叫 Claude，解析為 MasteryReportV2
    report = mockMasteryReportV2(body);
    report.modelNote = "anthropic_key_present_stub";
  } else {
    report = mockMasteryReportV2(body);
  }

  return NextResponse.json({ report });
}
