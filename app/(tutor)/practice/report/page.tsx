"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnswerMathOrPlain, TutorMixedContent } from "@/components/MathText";
import {
  PRACTICE_ACTIVE_BATCH_STORAGE_KEY,
  PRACTICE_BATCH_REPORTS_STORAGE_KEY,
} from "@/lib/progress/storage-keys";
import type { BatchQuestionAttempt, BatchReport } from "@/lib/tutor/types";

type StoredActiveBatch = {
  batchId: string;
  batchIndex: number;
  attempts: BatchQuestionAttempt[];
  report: BatchReport | null;
  generatedAt: string;
};

function readActiveBatch(): StoredActiveBatch | null {
  try {
    const raw = sessionStorage.getItem(PRACTICE_ACTIVE_BATCH_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredActiveBatch;
  } catch {
    return null;
  }
}

function appendBatchReport(report: BatchReport) {
  try {
    const raw = sessionStorage.getItem(PRACTICE_BATCH_REPORTS_STORAGE_KEY) || "[]";
    const arr = JSON.parse(raw) as BatchReport[];
    if (arr.some((x) => x.batchId === report.batchId)) return;
    arr.push(report);
    sessionStorage.setItem(PRACTICE_BATCH_REPORTS_STORAGE_KEY, JSON.stringify(arr));
  } catch {
    // ignore
  }
}

export default function PracticeBatchReportPage() {
  const [active, setActive] = useState<StoredActiveBatch | null>(null);

  useEffect(() => {
    const a = readActiveBatch();
    setActive(a);
    if (a?.report) {
      appendBatchReport(a.report);
    }
  }, []);

  const correctCount = useMemo(() => {
    const rows = active?.report?.questionResults ?? [];
    return rows.filter((r) => r.isCorrect).length;
  }, [active]);
  const aiCount = useMemo(() => {
    const attempts = active?.attempts ?? [];
    return attempts.filter((a) => a.isAiGenerated).length;
  }, [active]);

  if (!active) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 py-12">
        <h1 className="text-xl font-semibold text-zinc-100">找不到本次小結資料</h1>
        <Link
          href="/practice"
          className="inline-flex rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"
        >
          回到練習首頁
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
        <p className="text-xs text-violet-300">第 {active.batchIndex + 1} 組 · 5題小結</p>
        <h1 className="mt-1 text-xl font-semibold text-zinc-100">本次短練習報告</h1>
        <p className="mt-2 text-sm text-zinc-300">
          共 {active.report?.questionResults.length ?? active.attempts.length} 題，答對{" "}
          {correctCount} 題。
        </p>
        <p className="mt-1 text-xs text-zinc-400">
          本組 AI 生成題：{aiCount} 題
        </p>
        {active.report?.summary && (
          <p className="mt-3 rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-3 text-sm text-zinc-100">
            {active.report.summary}
          </p>
        )}
        {active.report?.systemLabel && (
          <p className="mt-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs text-amber-200">
            {active.report.systemLabel}
          </p>
        )}
      </header>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h2 className="text-sm font-semibold text-zinc-100">逐題分析</h2>
        <ul className="mt-3 space-y-3">
          {(active.report?.questionResults ?? []).map((r, i) => (
            <li
              key={`${r.questionId}-${i}`}
              className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3 text-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-zinc-100">{r.questionId}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    r.isCorrect
                      ? "bg-emerald-500/20 text-emerald-300"
                      : "bg-amber-500/20 text-amber-300"
                  }`}
                >
                  {r.isCorrect ? "答對" : "待加強"}
                </span>
              </div>
              <p className="mt-2 text-zinc-300">
                你的答案：
                <AnswerMathOrPlain
                  text={r.studentAnswerSummary}
                  className="text-zinc-100"
                />
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-2.5">
                  <p className="text-xs font-semibold text-violet-300">答案分析</p>
                  <p className="mt-1 text-zinc-400">
                    標準答案：
                    <AnswerMathOrPlain
                      text={r.standardAnswerSummary}
                      className="text-zinc-200"
                    />
                  </p>
                  <div className="mt-1 text-zinc-200">
                    <TutorMixedContent
                      text={r.answerFeedback ?? r.feedback}
                      className="text-zinc-200"
                    />
                  </div>
                </div>
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-2.5">
                  <p className="text-xs font-semibold text-emerald-300">思路分析</p>
                  <div className="mt-1 text-zinc-200">
                    <TutorMixedContent
                      text={
                        r.thoughtFeedback ??
                        "你這題未提交思路也沒關係，願意持續作答就很棒；下題可嘗試先寫一行想法。"
                      }
                      className="text-zinc-200"
                    />
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h2 className="text-sm font-semibold text-zinc-100">下次建議</h2>
        <div className="mt-2 text-sm text-zinc-300">
          <p>
            建議難度：
            {active.report?.difficultyAdvice === "up"
              ? "提升"
              : active.report?.difficultyAdvice === "down"
                ? "下調"
                : "維持"}
          </p>
          <p className="mt-1">
            建議等級：{active.report?.recommendedLevel ?? "L2"}
          </p>
          <p className="mt-1">
            建議練習主題（非本輪 AI 生成題）：
            {(active.report?.nextTopicSuggestions ?? []).join("、") || "由系統自動挑選"}
          </p>
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/practice"
          className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"
        >
          回練習首頁
        </Link>
        <Link
          href="/mastery"
          className="rounded-xl border border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-800"
        >
          更新總掌握報告
        </Link>
      </div>
    </div>
  );
}
