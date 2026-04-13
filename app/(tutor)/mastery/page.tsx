"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { DIAGNOSTIC_STORAGE_KEY } from "@/lib/diagnostic-types";
import { mockMasteryReportV2 } from "@/lib/ai/mastery-report-mock";
import { MASTERY_REPORT_V2_STORAGE_KEY, PRACTICE_EVENTS_STORAGE_KEY } from "@/lib/progress/storage-keys";
import type {
  DiagnosticBundle,
  MasteryReportRequestBody,
  MasteryReportV2,
  PracticeEvent,
} from "@/lib/progress/types";

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export default function MasteryTrackingPage() {
  const [diagnostic, setDiagnostic] = useState<DiagnosticBundle | null>(null);
  const [events, setEvents] = useState<PracticeEvent[]>([]);
  const [report, setReport] = useState<MasteryReportV2 | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const refreshLocal = useCallback(() => {
    const rawD = sessionStorage.getItem(DIAGNOSTIC_STORAGE_KEY);
    let d: DiagnosticBundle | null = null;
    try {
      d = rawD ? (JSON.parse(rawD) as DiagnosticBundle) : null;
    } catch {
      d = null;
    }
    setDiagnostic(d);
    setEvents(loadJson<PracticeEvent[]>(PRACTICE_EVENTS_STORAGE_KEY, []));
    setReport(loadJson<MasteryReportV2 | null>(MASTERY_REPORT_V2_STORAGE_KEY, null));
  }, []);

  useEffect(() => {
    refreshLocal();
    setLoading(false);
  }, [refreshLocal]);

  const regenerate = useCallback(async () => {
    setPending(true);
    setNote(null);
    const body: MasteryReportRequestBody = {
      diagnostic,
      practiceEvents: events,
      previousReport: report,
    };
    try {
      const r = await fetch("/api/mastery/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error("api");
      const data = (await r.json()) as { report: MasteryReportV2 };
      setReport(data.report);
      sessionStorage.setItem(
        MASTERY_REPORT_V2_STORAGE_KEY,
        JSON.stringify(data.report),
      );
    } catch {
      const fallback = mockMasteryReportV2(body);
      setReport(fallback);
      sessionStorage.setItem(
        MASTERY_REPORT_V2_STORAGE_KEY,
        JSON.stringify(fallback),
      );
      setNote("API 失敗，已用本機示範報告。");
    } finally {
      setPending(false);
    }
  }, [diagnostic, events, report]);

  if (loading) {
    return (
      <div className="py-16 text-center text-sm text-zinc-500">載入中…</div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          掌握追蹤（框架）
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          結合<strong>診斷報告</strong>與<strong>練習事件</strong>，由 AI
          產出可累積更新的掌握敘述；提示詞預留在{" "}
          <code className="rounded bg-zinc-200 px-1 text-xs dark:bg-zinc-800">
            lib/ai/prompts/mastery-report.ts
          </code>
          。
        </p>
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/60">
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">資料來源</h2>
        <ul className="mt-3 space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
          <li>
            診斷：{diagnostic ? "已載入（session）" : "尚未完成診斷問卷"}
          </li>
          <li>練習事件：{events.length} 筆（離開每一題時寫入 session）</li>
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              refreshLocal();
            }}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600"
          >
            重新讀取 session
          </button>
          <button
            type="button"
            onClick={regenerate}
            disabled={pending}
            className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-teal-600"
          >
            {pending ? "產生中…" : "重新生成掌握報告（AI）"}
          </button>
        </div>
        {note && <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">{note}</p>}
      </section>

      {report && (
        <section className="rounded-2xl border border-teal-200/80 bg-teal-50/50 p-5 dark:border-teal-900 dark:bg-teal-950/30">
          <p className="text-xs text-teal-800 dark:text-teal-300">
            最後更新：{report.generatedAt} · 納入練習筆數：{report.basedOnPracticeEventCount}{" "}
            · {report.modelNote}
          </p>
          <div className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-zinc-800 dark:text-zinc-100">
            {report.narrative}
          </div>
          {Object.keys(report.topicScores).length > 0 && (
            <div className="mt-4 text-xs text-zinc-600 dark:text-zinc-400">
              <span className="font-medium">topic 分數（示範）：</span>{" "}
              {Object.entries(report.topicScores)
                .map(([k, v]) => `${k}:${v}`)
                .join("，")}
            </div>
          )}
          {report.recommendedTopicOrder.length > 0 && (
            <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
              建議練習順序（topic 標籤）：{report.recommendedTopicOrder.join(" → ")}
            </p>
          )}
        </section>
      )}

      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/practice" className="text-teal-700 underline dark:text-teal-400">
          前往練習與引導
        </Link>
        <Link href="/diagnostic/report" className="text-teal-700 underline dark:text-teal-400">
          診斷掌握報告
        </Link>
        <Link href="/" className="text-zinc-600 underline dark:text-zinc-400">
          首頁
        </Link>
      </div>
    </div>
  );
}
