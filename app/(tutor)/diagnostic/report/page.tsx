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
      ? "border-[var(--clr-correct)]"
      : clamp >= 45
        ? "border-[var(--lvl2)]"
        : "border-[var(--lvl3)]";
  const textColor =
    clamp >= 75
      ? "text-[var(--clr-correct)]"
      : clamp >= 45
        ? "text-[var(--lvl2)]"
        : "text-[var(--lvl3)]";
  return (
    <div className="flex flex-col items-center justify-center gap-1">
      <div
        className={`flex size-24 items-center justify-center rounded-full border-4 ${color} bg-[var(--bg-card)]`}
      >
        <span className={`text-3xl font-bold tabular-nums leading-none ${textColor}`}>
          {clamp}
        </span>
      </div>
      <span className="text-xs font-medium text-[var(--txt-3)]">/100</span>
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
      <div className="mx-auto max-w-2xl rounded-[var(--r-card)] border border-[var(--border)] bg-[var(--bg-card)] p-8 text-center text-[var(--txt-2)] shadow-[var(--shadow-card)]">
        載入中…
      </div>
    );
  }

  if (data === null) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 rounded-[var(--r-card)] border border-[var(--border)] bg-[var(--bg-card)] p-8 shadow-[var(--shadow-card)]">
        <h1 className="text-2xl font-bold text-[var(--txt)]">掌握報告</h1>
        <p className="text-[var(--txt-2)]">
          尚未載入問卷結果。請先完成{" "}
          <Link href="/diagnostic" className="font-medium text-[var(--learn-600)] underline">
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
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--learn-700)]">
          診斷結果
        </p>
        <h1 className="mt-1 text-2xl font-bold text-[var(--txt)]">掌握度分析報告</h1>
        <p className="mt-1 text-sm text-[var(--txt-2)]">
          耗時約 {payload.totalTimeSeconds} 秒 · 分析來源：{sourceLabel}。
        </p>
      </div>

      <section className="relative overflow-hidden rounded-[var(--r-card)] border border-[var(--learn-100)] bg-gradient-to-br from-[var(--learn-50)] to-[var(--bg-card)] p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-[var(--learn-500)]/15 blur-2xl"
        />
        <p className="relative text-sm font-semibold text-[var(--learn-700)]">給你的話</p>
        <p className="relative mt-3 text-base leading-relaxed text-[var(--txt)]">
          {report.student_summary}
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col items-center justify-center gap-2 rounded-[var(--r-card)] border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-card)]">
          <ScoreRing score={report.mastery_score} />
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--txt-3)]">加權掌握分</p>
        </div>
        <div className="flex flex-col items-center justify-center gap-2 rounded-[var(--r-card)] border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-card)]">
          <span className="text-4xl font-bold text-[var(--txt)]">
            {report.overall_level}
          </span>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--txt-3)]">整體級別</p>
        </div>
        <div className="flex flex-col items-center justify-center gap-2 rounded-[var(--r-card)] border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-card)]">
          <span className="text-4xl font-bold text-[var(--learn-600)]">
            {report.recommended_start_level}
          </span>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--txt-3)]">建議起點</p>
        </div>
      </section>

      <div className="grid gap-6 sm:grid-cols-2">
        <section className="rounded-[var(--r-card)] border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-card)]">
          <h2 className="flex items-center gap-2 font-semibold text-[var(--txt)]">
            <span className="flex size-5 items-center justify-center rounded-full bg-[var(--lvl1)]/12 text-xs text-[var(--lvl1)]">✓</span>
            掌握良好
          </h2>
          <ul className="mt-4 space-y-3 text-sm">
            {report.strong_topics.length === 0 ? (
              <li className="text-[var(--txt-3)]">本次暫無標記為「穩固」的題項。</li>
            ) : (
              report.strong_topics.map((s) => (
                <li key={s.topic} className="border-l-2 border-[var(--lvl1)] pl-3">
                  <span className="font-medium text-[var(--txt)]">{s.topic}</span>
                  <p className="mt-0.5 text-[var(--txt-2)]">{s.evidence}</p>
                </li>
              ))
            )}
          </ul>
        </section>
        <section className="rounded-[var(--r-card)] border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-card)]">
          <h2 className="flex items-center gap-2 font-semibold text-[var(--txt)]">
            <span className="flex size-5 items-center justify-center rounded-full bg-[var(--lvl3)]/12 text-xs text-[var(--lvl3)]">!</span>
            待加強
          </h2>
          <ul className="mt-4 space-y-3 text-sm">
            {report.weak_topics.length === 0 ? (
              <li className="text-[var(--txt-3)]">太棒了，本次暫無明顯薄弱項。</li>
            ) : (
              report.weak_topics.map((w) => (
                <li key={w.topic} className="border-l-2 border-[var(--lvl3)] pl-3">
                  <span className="font-medium text-[var(--txt)]">{w.topic}</span>
                  <p className="mt-0.5 text-[var(--txt-2)]">{w.gap}</p>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>

      <section className="rounded-[var(--r-card)] border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-card)]">
        <h2 className="font-semibold text-[var(--txt)]">逐題紀錄</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[320px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="py-2 pr-3 font-medium text-[var(--txt-3)]">題號</th>
                <th className="py-2 pr-3 font-medium text-[var(--txt-3)]">主題</th>
                <th className="py-2 pr-3 font-medium text-[var(--txt-3)]">難度</th>
                <th className="py-2 pr-3 font-medium text-[var(--txt-3)]">結果</th>
                <th className="py-2 font-medium text-[var(--txt-3)]">耗時</th>
              </tr>
            </thead>
            <tbody>
              {payload.results.map((r, i) => (
                <tr
                  key={r.q}
                  className={`border-b border-[var(--border)] ${i % 2 === 0 ? "" : "bg-[var(--learn-50)]/40"}`}
                >
                  <td className="py-2.5 pr-3 tabular-nums">{r.q}</td>
                  <td className="py-2.5 pr-3">{r.topic}</td>
                  <td className="py-2.5 pr-3">{r.level}</td>
                  <td className="py-2.5 pr-3">
                    {r.correct ? (
                      <span className="inline-flex items-center gap-1 rounded-[var(--r-pill)] bg-[var(--clr-correct)]/15 px-2.5 py-0.5 text-[11px] font-medium leading-none tracking-wide text-[var(--clr-correct)] ring-1 ring-[var(--clr-correct)]/30">
                        ✓ 正確
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-[var(--r-pill)] bg-[var(--clr-review)]/15 px-2.5 py-0.5 text-[11px] font-medium leading-none tracking-wide text-[var(--clr-review)] ring-1 ring-[var(--clr-review)]/30">
                        ! 待加強
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 tabular-nums text-[var(--txt-3)]">{r.timeSeconds}s</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/practice"
          className="inline-flex items-center rounded-[var(--r-btn)] bg-[var(--learn-600)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--learn-500)]"
        >
          進入練習引導 →
        </Link>
        <Link
          href="/mastery"
          className="inline-flex items-center rounded-[var(--r-btn)] border border-[var(--learn-500)]/40 bg-[var(--bg-card)] px-5 py-2.5 text-sm font-medium text-[var(--learn-700)] hover:bg-[var(--learn-50)]"
        >
          掌握追蹤（累積）
        </Link>
        <Link
          href="/diagnostic"
          className="inline-flex items-center rounded-[var(--r-btn)] border border-[var(--border)] bg-[var(--bg-card)] px-5 py-2.5 text-sm font-medium text-[var(--txt-2)] hover:bg-[var(--bg-hover)]"
        >
          重做
        </Link>
      </div>
    </div>
  );
}
