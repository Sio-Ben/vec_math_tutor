"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DIAGNOSTIC_STORAGE_KEY } from "@/lib/diagnostic-types";
import type { ClientReport } from "@/lib/report-from-results";
import type { DiagnosticSessionPayload } from "@/lib/diagnostic-types";

type Stored = {
  payload: DiagnosticSessionPayload;
  report: ClientReport;
};

export default function DiagnosticReportPage() {
  const [data, setData] = useState<Stored | null | undefined>(undefined);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DIAGNOSTIC_STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage 僅客戶端可讀
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
            診斷問卷
          </Link>
          ，提交後會在此顯示掌握度摘要（之後可改由 Prompt A 產生 JSON）。
        </p>
      </div>
    );
  }

  const { payload, report } = data;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">掌握度分析報告</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          總用時約 {payload.totalTimeSeconds} 秒 · 本頁為前端示範彙整，正式版將對接 Prompt A。
        </p>
      </div>

      <section className="rounded-2xl border border-teal-200/80 bg-gradient-to-br from-teal-50/90 to-white p-6 dark:border-teal-900/50 dark:from-teal-950/40 dark:to-zinc-900/80">
        <p className="text-sm font-medium text-teal-900 dark:text-teal-200">給你的話</p>
        <p className="mt-3 text-base leading-relaxed text-zinc-800 dark:text-zinc-100">
          {report.student_summary}
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/70">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">整體層級</p>
          <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {report.overall_level}
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/70">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">加權掌握分</p>
          <p className="mt-2 text-2xl font-bold text-teal-800 dark:text-teal-300">
            {report.mastery_score}
            <span className="text-base font-semibold text-zinc-500">/100</span>
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/70">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">建議起點</p>
          <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {report.recommended_start_level}
          </p>
        </div>
      </section>

      <div className="grid gap-6 sm:grid-cols-2">
        <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/70">
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">掌握良好</h2>
          <ul className="mt-3 space-y-3 text-sm">
            {report.strong_topics.length === 0 ? (
              <li className="text-zinc-500">本次暫無標記為「穩固」的題項。</li>
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
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">待加強</h2>
          <ul className="mt-3 space-y-3 text-sm">
            {report.weak_topics.length === 0 ? (
              <li className="text-zinc-500">太棒了，本次沒有明顯薄弱項。</li>
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
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[320px] text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-700">
                <th className="py-2 pr-2 font-medium">題號</th>
                <th className="py-2 pr-2 font-medium">知識點</th>
                <th className="py-2 pr-2 font-medium">難度</th>
                <th className="py-2 pr-2 font-medium">結果</th>
                <th className="py-2 font-medium">耗時</th>
              </tr>
            </thead>
            <tbody>
              {payload.results.map((r) => (
                <tr
                  key={r.q}
                  className="border-b border-zinc-100 dark:border-zinc-800/80"
                >
                  <td className="py-2 pr-2">{r.q}</td>
                  <td className="py-2 pr-2">{r.topic}</td>
                  <td className="py-2 pr-2">{r.level}</td>
                  <td className="py-2 pr-2">
                    {r.correct ? (
                      <span className="text-teal-700 dark:text-teal-400">正確</span>
                    ) : (
                      <span className="text-amber-700 dark:text-amber-400">待加強</span>
                    )}
                  </td>
                  <td className="py-2">{r.timeSeconds}s</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/practice"
          className="inline-flex rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500"
        >
          前往練習與引導
        </Link>
        <Link
          href="/mastery"
          className="inline-flex rounded-xl border border-teal-600/50 bg-white px-5 py-2.5 text-sm font-medium text-teal-900 hover:bg-teal-50 dark:border-teal-800 dark:bg-zinc-900 dark:text-teal-100 dark:hover:bg-zinc-800"
        >
          掌握追蹤（練習累積）
        </Link>
        <Link
          href="/diagnostic"
          className="inline-flex rounded-xl border border-zinc-300 bg-white px-5 py-2.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          重新診斷
        </Link>
      </div>
    </div>
  );
}
