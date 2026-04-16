"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MixedStem } from "@/components/MathText";
import { DIAGNOSTIC_QUESTIONS } from "@/lib/diagnostic-data";
import {
  DIAGNOSTIC_STORAGE_KEY,
  type DiagnosticSessionPayload,
  type QuestionOutcome,
} from "@/lib/diagnostic-types";
import { isAnswerCorrect } from "@/lib/evaluate-answer";
import { enrichReportTopicTags } from "@/lib/ai/enrich-report";
import { buildClientReport, type ClientReport } from "@/lib/report-from-results";

export default function DiagnosticPage() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [times, setTimes] = useState<Record<number, number>>({});
  const [finishing, setFinishing] = useState(false);
  const startRef = useRef(0);

  const q = DIAGNOSTIC_QUESTIONS[index];
  const total = DIAGNOSTIC_QUESTIONS.length;
  const progress = ((index + 1) / total) * 100;

  useLayoutEffect(() => {
    startRef.current = Date.now();
  }, [index]);

  const captureElapsed = () =>
    Math.max(1, Math.round((Date.now() - startRef.current) / 1000));

  const persistAndGoReport = async (nextTimes: Record<number, number>) => {
    const results: QuestionOutcome[] = DIAGNOSTIC_QUESTIONS.map((item) => ({
      q: item.id,
      topic: item.topic,
      topicTag: item.topicTag,
      level: item.level,
      correct: isAnswerCorrect(item, answers[item.id]),
      timeSeconds: nextTimes[item.id] ?? 0,
    }));
    const totalTimeSeconds = Object.values(nextTimes).reduce((a, b) => a + b, 0);
    const payload: DiagnosticSessionPayload = {
      results,
      totalTimeSeconds,
      submittedAt: new Date().toISOString(),
    };
    setFinishing(true);
    let report: ClientReport = buildClientReport(results);
    let analyzeSource: "deepseek" | "local_only" | "local_fallback" = "local_only";
    try {
      const r = await fetch("/api/diagnostic/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          results,
          totalTimeSeconds,
          answerMap: answers,
        }),
      });
      if (r.ok) {
        const data = (await r.json()) as {
          report?: ClientReport;
          results?: QuestionOutcome[];
          source?: "deepseek" | "local_only" | "local_fallback";
        };
        if (data.report) report = data.report;
        if (Array.isArray(data.results) && data.results.length > 0) {
          payload.results = data.results;
        }
        if (data.source) analyzeSource = data.source;
      }
    } catch {
      /* 使用本機報告 */
    } finally {
      setFinishing(false);
    }
    report = enrichReportTopicTags(report, results);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(
        DIAGNOSTIC_STORAGE_KEY,
        JSON.stringify({ payload, report, analyzeSource }),
      );
    }
    router.push("/diagnostic/report");
  };

  const canProceed = () => {
    const v = answers[q.id];
    return v != null && String(v).trim() !== "";
  };

  const goNext = () => {
    if (!canProceed() || finishing) return;
    const elapsed = captureElapsed();
    const nextTimes = { ...times, [q.id]: elapsed };
    setTimes(nextTimes);
    if (index < total - 1) {
      setIndex(index + 1);
    } else {
      void persistAndGoReport(nextTimes);
    }
  };

  const goPrev = () => {
    if (index === 0) return;
    setIndex(index - 1);
  };

  const levelColor =
    q.level === "L1"
      ? "border-l-teal-500"
      : q.level === "L2"
        ? "border-l-violet-500"
        : "border-l-amber-500";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">初始診斷問卷</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            診斷用、非評分；約 8 題，請依直覺作答即可。
          </p>
        </div>
        <span className="text-sm font-semibold tabular-nums text-teal-800 dark:text-teal-300">
          {index + 1} / {total}
        </span>
      </div>

      <div className="space-y-1.5">
        <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
          <div
            className="h-full rounded-full bg-teal-600 transition-all duration-500 ease-out dark:bg-teal-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex gap-1">
          {Array.from({ length: total }).map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                i < index
                  ? "bg-teal-500 dark:bg-teal-400"
                  : i === index
                    ? "bg-teal-300 dark:bg-teal-600"
                    : "bg-zinc-200 dark:bg-zinc-800"
              }`}
            />
          ))}
        </div>
      </div>

      <article className={`rounded-2xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70 overflow-hidden border-l-4 ${levelColor}`}>
        <div className="p-6">
          <div className="flex flex-wrap gap-2 text-xs font-medium">
            <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              {q.level}
            </span>
            <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-teal-900 dark:bg-teal-950/80 dark:text-teal-200">
              {q.topic}
            </span>
            <span className="rounded-full bg-zinc-50 px-2.5 py-0.5 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-300">
              {q.topicTag}
            </span>
          </div>

          <div className="mt-5 text-base leading-relaxed text-zinc-900 dark:text-zinc-100">
            <MixedStem parts={q.stem} />
          </div>

          {q.kind === "mcq" && q.options && (
            <ul className="mt-6 space-y-2.5">
              {q.options.map((opt) => {
                const selected = answers[q.id] === opt.key;
                return (
                  <li key={opt.key}>
                    <label
                      className={
                        selected
                          ? "flex cursor-pointer items-center gap-3 rounded-xl border-2 border-teal-600 bg-teal-50/80 px-4 py-3 shadow-sm dark:border-teal-500 dark:bg-teal-950/40"
                          : "flex cursor-pointer items-center gap-3 rounded-xl border border-zinc-200 px-4 py-3 hover:border-teal-300 hover:bg-teal-50/40 dark:border-zinc-700 dark:hover:border-zinc-600 dark:hover:bg-zinc-800/50"
                      }
                    >
                      <input
                        type="radio"
                        className="size-4 accent-teal-700"
                        name={`q-${q.id}`}
                        checked={selected}
                        onChange={() =>
                          setAnswers((prev) => ({ ...prev, [q.id]: opt.key }))
                        }
                      />
                      <span
                        className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                          selected
                            ? "bg-teal-600 text-white"
                            : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                        }`}
                      >
                        {opt.key}
                      </span>
                      <span className="text-sm text-zinc-800 dark:text-zinc-100">
                        <MixedStem parts={[{ type: "math", latex: opt.latex }]} />
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}

          {q.kind === "fill" && (
            <div className="mt-6">
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                你的答案
              </label>
              <textarea
                className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-zinc-50/80 px-4 py-3 text-zinc-900 placeholder:text-zinc-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                rows={q.fillRows ?? 2}
                placeholder={q.fillPlaceholder}
                value={answers[q.id] ?? ""}
                onChange={(e) =>
                  setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                }
              />
            </div>
          )}
        </div>
      </article>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={goPrev}
          disabled={index === 0}
          className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
        >
          ← 上一題
        </button>
        <div className="flex gap-2">
          <Link
            href="/"
            className="rounded-xl px-4 py-2.5 text-sm text-zinc-500 underline-offset-4 hover:text-zinc-700 hover:underline dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            回到首頁
          </Link>
          <button
            type="button"
            onClick={goNext}
            disabled={!canProceed() || finishing}
            className="rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-zinc-300 dark:bg-teal-600 dark:hover:bg-teal-500 dark:disabled:bg-zinc-700"
          >
            {finishing
              ? "分析中…"
              : index < total - 1
                ? "下一題 →"
                : "完成並查看報告"}
          </button>
        </div>
      </div>
    </div>
  );
}
