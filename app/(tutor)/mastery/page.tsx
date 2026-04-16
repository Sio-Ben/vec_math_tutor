"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DIAGNOSTIC_STORAGE_KEY } from "@/lib/diagnostic-types";
import { mockMasteryReportV2 } from "@/lib/ai/mastery-report-mock";
import { TOPIC_LABELS } from "@/lib/tutor/question-bank";
import {
  MASTERY_REPORT_V2_STORAGE_KEY,
  PRACTICE_BATCH_REPORTS_STORAGE_KEY,
  PRACTICE_EVENTS_STORAGE_KEY,
} from "@/lib/progress/storage-keys";
import type {
  DiagnosticBundle,
  MasteryReportRequestBody,
  MasteryReportV2,
  PracticeEvent,
  StoredBatchReport,
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

type TopicEntry = { topic: string; score: number };
type BatchTrendEntry = {
  batchId: string;
  batchIndex: number;
  accuracy: number;
  trendDelta: number | null;
  recommendedLevel?: "L1" | "L2" | "L3" | "L4";
};

function scoreBand(score: number): "excellent" | "good" | "ok" | "weak" {
  if (score >= 90) return "excellent";
  if (score >= 75) return "good";
  if (score >= 60) return "ok";
  return "weak";
}

function scoreBandLabel(band: ReturnType<typeof scoreBand>) {
  if (band === "excellent") return "優勢";
  if (band === "good") return "穩定";
  if (band === "ok") return "待補強";
  return "弱項";
}

function scoreBandClass(band: ReturnType<typeof scoreBand>) {
  if (band === "excellent")
    return "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/30";
  if (band === "good") return "bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-400/30";
  if (band === "ok") return "bg-amber-500/20 text-amber-200 ring-1 ring-amber-400/30";
  return "bg-rose-500/20 text-rose-200 ring-1 ring-rose-400/30";
}

function averageScore(entries: TopicEntry[]): number {
  if (!entries.length) return 0;
  return Math.round(entries.reduce((sum, e) => sum + e.score, 0) / entries.length);
}

function topicLabel(topicTag: string): string {
  const key = topicTag.trim();
  return TOPIC_LABELS[key] ?? key;
}

function RadarChart({ topics }: { topics: TopicEntry[] }) {
  const size = 320;
  const center = size / 2;
  const radius = 120;
  if (topics.length === 0) {
    return (
      <div className="flex h-[320px] items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/40 text-sm text-zinc-400">
        尚無 topic 分數可視化
      </div>
    );
  }
  const rings = [0.25, 0.5, 0.75, 1];
  const points = topics.map((t, i) => {
    const angle = (Math.PI * 2 * i) / topics.length - Math.PI / 2;
    const r = (Math.max(0, Math.min(100, t.score)) / 100) * radius;
    return {
      x: center + Math.cos(angle) * r,
      y: center + Math.sin(angle) * r,
      lx: center + Math.cos(angle) * (radius + 20),
      ly: center + Math.sin(angle) * (radius + 20),
      axisX: center + Math.cos(angle) * radius,
      axisY: center + Math.sin(angle) * radius,
      topic: t.topic,
    };
  });
  const polygon = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
      <svg viewBox={`0 0 ${size} ${size}`} className="h-[320px] w-full">
        {rings.map((ratio) => (
          <circle
            key={ratio}
            cx={center}
            cy={center}
            r={radius * ratio}
            fill="none"
            stroke="currentColor"
            className="text-zinc-700"
            strokeWidth="1"
          />
        ))}
        {points.map((p, idx) => (
          <line
            key={`axis-${idx}`}
            x1={center}
            y1={center}
            x2={p.axisX}
            y2={p.axisY}
            stroke="currentColor"
            className="text-zinc-700"
            strokeWidth="1"
          />
        ))}
        <polygon points={polygon} className="fill-violet-500/25 stroke-violet-400" strokeWidth="2" />
        {points.map((p, idx) => (
          <g key={`pt-${idx}`}>
            <circle cx={p.x} cy={p.y} r="3.5" className="fill-violet-300" />
            <text x={p.lx} y={p.ly} textAnchor="middle" className="fill-zinc-300 text-[10px]">
              {topicLabel(p.topic)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export default function MasteryTrackingPage() {
  const [diagnostic, setDiagnostic] = useState<DiagnosticBundle | null>(null);
  const [events, setEvents] = useState<PracticeEvent[]>([]);
  const [batchReports, setBatchReports] = useState<StoredBatchReport[]>([]);
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
    setBatchReports(
      loadJson<StoredBatchReport[]>(PRACTICE_BATCH_REPORTS_STORAGE_KEY, []),
    );
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
      batchReports,
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
  }, [diagnostic, events, batchReports, report]);

  const topicEntries = useMemo<TopicEntry[]>(() => {
    if (!report) return [];
    return Object.entries(report.topicScores)
      .map(([topic, score]) => ({
        topic,
        score: Math.max(0, Math.min(100, Number(score) || 0)),
      }))
      .sort((a, b) => b.score - a.score);
  }, [report]);
  const recentBatchTrends = useMemo<BatchTrendEntry[]>(() => {
    if (!batchReports.length) return [];
    const sorted = [...batchReports]
      .sort((a, b) => {
        const ta = new Date(a.generatedAt).getTime();
        const tb = new Date(b.generatedAt).getTime();
        return ta - tb;
      })
      .slice(-3);
    return sorted.map((b, idx, arr) => {
      const total = b.questionResults.length || 1;
      const correct = b.questionResults.filter((r) => r.isCorrect).length;
      const accuracy = Math.round((correct / total) * 100);
      const prev = idx > 0 ? arr[idx - 1] : null;
      if (!prev) {
        return {
          batchId: b.batchId,
          batchIndex: b.batchIndex,
          accuracy,
          trendDelta: null,
          recommendedLevel: b.recommendedLevel,
        };
      }
      const prevTotal = prev.questionResults.length || 1;
      const prevCorrect = prev.questionResults.filter((r) => r.isCorrect).length;
      const prevAccuracy = Math.round((prevCorrect / prevTotal) * 100);
      return {
        batchId: b.batchId,
        batchIndex: b.batchIndex,
        accuracy,
        trendDelta: accuracy - prevAccuracy,
        recommendedLevel: b.recommendedLevel,
      };
    });
  }, [batchReports]);

  const topTopics = useMemo(
    () => topicEntries.filter((x) => scoreBand(x.score) === "excellent" || scoreBand(x.score) === "good").slice(0, 6),
    [topicEntries],
  );
  const weakTopics = useMemo(
    () => topicEntries.filter((x) => scoreBand(x.score) === "weak" || scoreBand(x.score) === "ok").slice(0, 6),
    [topicEntries],
  );
  const avg = useMemo(() => averageScore(topicEntries), [topicEntries]);

  if (loading) {
    return (
      <div className="py-16 text-center text-sm text-zinc-500 dark:text-zinc-400">載入中…</div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-violet-600 dark:text-violet-400">
          AI 累積追蹤
        </p>
        <h1 className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          掌握追蹤
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          結合<strong>診斷報告</strong>與<strong>練習事件</strong>，由 AI
          產出可累積更新的掌握敘述。
        </p>
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">資料來源</h2>
        <ul className="mt-3 space-y-2 text-sm">
          <li className="flex items-center gap-2">
            <span
              className={`size-2 rounded-full ${diagnostic ? "bg-teal-500" : "bg-zinc-400"}`}
            />
            <span className="text-zinc-600 dark:text-zinc-400">
              診斷問卷：{diagnostic ? "已載入" : "尚未完成"}
            </span>
          </li>
          <li className="flex items-center gap-2">
            <span
              className={`size-2 rounded-full ${events.length > 0 ? "bg-violet-500" : "bg-zinc-400"}`}
            />
            <span className="text-zinc-600 dark:text-zinc-400">
              練習事件：{events.length} 筆
            </span>
          </li>
          <li className="flex items-center gap-2">
            <span
              className={`size-2 rounded-full ${batchReports.length > 0 ? "bg-violet-500" : "bg-zinc-400"}`}
            />
            <span className="text-zinc-600 dark:text-zinc-400">
              5題小結：{batchReports.length} 份
            </span>
          </li>
        </ul>
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => { refreshLocal(); }}
            className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            重新讀取 session
          </button>
          <button
            type="button"
            onClick={regenerate}
            disabled={pending}
            className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "產生中…" : "重新生成掌握報告（AI）"}
          </button>
        </div>
        {note && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
            <span>⚠</span> {note}
          </p>
        )}
      </section>

      {report && (
        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
              <p className="text-xs text-zinc-400">整體掌握程度</p>
              <p className="mt-2 text-2xl font-bold text-zinc-100">{avg}</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
              <p className="text-xs text-zinc-400">建議難度</p>
              <p className="mt-2 text-2xl font-bold text-violet-300">
                {report.recommendedDifficulty ?? "L2"}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
              <p className="text-xs text-zinc-400">資料量</p>
              <p className="mt-2 text-2xl font-bold text-zinc-100">
                {report.basedOnPracticeEventCount}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-violet-900/40 bg-gradient-to-br from-zinc-950 to-zinc-900 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium text-violet-300">最後更新：{report.generatedAt}</p>
              <p className="text-xs text-zinc-400">{report.modelNote}</p>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
              <RadarChart topics={topicEntries.slice(0, 10)} />
              <div className="space-y-3">
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
                  <p className="text-xs font-semibold text-emerald-300">表現較好 Topic</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {topTopics.length > 0
                      ? topTopics.map((t) => (
                          <span key={t.topic} className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-200">
                            {topicLabel(t.topic)} · {t.score}
                          </span>
                        ))
                      : <span className="text-xs text-zinc-400">尚無資料</span>}
                  </div>
                </div>
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
                  <p className="text-xs font-semibold text-amber-300">優先補強 Topic</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {weakTopics.length > 0
                      ? weakTopics.map((t) => (
                          <span key={t.topic} className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-200">
                            {topicLabel(t.topic)} · {t.score}
                          </span>
                        ))
                      : <span className="text-xs text-zinc-400">目前弱項不明顯</span>}
                  </div>
                </div>
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
                  <p className="text-xs font-semibold text-zinc-300">分級圖例（四段）</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {[95, 80, 65, 45].map((s) => {
                      const b = scoreBand(s);
                      return (
                        <span key={s} className={`rounded-full px-2 py-0.5 text-xs ${scoreBandClass(b)}`}>
                          {scoreBandLabel(b)}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4 text-sm leading-relaxed text-zinc-100">
              {report.narrative.split("\n").filter(Boolean).map((para, i) => (
                <p key={i} className="mt-2 first:mt-0">{para}</p>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">建議練習順序</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
              {report.recommendedTopicOrder.length > 0 ? report.recommendedTopicOrder.map((t, i) => (
                <span key={`${t}-${i}`} className="flex items-center gap-1.5">
                  <span className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-0.5 font-mono text-zinc-200">{topicLabel(t)}</span>
                  {i < report.recommendedTopicOrder.length - 1 && <span className="text-zinc-500">→</span>}
                </span>
              )) : <span className="text-zinc-400">由系統自動挑選</span>}
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">最近 3 組趨勢</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {recentBatchTrends.length > 0 ? (
                recentBatchTrends.map((b) => {
                  const up = (b.trendDelta ?? 0) > 0;
                  const down = (b.trendDelta ?? 0) < 0;
                  return (
                    <div key={b.batchId} className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
                      <p className="text-xs text-zinc-400">第 {b.batchIndex + 1} 組</p>
                      <p className="mt-1 text-lg font-semibold text-zinc-100">{b.accuracy}%</p>
                      <p className="mt-1 text-xs text-zinc-400">
                        建議等級：{b.recommendedLevel ?? "L2"}
                      </p>
                      <p className={`mt-1 text-xs ${up ? "text-emerald-300" : down ? "text-rose-300" : "text-zinc-400"}`}>
                        {b.trendDelta == null
                          ? "— 基準組"
                          : up
                            ? `↑ +${b.trendDelta}%`
                            : down
                              ? `↓ ${b.trendDelta}%`
                              : "→ 0%"}
                      </p>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-zinc-400">尚無批次趨勢資料</p>
              )}
            </div>
          </div>

          {topicEntries.length > 0 && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Topic 完整清單</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {topicEntries.map((t) => {
                  const band = scoreBand(t.score);
                  return (
                    <span key={t.topic} className={`rounded-full px-2 py-0.5 text-xs ${scoreBandClass(band)}`}>
                      {topicLabel(t.topic)}: {t.score}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}

      <div className="flex flex-wrap gap-4 text-sm">
        <Link
          href="/practice"
          className="inline-flex items-center gap-1 rounded-xl bg-violet-600 px-4 py-2 font-medium text-white hover:bg-violet-500"
        >
          前往練習引導 →
        </Link>
        <Link
          href="/diagnostic/report"
          className="rounded-xl border border-zinc-300 px-4 py-2 font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          診斷掌握報告
        </Link>
        <Link
          href="/"
          className="rounded-xl px-4 py-2 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          首頁
        </Link>
      </div>
    </div>
  );
}
