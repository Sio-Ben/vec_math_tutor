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
  const [active] = useState<StoredActiveBatch | null>(() => {
    if (typeof window === "undefined") return null;
    return readActiveBatch();
  });

  useEffect(() => {
    if (active?.report) {
      appendBatchReport(active.report);
    }
  }, [active]);

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
        <h1 className="text-xl font-semibold text-[var(--txt)]">找不到本次小結資料</h1>
        <Link
          href="/practice"
          className="inline-flex rounded-[var(--r-btn)] bg-[var(--learn-600)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--learn-500)]"
        >
          回到練習首頁
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="relative overflow-hidden rounded-[var(--r-card)] border border-[var(--learn-100)] bg-gradient-to-br from-[var(--learn-50)] to-[var(--bg-card)] p-5 shadow-[var(--shadow-card)]">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-[var(--learn-500)]/15 blur-2xl"
        />
        <p className="relative text-xs font-semibold uppercase tracking-widest text-[var(--learn-700)]">
          第 {active.batchIndex + 1} 組 · 5題小結
        </p>
        <h1 className="relative mt-1 text-2xl font-bold text-[var(--txt)]">本次短練習報告</h1>
        <p className="mt-2 text-sm text-[var(--txt-2)]">
          共 {active.report?.questionResults.length ?? active.attempts.length} 題，答對{" "}
          {correctCount} 題。
        </p>
        <p className="relative mt-1 text-xs text-[var(--txt-3)]">
          本組 AI 生成題：{aiCount} 題
        </p>
        {active.report?.summary && (
          <div className="relative mt-3 rounded-lg bg-[var(--bg-card)]/75 px-4 py-3">
            <div className="absolute inset-y-3 left-0 w-px rounded bg-[var(--learn-500)]/35" />
            <p className="pl-3 text-sm leading-relaxed text-[var(--txt-2)]">
              {active.report.summary}
            </p>
          </div>
        )}
        {active.report?.systemLabel && (
          <p className="relative mt-2 rounded-xl border border-[var(--clr-review)]/35 bg-[var(--clr-review)]/10 px-4 py-2 text-xs text-[var(--clr-review)]">
            {active.report.systemLabel}
          </p>
        )}
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-[var(--r-card)] border border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-[var(--shadow-card)]">
          <p className="text-xs text-[var(--txt-3)]">本組題數</p>
          <p className="mt-1 text-2xl font-bold text-[var(--txt)]">
            {active.report?.questionResults.length ?? active.attempts.length}
          </p>
        </div>
        <div className="rounded-[var(--r-card)] border border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-[var(--shadow-card)]">
          <p className="text-xs text-[var(--txt-3)]">答對題數</p>
          <p className="mt-1 text-2xl font-bold text-[var(--clr-correct)]">{correctCount}</p>
        </div>
        <div className="rounded-[var(--r-card)] border border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-[var(--shadow-card)]">
          <p className="text-xs text-[var(--txt-3)]">AI 新題</p>
          <p className="mt-1 text-2xl font-bold text-[var(--learn-600)]">{aiCount}</p>
        </div>
      </section>

      <section className="rounded-[var(--r-card)] border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-card)]">
        <h2 className="text-base font-semibold text-[var(--txt)]">逐題分析</h2>
        <ul className="mt-3 space-y-3">
          {(active.report?.questionResults ?? []).map((r, i) => (
            <li
              key={`${r.questionId}-${i}`}
              className="rounded-xl border border-[var(--border)] bg-[var(--bg-inset)] p-4 text-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="break-all font-semibold text-[var(--txt)]">{r.questionId}</span>
                <span
                  className={`rounded-[var(--r-pill)] px-2.5 py-0.5 text-[11px] font-medium leading-none tracking-wide ring-1 ${
                    r.isCorrect
                      ? "bg-[var(--clr-correct)]/15 text-[var(--clr-correct)] ring-[var(--clr-correct)]/30"
                      : "bg-[var(--clr-review)]/15 text-[var(--clr-review)] ring-[var(--clr-review)]/30"
                  }`}
                >
                  {r.isCorrect ? "答對" : "待加強"}
                </span>
              </div>
              <p className="mt-2 text-[var(--txt-2)]">
                你的答案：
                <AnswerMathOrPlain
                  text={r.studentAnswerSummary}
                  className="text-[var(--txt)]"
                />
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-3">
                  <p className="text-xs font-semibold text-[var(--learn-700)]">答案分析</p>
                  <p className="mt-1 text-[var(--txt-3)]">
                    標準答案：
                    <AnswerMathOrPlain
                      text={r.standardAnswerSummary}
                      className="text-[var(--txt-2)]"
                    />
                  </p>
                  <div className="mt-1 text-[var(--txt-2)]">
                    <TutorMixedContent
                      text={r.answerFeedback ?? r.feedback}
                      className="text-[var(--txt-2)]"
                    />
                  </div>
                </div>
                <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-3">
                  <p className="text-xs font-semibold text-[var(--lvl1)]">思路分析</p>
                  <div className="mt-1 text-[var(--txt-2)]">
                    <TutorMixedContent
                      text={
                        r.thoughtFeedback ??
                        "你這題未提交思路也沒關係，願意持續作答就很棒；下題可嘗試先寫一行想法。"
                      }
                      className="text-[var(--txt-2)]"
                    />
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-[var(--r-card)] border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-card)]">
        <h2 className="text-base font-semibold text-[var(--txt)]">下次建議</h2>
        {typeof active.report?.metrics?.advice_level_consistency_rate === "number" && (
          <p className="mt-1 text-xs text-[var(--txt-3)]">
            升降級一致率：{Math.round(active.report.metrics.advice_level_consistency_rate * 100)}%
          </p>
        )}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-[var(--r-card)] border border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-[var(--shadow-card)]">
            <p className="text-xs font-semibold text-[var(--txt-3)]">建議難度</p>
            <p className="mt-2 text-2xl font-bold text-[var(--learn-600)]">
              {active.report?.difficultyAdvice === "up"
                ? "提升"
                : active.report?.difficultyAdvice === "down"
                  ? "下調"
                  : "維持"}
            </p>
          </div>
          <div className="rounded-[var(--r-card)] border border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-[var(--shadow-card)]">
            <p className="text-xs font-semibold text-[var(--txt-3)]">建議等級</p>
            <p className="mt-2 text-2xl font-bold text-[var(--learn-600)]">
              {active.report?.recommendedLevel ?? "L2"}
            </p>
          </div>
          <div className="rounded-[var(--r-card)] border border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-[var(--shadow-card)] sm:col-span-2">
            <p className="text-xs font-semibold text-[var(--txt-3)]">
              建議練習主題（非本輪 AI 生成題）
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(active.report?.nextTopicSuggestions ?? []).length > 0 ? (
                (active.report?.nextTopicSuggestions ?? []).map((topic) => (
                  <span
                    key={topic}
                    className="inline-flex rounded-[var(--r-pill)] bg-[var(--learn-100)] px-2.5 py-1 text-xs font-medium text-[var(--learn-700)] ring-1 ring-[var(--learn-300)]/60"
                  >
                    {topic}
                  </span>
                ))
              ) : (
                <span className="text-sm text-[var(--txt-2)]">由系統自動挑選</span>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/practice"
          className="rounded-[var(--r-btn)] bg-[var(--learn-600)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--learn-500)]"
        >
          回練習首頁
        </Link>
        <Link
          href="/mastery"
          className="rounded-[var(--r-btn)] border border-[var(--learn-300)] bg-[var(--bg-card)] px-4 py-2 text-sm font-medium text-[var(--learn-700)] hover:bg-[var(--learn-50)]"
        >
          更新總掌握報告
        </Link>
      </div>
    </div>
  );
}
