"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DIAGNOSTIC_STORAGE_KEY } from "@/lib/diagnostic-types";
import type { ClientReport } from "@/lib/report-from-results";
import type { DiagnosticSessionPayload } from "@/lib/diagnostic-types";

type AnalyzeSource = "deepseek" | "local_only" | "local_fallback";

type Stored = {
  payload: DiagnosticSessionPayload;
  report: ClientReport;
  analyzeSource?: AnalyzeSource;
};

function ScoreRing({ score }: { score: number }) {
  const clamp = Math.min(100, Math.max(0, score));
  const color =
    clamp >= 75
      ? "border-teal-500 dark:border-teal-400"
      : clamp >= 45
        ? "border-violet-500 dark:border-violet-400"
        : "border-amber-500 dark:border-amber-400";
  const textColor =
    clamp >= 75
      ? "text-teal-800 dark:text-teal-300"
      : clamp >= 45
        ? "text-violet-800 dark:text-violet-300"
        : "text-amber-800 dark:text-amber-300";
  return (
    <div className="flex flex-col items-center justify-center gap-1">
      <div
        className={`flex size-24 items-center justify-center rounded-full border-4 ${color} bg-white dark:bg-zinc-950`}
      >
        <span className={`text-3xl font-bold tabular-nums leading-none ${textColor}`}>
          {clamp}
        </span>
      </div>
      <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">/100</span>
    </div>
  );
}

export default function DiagnosticReportPage() {
  const [data, setData] = useState<Stored | null | undefined>(undefined);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DIAGNOSTIC_STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setData(raw ? (JSON.parse(raw) as Stored) : null);
    } catch {
      setData(null);
    }
  }, []);

  if (data === undefined) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-zinc-200/80 bg-white p-8 text-center text-zinc-500 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-400">
        載入中…
      </div>
    );
  }

  if (data === null) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 rounded-2xl border border-zinc-200/80 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">掌握報告</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          尚未載入問卷結果。請先完成{" "}
          <Link href="/diagnostic" className="font-medium text-teal-700 underline dark:text-teal-400">
            問卷
          </Link>
          ，提交後會在此顯示掌握度摘要。
        </p>
      </div>
    );
  }

  const { payload, report, analyzeSource } = data;
  const sourceLabel =
    analyzeSource === "deepseek"
      ? "DeepSeek Prompt A"
      : analyzeSource === "local_fallback"
        ? "本機回退（AI 呼叫失敗）"
        : "本機計算";

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-teal-700 dark:text-teal-400">
          診斷結果
        </p>
        <h1 className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-50">掌握度分析報告</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          耗時約 {payload.totalTimeSeconds} 秒 · 分析來源：{sourceLabel}。
        </p>
      </div>

      <section className="relative overflow-hidden rounded-2xl border border-teal-200/80 bg-gradient-to-br from-teal-50/90 to-white p-6 dark:border-teal-900/50 dark:from-teal-950/40 dark:to-zinc-900/80">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-teal-300/20 blur-2xl dark:bg-teal-500/10"
        />
        <p className="relative text-sm font-semibold text-teal-900 dark:text-teal-200">給你的話</p>
        <p className="relative mt-3 text-base leading-relaxed text-zinc-800 dark:text-zinc-100">
          {report.student_summary}
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-zinc-200/80 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/70">
          <ScoreRing score={report.mastery_score} />
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">加權掌握分</p>
        </div>
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-zinc-200/80 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/70">
          <span className="text-4xl font-bold text-zinc-900 dark:text-zinc-50">
            {report.overall_level}
          </span>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">整體級別</p>
        </div>
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-zinc-200/80 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/70">
          <span className="text-4xl font-bold text-violet-700 dark:text-violet-300">
            {report.recommended_start_level}
          </span>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">建議起點</p>
        </div>
      </section>

      <div className="grid gap-6 sm:grid-cols-2">
        <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/70">
          <h2 className="flex items-center gap-2 font-semibold text-zinc-900 dark:text-zinc-50">
            <span className="flex size-5 items-center justify-center rounded-full bg-teal-100 text-xs text-teal-700 dark:bg-teal-950/60 dark:text-teal-300">✓</span>
            掌握良好
          </h2>
          <ul className="mt-4 space-y-3 text-sm">
            {report.strong_topics.length === 0 ? (
              <li className="text-zinc-500 dark:text-zinc-400">本次暫無標記為「穩固」的題項。</li>
            ) : (
              report.strong_topics.map((s) => (
                <li key={s.topic} className="border-l-2 border-teal-500 pl-3">
                  <span className="font-medium text-zinc-800 dark:text-zinc-200">{s.topic}</span>
                  <p className="mt-0.5 text-zinc-600 dark:text-zinc-400">{s.evidence}</p>
                </li>
              ))
            )}
          </ul>
        </section>
        <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/70">
          <h2 className="flex items-center gap-2 font-semibold text-zinc-900 dark:text-zinc-50">
            <span className="flex size-5 items-center justify-center rounded-full bg-amber-100 text-xs text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">!</span>
            待加強
          </h2>
          <ul className="mt-4 space-y-3 text-sm">
            {report.weak_topics.length === 0 ? (
              <li className="text-zinc-500 dark:text-zinc-400">太棒了，本次暫無明顯薄弱項。</li>
            ) : (
              report.weak_topics.map((w) => (
                <li key={w.topic} className="border-l-2 border-amber-500 pl-3">
                  <span className="font-medium text-zinc-800 dark:text-zinc-200">{w.topic}</span>
                  <p className="mt-0.5 text-zinc-600 dark:text-zinc-400">{w.gap}</p>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>

      <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/70">
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">逐題紀錄</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[320px] text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-700">
                <th className="py-2 pr-3 font-medium text-zinc-500">題號</th>
                <th className="py-2 pr-3 font-medium text-zinc-500">主題</th>
                <th className="py-2 pr-3 font-medium text-zinc-500">難度</th>
                <th className="py-2 pr-3 font-medium text-zinc-500">結果</th>
                <th className="py-2 font-medium text-zinc-500">耗時</th>
              </tr>
            </thead>
            <tbody>
              {payload.results.map((r, i) => (
                <tr
                  key={r.q}
                  className={`border-b border-zinc-100 dark:border-zinc-800/80 ${i % 2 === 0 ? "" : "bg-zinc-50/50 dark:bg-zinc-950/30"}`}
                >
                  <td className="py-2.5 pr-3 tabular-nums">{r.q}</td>
                  <td className="py-2.5 pr-3">{r.topic}</td>
                  <td className="py-2.5 pr-3">{r.level}</td>
                  <td className="py-2.5 pr-3">
                    {r.correct ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700 dark:bg-teal-950/50 dark:text-teal-300">
                        ✓ 正確
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                        ! 待加強
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 tabular-nums text-zinc-500">{r.timeSeconds}s</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/practice"
          className="inline-flex items-center rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500"
        >
          進入練習引導 →
        </Link>
        <Link
          href="/mastery"
          className="inline-flex items-center rounded-xl border border-teal-600/50 bg-white px-5 py-2.5 text-sm font-medium text-teal-900 hover:bg-teal-50 dark:border-teal-800 dark:bg-zinc-900 dark:text-teal-100 dark:hover:bg-zinc-800"
        >
          掌握追蹤（累積）
        </Link>
        <Link
          href="/diagnostic"
          className="inline-flex items-center rounded-xl border border-zinc-300 bg-white px-5 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          重做
        </Link>
      </div>
    </div>
  );
}
