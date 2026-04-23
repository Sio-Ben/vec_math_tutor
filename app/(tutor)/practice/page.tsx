"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { InlineLatex, TutorMixedContent } from "@/components/MathText";
import { MathLiveInput } from "@/components/MathLiveInput";
import { DIAGNOSTIC_STORAGE_KEY } from "@/lib/diagnostic-types";
import type { ClientReport } from "@/lib/report-from-results";
import {
  MASTERY_REPORT_V2_STORAGE_KEY,
  PRACTICE_ACTIVE_BATCH_STORAGE_KEY,
  PRACTICE_BATCH_REPORTS_STORAGE_KEY,
  PRACTICE_EVENTS_STORAGE_KEY,
  PRACTICE_SESSION_STORAGE_KEY,
} from "@/lib/progress/storage-keys";
import {
  buildPracticeSessionFingerprint,
  clearPracticeSession,
  readPracticeSession,
  writePracticeSession,
} from "@/lib/practice/practice-session-cache";
import type { MasteryReportV2, PracticeEvent } from "@/lib/progress/types";
import type {
  BatchQuestionAttempt,
  BatchReport,
  TutorChatResponse,
  TutorChatTurn,
  TutorDiagnosticContext,
} from "@/lib/tutor/types";
import {
  PRACTICE_QUESTIONS,
  type PracticeQuestion,
} from "@/lib/tutor/practice-questions";

function CloudIcon(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={props.className}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 15a4.5 4.5 0 0 0 4.5 4.5h8.652a3.75 3.75 0 0 0 1.872-7.002 3.75 3.75 0 0 0-3.648-4.908 4.5 4.5 0 0 0-8.376 2.508A3.75 3.75 0 0 0 2.25 15Z"
      />
    </svg>
  );
}

function LoadingSpinner(props: { className?: string }) {
  return (
    <span
      className={`inline-block size-4 animate-spin rounded-full border-2 border-[var(--learn-200)] border-t-[var(--learn-600)] ${props.className ?? ""}`}
      aria-hidden
    />
  );
}

function SkeletonBlock(props: { className: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-[var(--learn-100)]/70 ${props.className}`}
    />
  );
}

/** 與診斷問卷 MCQ 選項列相同的剪影：直向清單 + 圓形鍵 + 文字條 */
function McqOptionRowSkeleton() {
  return (
    <div className="flex cursor-default items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3">
      <SkeletonBlock className="size-4 shrink-0 rounded-full" />
      <SkeletonBlock className="size-6 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <SkeletonBlock className="h-3.5 w-full max-w-[85%]" />
        <SkeletonBlock className="h-3.5 w-full max-w-[55%] sm:max-w-[45%]" />
      </div>
    </div>
  );
}

function PracticePageHeading() {
  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--txt)]">
        練習引導
      </h1>
      <p className="mt-1 text-sm text-[var(--txt-2)]">
        每批 5 題；作答後可提交思路，取得 Socratic 導師回饋。
      </p>
    </div>
  );
}

function PracticeLoadingSkeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PracticePageHeading />
      <div className="rounded-xl border border-[var(--learn-200)] bg-[var(--learn-50)] px-4 py-3 text-xs text-[var(--learn-700)]">
        <div className="flex items-center gap-2.5">
          <LoadingSpinner />
          <span>正在載入題庫與個人化題序…</span>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-end justify-between gap-2">
          <SkeletonBlock className="h-3.5 w-52 max-w-[72%]" />
          <SkeletonBlock className="h-4 w-12 rounded-md" />
        </div>
        <div className="space-y-1.5">
          <SkeletonBlock className="h-1.5 w-full rounded-full" />
          <div className="flex gap-1">
            {Array.from({ length: 5 }).map((_, idx) => (
              <SkeletonBlock key={idx} className="h-1 flex-1 rounded-full" />
            ))}
          </div>
        </div>
        <div className="flex justify-end pt-0.5">
          <SkeletonBlock className="h-8 w-28 rounded-xl" />
        </div>
      </div>

      <section className="rounded-[var(--r-card)] border border-[var(--border)] border-l-4 border-l-[var(--learn-500)] rounded-l-none bg-[var(--bg-card)] p-6 shadow-[var(--shadow-card)]">
        <div className="flex flex-wrap gap-2">
          <SkeletonBlock className="h-5 w-10 rounded-[var(--r-pill)]" />
          <SkeletonBlock className="h-5 w-24 rounded-[var(--r-pill)]" />
          <SkeletonBlock className="h-5 w-16 rounded-[var(--r-pill)]" />
        </div>
        <div className="mt-5 space-y-2">
          <SkeletonBlock className="h-4 w-full max-w-[95%]" />
          <SkeletonBlock className="h-4 w-full max-w-[88%]" />
          <SkeletonBlock className="h-4 w-full max-w-[72%]" />
        </div>
        <ul className="mt-6 space-y-2.5">
          <li>
            <McqOptionRowSkeleton />
          </li>
          <li>
            <McqOptionRowSkeleton />
          </li>
          <li>
            <McqOptionRowSkeleton />
          </li>
          <li>
            <McqOptionRowSkeleton />
          </li>
        </ul>
        <SkeletonBlock className="mt-6 h-11 w-full rounded-2xl" />
      </section>

      <section className="rounded-[var(--r-card)] border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-card)] sm:p-6">
        <div className="flex items-center gap-2">
          <SkeletonBlock className="h-5 w-5 rounded-full" />
          <SkeletonBlock className="h-5 w-20" />
        </div>
        <SkeletonBlock className="mt-3 h-28 w-full rounded-2xl" />
        <SkeletonBlock className="mt-4 h-11 w-full rounded-[var(--r-btn)]" />
      </section>
    </div>
  );
}

function imageWrapperClass(position: string | null | undefined): string {
  const p = (position ?? "").toLowerCase();
  if (p.includes("直") || p.includes("portrait"))
    return "mx-auto max-h-72 w-auto max-w-full object-contain";
  if (p.includes("橫") || p.includes("landscape"))
    return "mx-auto max-h-48 w-full max-w-full object-contain";
  return "mx-auto max-h-64 w-full max-w-full object-contain";
}

function readDiagnosticReport(): ClientReport | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(DIAGNOSTIC_STORAGE_KEY);
    if (!raw) return null;
    const bundle = JSON.parse(raw) as { report?: ClientReport };
    const r = bundle.report;
    if (!r?.overall_level || !Array.isArray(r.weak_topics)) return null;
    return r;
  } catch {
    return null;
  }
}

function readWeakTopicTagsFromDiagnostic(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(DIAGNOSTIC_STORAGE_KEY);
    if (!raw) return [];
    const bundle = JSON.parse(raw) as {
      report?: { weak_topics?: { topic_tag?: string }[] };
    };
    const wt = bundle.report?.weak_topics ?? [];
    return [
      ...new Set(
        wt.map((w) => w.topic_tag).filter((t): t is string => Boolean(t?.trim())),
      ),
    ];
  } catch {
    return [];
  }
}

function readTutorDiagnosticContext(): TutorDiagnosticContext | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(DIAGNOSTIC_STORAGE_KEY);
    if (!raw) return null;
    const bundle = JSON.parse(raw) as {
      report?: {
        overall_level?: string;
        mastery_score?: number;
        strong_topics?: { topic?: string }[];
        weak_topics?: { topic?: string }[];
      };
    };
    const r = bundle.report;
    if (!r?.overall_level) return null;
    return {
      studentLevel: String(r.overall_level),
      strongTopics: (r.strong_topics ?? [])
        .map((s) => s.topic)
        .filter((t): t is string => Boolean(t?.trim())),
      weakTopics: (r.weak_topics ?? [])
        .map((w) => w.topic)
        .filter((t): t is string => Boolean(t?.trim())),
      masteryScore:
        typeof r.mastery_score === "number" && Number.isFinite(r.mastery_score)
          ? r.mastery_score
          : 50,
    };
  } catch {
    return null;
  }
}

function appendPracticeEvent(ev: PracticeEvent) {
  try {
    const raw = sessionStorage.getItem(PRACTICE_EVENTS_STORAGE_KEY) || "[]";
    const arr = JSON.parse(raw) as PracticeEvent[];
    arr.push(ev);
    sessionStorage.setItem(PRACTICE_EVENTS_STORAGE_KEY, JSON.stringify(arr));
  } catch {
    /* ignore */
  }
}

function readPracticeEvents(): PracticeEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(PRACTICE_EVENTS_STORAGE_KEY) || "[]";
    const arr = JSON.parse(raw) as PracticeEvent[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function reorderBySolvedHistory(
  questions: PracticeQuestion[],
  events: PracticeEvent[],
): PracticeQuestion[] {
  if (questions.length <= 1) return questions;
  const solved = new Set(
    events.map((e) => e.questionId?.trim()).filter((id): id is string => Boolean(id)),
  );
  if (solved.size === 0) return questions;
  const unseen = questions.filter((q) => !solved.has(q.id));
  const seen = questions.filter((q) => solved.has(q.id));
  return [...unseen, ...seen];
}

function readCompletedBatchCount(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = sessionStorage.getItem(PRACTICE_BATCH_REPORTS_STORAGE_KEY) ?? "[]";
    const arr = JSON.parse(raw) as Array<{ batchId?: string }>;
    if (!Array.isArray(arr)) return 0;
    const ids = new Set(arr.map((r) => r.batchId).filter((id): id is string => Boolean(id)));
    return ids.size;
  } catch {
    return 0;
  }
}

function readLatestBatchRecommendedLevel(): "L1" | "L2" | "L3" | "L4" | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PRACTICE_BATCH_REPORTS_STORAGE_KEY) ?? "[]";
    const arr = JSON.parse(raw) as Array<{ recommendedLevel?: unknown }>;
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const v = arr[arr.length - 1]?.recommendedLevel;
    return v === "L1" || v === "L2" || v === "L3" || v === "L4" ? v : null;
  } catch {
    return null;
  }
}

function initialQuestionState() {
  return {
    selected: null as string | null,
    fillInput: "",
    thought: "",
    tutorVisible: false,
    tutorText: "",
    hintsThrough: -1,
    hintPanelVisible: false,
  };
}

type LoadState = "loading" | "ready" | "error";

export default function PracticePage() {
  const router = useRouter();
  const [list, setList] = useState<PracticeQuestion[]>(PRACTICE_QUESTIONS);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadNote, setLoadNote] = useState<string | null>(null);

  const [questionIndex, setQuestionIndex] = useState(0);
  const [finished, setFinished] = useState(false);

  const [selected, setSelected] = useState<string | null>(null);
  const [fillInput, setFillInput] = useState("");
  const [thought, setThought] = useState("");
  const [tutorVisible, setTutorVisible] = useState(false);
  const [tutorText, setTutorText] = useState("");
  const [hintsThrough, setHintsThrough] = useState(-1);
  const [hintPanelVisible, setHintPanelVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [hintPending, setHintPending] = useState(false);
  const [nextPending, setNextPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tutorNotice, setTutorNotice] = useState<string | null>(null);
  const [thoughtSubmitCount, setThoughtSubmitCount] = useState(0);
  const [tutorTurns, setTutorTurns] = useState<TutorChatTurn[]>([]);
  const [batchAttempts, setBatchAttempts] = useState<BatchQuestionAttempt[]>([]);
  const [currentBatchId, setCurrentBatchId] = useState("");
  const [currentBatchIndex, setCurrentBatchIndex] = useState(0);
  const [totalSolvedCount, setTotalSolvedCount] = useState(0);
  const [uniqueSolvedCount, setUniqueSolvedCount] = useState(0);
  const [loadToken, setLoadToken] = useState(0);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      try {
        globalThis.window?.mathVirtualKeyboard?.hide({ animate: false });
      } catch {
        /* ignore */
      }
    };
  }, []);

  function readMasterySummary(): Pick<
    MasteryReportV2,
    "topicScores" | "recommendedTopicOrder" | "recommendedDifficulty"
  > | null {
    if (typeof window === "undefined") return null;
    try {
      const raw = sessionStorage.getItem(MASTERY_REPORT_V2_STORAGE_KEY);
      if (!raw) return null;
      const m = JSON.parse(raw) as MasteryReportV2;
      const latestBatchLevel = readLatestBatchRecommendedLevel();
      return {
        topicScores: m.topicScores ?? {},
        recommendedTopicOrder: m.recommendedTopicOrder ?? [],
        recommendedDifficulty: latestBatchLevel ?? m.recommendedDifficulty,
      };
    } catch {
      const latestBatchLevel = readLatestBatchRecommendedLevel();
      if (!latestBatchLevel) return null;
      return {
        topicScores: {},
        recommendedTopicOrder: [],
        recommendedDifficulty: latestBatchLevel,
      };
    }
  }

  useEffect(() => {
    let cancelled = false;
    const tags = readWeakTopicTagsFromDiagnostic();
    const masteryRaw =
      typeof window !== "undefined"
        ? sessionStorage.getItem(MASTERY_REPORT_V2_STORAGE_KEY) ?? ""
        : "";
    const fp = buildPracticeSessionFingerprint(tags, masteryRaw);
    const cached = readPracticeSession(PRACTICE_SESSION_STORAGE_KEY, fp);
    const events = readPracticeEvents();
    setTotalSolvedCount(events.length);
    setUniqueSolvedCount(new Set(events.map((e) => e.questionId)).size);
    if (cached && !cached.finished && cached.currentBatchId.trim()) {
      setList(cached.questions);
      setQuestionIndex(cached.questionIndex);
      setCurrentBatchId(cached.currentBatchId);
      setCurrentBatchIndex(cached.currentBatchIndex ?? readCompletedBatchCount());
      setBatchAttempts(cached.batchAttempts);
      setFinished(false);
      setLoadNote(cached.loadNote);
      setSelected(cached.selected);
      setFillInput(cached.fillInput);
      setThought(cached.thought);
      setTutorVisible(cached.tutorVisible);
      setTutorText(cached.tutorText);
      setHintsThrough(cached.hintsThrough);
      setHintPanelVisible(cached.hintPanelVisible);
      setThoughtSubmitCount(cached.thoughtSubmitCount);
      setTutorTurns(cached.tutorTurns);
      setLoadState("ready");
      return () => {
        cancelled = true;
      };
    }

    setLoadState("loading");
    void (async () => {
      try {
        const qs =
          tags.length > 0
            ? `?prioritize=${encodeURIComponent(tags.join(","))}`
            : "";
        const r = await fetch(`/api/practice/questions${qs}`);
        const data = (await r.json()) as {
          questions?: PracticeQuestion[];
          source?: string;
          warning?: string;
          prioritize?: string[];
        };
        if (cancelled) return;
        if (data.questions?.length) {
          let finalQuestions = data.questions;
          const aiNotes: string[] = [];
          let generatedCount = 0;
          const report = readDiagnosticReport();
          if (report) {
            try {
              const masterySummary = readMasterySummary();
              const l4Mode = masterySummary?.recommendedDifficulty === "L4";
              const cur = await fetch("/api/practice/ai-curation", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  report,
                  questions: data.questions,
                  masterySummary,
                  options: {
                    minWeakTopicCoverage: l4Mode ? 2 : 1,
                    minTotalQuestions: 5,
                    maxGenerate: l4Mode ? 40 : 20,
                  },
                }),
              });
              if (cur.ok) {
                const j = (await cur.json()) as {
                  questions?: PracticeQuestion[];
                  meta?: {
                    orderedByAi?: boolean;
                    generatedCount?: number;
                    skippedReason?: string;
                    error?: string;
                  };
                };
                if (j.questions?.length) finalQuestions = j.questions;
                generatedCount = j.meta?.generatedCount ?? 0;
                if (j.meta?.orderedByAi) {
                  aiNotes.push("已由 DeepSeek 依掌握報告調整練習題順序。");
                }
                if (l4Mode) {
                  aiNotes.push("目前為 L4 強化模式：本批優先使用 AI 題並提高難度。");
                }
                if (j.meta?.skippedReason === "no_deepseek_key") {
                  aiNotes.push("未偵測到 DeepSeek 金鑰，已略過 AI 排序與補題。");
                }
                if (j.meta?.error) {
                  aiNotes.push(`AI 編排：${j.meta.error}`);
                }
              }
            } catch {
              /* 維持原題序 */
            }
          }
          finalQuestions = reorderBySolvedHistory(finalQuestions, events);
          const visibleAiInBatch = finalQuestions
            .slice(0, 5)
            .filter((q) => q.source === "ai").length;
          if (generatedCount > 0 && visibleAiInBatch > 0) {
            aiNotes.push(
              `已依報告與題庫風格補上 ${generatedCount} 題 AI 新題（本組可見 ${visibleAiInBatch} 題）。`,
            );
          }
          setList(finalQuestions);
          setCurrentBatchId(`batch-${Date.now()}`);
          setCurrentBatchIndex(readCompletedBatchCount());
          const prioNote =
            data.prioritize && data.prioritize.length > 0
              ? `已依診斷弱項優先排序：${data.prioritize.join("、")}。`
              : null;
          const baseNote =
            data.source === "supabase"
              ? prioNote
              : [prioNote, data.warning ?? "使用本機示範題"]
                  .filter(Boolean)
                  .join(" ");
          setLoadNote(
            [baseNote, ...aiNotes].filter(Boolean).join(" ") || null,
          );
        } else {
          setList(reorderBySolvedHistory(PRACTICE_QUESTIONS, events));
          setCurrentBatchId(`batch-${Date.now()}`);
          setCurrentBatchIndex(readCompletedBatchCount());
          setLoadNote(data.warning ?? "使用本機示範題");
        }
        if (!cancelled) setLoadState("ready");
      } catch {
        if (!cancelled) {
          setList(reorderBySolvedHistory(PRACTICE_QUESTIONS, events));
          setCurrentBatchId(`batch-${Date.now()}`);
          setCurrentBatchIndex(readCompletedBatchCount());
          setLoadNote("無法載入題庫 API，使用本機示範題");
          setLoadState("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadToken]);

  useEffect(() => {
    if (loadState !== "ready" || finished || !currentBatchId) return;
    const tags = readWeakTopicTagsFromDiagnostic();
    const masteryRaw = sessionStorage.getItem(MASTERY_REPORT_V2_STORAGE_KEY) ?? "";
    const fp = buildPracticeSessionFingerprint(tags, masteryRaw);
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      writePracticeSession(PRACTICE_SESSION_STORAGE_KEY, {
        v: 2,
        fingerprint: fp,
        questions: list,
        questionIndex,
        currentBatchId,
        currentBatchIndex,
        batchAttempts,
        finished: false,
        loadNote,
        selected,
        fillInput,
        thought,
        tutorVisible,
        tutorText,
        hintsThrough,
        hintPanelVisible,
        thoughtSubmitCount,
        tutorTurns,
      });
    }, 450);
    return () => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
    };
  }, [
    loadState,
    finished,
    currentBatchId,
    currentBatchIndex,
    list,
    questionIndex,
    batchAttempts,
    loadNote,
    selected,
    fillInput,
    thought,
    tutorVisible,
    tutorText,
    hintsThrough,
    hintPanelVisible,
    thoughtSubmitCount,
    tutorTurns,
  ]);

  const BATCH_SIZE = 5;
  const total = Math.min(BATCH_SIZE, list.length);
  const q: PracticeQuestion | undefined = list[questionIndex];
  const progressPct = total > 0 ? ((questionIndex + 1) / total) * 100 : 0;
  const isLast = total > 0 && questionIndex >= total - 1;
  const maxHintIdx = q ? Math.max(0, q.hintSteps.length - 1) : 0;
  const canRequestMoreHint =
    !!q && tutorVisible && q.hintSteps.length > 0 && hintsThrough < maxHintIdx;
  const allHintsUnlocked =
    !!q && hintPanelVisible && q.hintSteps.length > 0 && hintsThrough >= maxHintIdx;

  const canAdvance = useMemo(() => {
    if (!q) return false;
    if (q.kind === "mcq") return selected != null;
    return fillInput.trim().length > 0;
  }, [q, selected, fillInput]);

  const resetToQuestion = useCallback((idx: number) => {
    setQuestionIndex(idx);
    const s = initialQuestionState();
    setSelected(s.selected);
    setFillInput(s.fillInput);
    setThought(s.thought);
    setTutorVisible(s.tutorVisible);
    setTutorText(s.tutorText);
    setHintsThrough(s.hintsThrough);
    setHintPanelVisible(s.hintPanelVisible);
    setThoughtSubmitCount(0);
    setTutorTurns([]);
    setTutorNotice(null);
    setError(null);
  }, []);

  const reloadQuestions = useCallback(() => {
    clearPracticeSession(PRACTICE_SESSION_STORAGE_KEY);
    setBatchAttempts([]);
    setFinished(false);
    setCurrentBatchId("");
    setCurrentBatchIndex(readCompletedBatchCount());
    resetToQuestion(0);
    const events = readPracticeEvents();
    setTotalSolvedCount(events.length);
    setUniqueSolvedCount(new Set(events.map((e) => e.questionId)).size);
    setLoadToken((t) => t + 1);
  }, [resetToQuestion]);

  const goNextQuestion = useCallback(async () => {
    if (!canAdvance || !q || nextPending) return;
    const thoughtHistory = [
      ...tutorTurns
        .filter((t) => t.role === "user")
        .map((t) => t.content.trim())
        .filter(Boolean),
      thought.trim(),
    ];
    const dedupThoughtHistory = [...new Set(thoughtHistory)].slice(-8);
    const attempt: BatchQuestionAttempt = {
      questionId: q.id,
      questionStemPlain: q.stemLatex.map((s) => (s.t === "text" ? s.v : `$${s.m}$`)).join(""),
      topicTag: q.topicTag,
      topicLabel: q.unitPill ?? q.topicTag ?? "向量",
      kind: q.kind,
      difficulty: q.difficulty,
      isAiGenerated: q.source === "ai",
      selectedChoice: selected,
      expectedChoiceKey: q.kind === "mcq" ? q.correctKey : null,
      studentFillAnswer: q.kind === "fill" ? fillInput.trim() : null,
      expectedFillAnswer: q.kind === "fill" ? q.fillAnswer ?? null : null,
      thoughtSummary: thought.trim(),
      thoughtHistory: dedupThoughtHistory,
      hintsUnlockedLayerMax: hintsThrough,
    };

    const nextAttempts = [...batchAttempts, attempt];
    appendPracticeEvent({
      questionId: q.id,
      batchId: currentBatchId,
      batchIndex: currentBatchIndex,
      topicTag: q.topicTag,
      difficulty: q.difficulty,
      isAiGenerated: q.source === "ai",
      at: new Date().toISOString(),
      completed: true,
      maxHintLayer: hintsThrough,
      hadThoughtSubmit: thought.trim().length > 0,
      studentAnswerRaw:
        q.kind === "mcq"
          ? (selected ?? "（未選）")
          : (fillInput.trim() || "（未填）"),
    });
    const eventsAfter = readPracticeEvents();
    setTotalSolvedCount(eventsAfter.length);
    setUniqueSolvedCount(new Set(eventsAfter.map((e) => e.questionId)).size);

    setNextPending(true);
    if (isLast) {
      try {
        const r = await fetch("/api/practice/batch-report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            batchId: currentBatchId,
            batchIndex: currentBatchIndex,
            attempts: nextAttempts,
            baselineLevel:
              readMasterySummary()?.recommendedDifficulty ??
              readDiagnosticReport()?.recommended_start_level ??
              null,
          }),
        });
        let report: BatchReport | null = null;
        if (r.ok) {
          const data = (await r.json()) as { report?: BatchReport };
          report = data.report ?? null;
        }
        sessionStorage.setItem(
          PRACTICE_ACTIVE_BATCH_STORAGE_KEY,
          JSON.stringify({
            batchId: currentBatchId,
            batchIndex: currentBatchIndex,
            attempts: nextAttempts,
            report,
            generatedAt: new Date().toISOString(),
          }),
        );
      } catch {
        sessionStorage.setItem(
          PRACTICE_ACTIVE_BATCH_STORAGE_KEY,
          JSON.stringify({
            batchId: currentBatchId,
            batchIndex: currentBatchIndex,
            attempts: nextAttempts,
            report: null,
            generatedAt: new Date().toISOString(),
          }),
        );
      }
      clearPracticeSession(PRACTICE_SESSION_STORAGE_KEY);
      setBatchAttempts(nextAttempts);
      setFinished(true);
      router.push("/practice/report");
      return;
    }

    setBatchAttempts(nextAttempts);
    resetToQuestion(questionIndex + 1);
    setNextPending(false);
  }, [
    canAdvance,
    q,
    isLast,
    questionIndex,
    resetToQuestion,
    hintsThrough,
    thought,
    nextPending,
    selected,
    fillInput,
    batchAttempts,
    currentBatchId,
    currentBatchIndex,
    router,
  ]);

  const submitThought = useCallback(async () => {
    if (!q || !thought.trim() || pending) {
      return;
    }
    setError(null);
    setTutorNotice(null);
    setPending(true);
    const attemptCount = thoughtSubmitCount + 1;
    const hintsGiven = hintsThrough >= 0 ? hintsThrough + 1 : 0;
    const diagnosticContext = readTutorDiagnosticContext();
    const userLine = thought.trim();
    try {
      const r = await fetch("/api/tutor/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: q.id,
          ...(q.source === "ai" ? { inlineQuestion: q } : {}),
          thought: userLine,
          selectedChoice: selected,
          studentFillAnswer: q.kind === "fill" ? fillInput.trim() || null : null,
          diagnosticContext,
          attemptCount,
          hintsGiven,
          conversationHistory: tutorTurns,
        }),
      });
      if (!r.ok) {
        throw new Error("請求失敗");
      }
      const data = (await r.json()) as TutorChatResponse;
      setTutorText(data.assistantMessage);
      if (data.replySource === "no_api_key") {
        setTutorNotice(
          "未偵測到 `DEEPSEEK_API_KEY`，因此顯示題庫內建導師文案。請在專案根目錄 `.env.local` 設定（勿加引號、勿留前後空格），存檔後重新啟動 `npm run dev`。",
        );
      } else if (data.replySource === "error") {
        setTutorNotice(
          "伺服器已收到請求，但呼叫 DeepSeek 失敗（金鑰、額度、模型名稱或網路問題）。終端機會出現 `[tutor/chat]` 錯誤日誌；畫面上為本機備援文案。",
        );
      } else {
        setTutorNotice(null);
      }
      setTutorVisible(true);
      const hi = data.uiSignal?.hint_index_used;
      const cap = q.hintSteps.length > 0 ? q.hintSteps.length - 1 : -1;
      if (
        cap >= 0 &&
        typeof hi === "number" &&
        Number.isFinite(hi) &&
        hi >= 0
      ) {
        const clamped = Math.min(Math.floor(hi), cap);
        setHintsThrough((prev) => Math.max(prev, clamped));
        setHintPanelVisible(true);
      } else {
        setHintPanelVisible(false);
        setHintsThrough(-1);
      }
      setThoughtSubmitCount((c) => c + 1);
      setTutorTurns((prev) => [
        ...prev,
        { role: "user", content: userLine },
        { role: "assistant", content: data.assistantMessage },
      ]);
    } catch {
      setTutorNotice(null);
      setError("無法連線到教學 API，已顯示本機示範回應。");
      setTutorText(q.thoughtReply);
      setTutorVisible(true);
      setHintPanelVisible(false);
      setHintsThrough(-1);
      setThoughtSubmitCount((c) => c + 1);
      setTutorTurns((prev) => [
        ...prev,
        { role: "user", content: userLine },
        { role: "assistant", content: q.thoughtReply },
      ]);
    } finally {
      setPending(false);
    }
  }, [
    thought,
    pending,
    selected,
    fillInput,
    q,
    thoughtSubmitCount,
    hintsThrough,
    tutorTurns,
  ]);

  const requestHint = useCallback(async () => {
    if (!q || !tutorVisible || q.hintSteps.length === 0 || hintPending) return;
    const next = hintsThrough + 1;
    if (next > maxHintIdx) return;
    setHintPending(true);
    setError(null);
    try {
      const r = await fetch("/api/tutor/hint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: q.id,
          ...(q.source === "ai" ? { inlineQuestion: q } : {}),
          hintIndex: next,
          studentThought: thought.trim() || null,
        }),
      });
      if (!r.ok) throw new Error("hint failed");
      const data = (await r.json()) as { coachReply: string };
      setHintPanelVisible(true);
      setHintsThrough(next);
      setTutorText(data.coachReply);
    } catch {
      setHintPanelVisible(true);
      setHintsThrough(next);
      setTutorText(q.hintReplies[next] ?? "");
      setError("提示改寫 API 失敗，已暫用本機備援文案。");
    } finally {
      setHintPending(false);
    }
  }, [q, tutorVisible, hintsThrough, maxHintIdx, thought, hintPending]);

  const thinkAgain = useCallback(() => {
    setThought("");
    setTutorVisible(false);
    setTutorText("");
    setTutorNotice(null);
    setThoughtSubmitCount(0);
    setTutorTurns([]);
    setHintsThrough(-1);
    setHintPanelVisible(false);
  }, []);

  if (loadState === "loading") {
    return <PracticeLoadingSkeleton />;
  }

  if (!q) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 py-12">
        <PracticePageHeading />
        <p className="text-center text-sm text-[var(--txt-3)]">載入題庫…</p>
      </div>
    );
  }

  if (finished) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-center text-xl font-semibold text-[var(--txt)]">
          本輪練習完成
        </h1>
        <p className="text-center text-sm text-[var(--txt-2)]">你已做完 {total} 題。</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/practice/report"
            className="rounded-xl bg-[var(--learn-600)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--learn-500)]"
          >
            查看本次 5 題小結
          </Link>
          <Link
            href="/mastery"
            className="rounded-xl border border-[var(--learn-500)]/40 px-5 py-2.5 text-sm font-medium text-[var(--learn-700)] hover:bg-[var(--bg-hover)]"
          >
            掌握追蹤（AI 報告）
          </Link>
          <Link
            href="/"
            className="rounded-xl border border-[var(--border)] px-5 py-2.5 text-sm font-medium text-[var(--txt)] hover:bg-[var(--bg-hover)]"
          >
            回到首頁
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PracticePageHeading />
      {loadNote && questionIndex === 0 && (
        <div className="flex items-start gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-inset)] px-4 py-3 text-xs text-[var(--txt-2)]">
          <span className="mt-0.5 shrink-0 text-[var(--learn-500)]">ℹ</span>
          <span>{loadNote}</span>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <p className="text-xs text-[var(--txt-2)]">
            累積已做 {totalSolvedCount} 題（不重複 {uniqueSolvedCount} 題）
          </p>
          <span className="text-sm font-semibold tabular-nums text-[var(--learn-600)]">
            {questionIndex + 1} / {total}
          </span>
        </div>
        <div className="space-y-1.5">
          <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200">
            <div
              className="h-full rounded-full bg-[var(--learn-500)] transition-all duration-500 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="flex gap-1">
            {Array.from({ length: total }).map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                  i < questionIndex
                    ? "bg-[var(--learn-500)]"
                    : i === questionIndex
                      ? "bg-[var(--learn-100)]"
                      : "bg-zinc-200"
                }`}
              />
            ))}
          </div>
        </div>
        <div className="flex justify-end pt-0.5">
          <button
            type="button"
            onClick={reloadQuestions}
            className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 py-1.5 text-xs font-medium text-[var(--txt-2)] hover:border-[var(--learn-500)]/40 hover:bg-[var(--bg-hover)] hover:text-[var(--txt)]"
          >
            重新編排題目
          </button>
        </div>
      </div>

      <section
        className={`overflow-hidden rounded-[var(--r-card)] border border-[var(--border)] border-l-4 rounded-l-none bg-[var(--bg-card)] shadow-[var(--shadow-card)] transition-shadow duration-200 hover:shadow-[var(--shadow-lift)] ${
          q.difficulty === "L1"
            ? "border-l-[var(--lvl1)]"
            : q.difficulty === "L2"
              ? "border-l-[var(--lvl2)]"
              : "border-l-[var(--lvl3)]"
        }`}
      >
        <div className="p-6">
        <div className="flex flex-wrap gap-2 text-xs font-medium">
          <span className="rounded-[var(--r-pill)] bg-zinc-100 px-2.5 py-0.5 text-[11px] font-medium leading-none tracking-wide text-zinc-700 ring-1 ring-zinc-300/50">
            {q.difficulty || "L2"}
          </span>
          <span className="rounded-[var(--r-pill)] bg-[var(--lvl1)]/12 px-2.5 py-0.5 text-[11px] font-medium leading-none tracking-wide text-[var(--lvl1)] ring-1 ring-[var(--lvl1)]/25">
            {q.unitPill}
          </span>
          <span className="rounded-[var(--r-pill)] bg-zinc-50 px-2.5 py-0.5 text-[11px] font-medium leading-none tracking-wide text-zinc-500 ring-1 ring-zinc-200">
            {q.typeLabel}
          </span>
          {q.source === "ai" ? (
            <span className="rounded-[var(--r-pill)] bg-[var(--clr-ai)]/15 px-2.5 py-0.5 text-[11px] font-medium leading-none tracking-wide text-[var(--clr-ai)] ring-1 ring-[var(--clr-ai)]/30">
              AI生成
            </span>
          ) : null}
        </div>

        {q.imageUrl ? (
          <div className="mt-5 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-inset)] p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={q.imageUrl}
              alt="題目附圖"
              className={imageWrapperClass(q.imagePosition)}
            />
          </div>
        ) : null}

        <div className="mt-5 text-base leading-relaxed text-[var(--txt)] [&_.katex]:text-[var(--txt)]">
          {q.stemLatex.map((seg, i) =>
            seg.t === "text" ? (
              <span key={i}>{seg.v}</span>
            ) : (
              <InlineLatex key={i} latex={seg.m} className="text-[var(--txt)]" />
            ),
          )}
        </div>

        {q.kind === "mcq" ? (
          <ul className="mt-6 space-y-2.5">
            {q.options.map((opt) => {
              const on = selected === opt.key;
              return (
                <li key={opt.key}>
                  <label
                    className={
                      on
                        ? "flex cursor-pointer items-center gap-3 rounded-xl border-2 border-[var(--learn-500)] bg-[var(--learn-50)] px-4 py-3 shadow-[0_0_0_3px_rgba(13,140,122,0.15)]"
                        : "flex cursor-pointer items-center gap-3 rounded-xl border border-zinc-200 bg-[var(--bg-card)] px-4 py-3 hover:border-[var(--learn-500)]/40 hover:bg-[var(--learn-50)]/70"
                    }
                  >
                    <input
                      type="radio"
                      className="size-4 accent-teal-700"
                      name={`practice-q-${q.id}`}
                      checked={on}
                      onChange={() => setSelected(opt.key)}
                    />
                    <span
                      className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                        on
                          ? "bg-[var(--learn-600)] text-white"
                          : "bg-zinc-100 text-zinc-600"
                      }`}
                    >
                      {opt.key}
                    </span>
                    <span className="text-sm text-[var(--txt)] [&_.katex]:text-[var(--txt)]">
                      <InlineLatex latex={opt.latex} className="text-[var(--txt)]" />
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="mt-6">
            <label className="text-xs font-medium text-[var(--txt-3)]">
              你的答案
            </label>
            <MathLiveInput
              className="mt-1.5 block"
              instanceKey={`fill-${questionIndex}-${q.id}`}
              value={fillInput}
              onChange={setFillInput}
              defaultMode="math"
              keyboardHint={q.kind === "fill"}
              fieldClassName="w-full min-h-[5.75rem] rounded-xl border border-[var(--border)] bg-[var(--bg-inset)] px-4 py-3 text-base text-[var(--txt)] shadow-inner outline-none focus:border-[var(--learn-500)] focus:ring-2 focus:ring-[var(--learn-500)]/20"
            />
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            void goNextQuestion();
          }}
          disabled={!canAdvance || nextPending}
          className="mt-6 w-full rounded-[var(--r-btn)] bg-[var(--learn-600)] px-6 py-2.5 text-sm font-medium text-white shadow-[0_2px_0_var(--learn-700)] transition-all hover:-translate-y-px hover:bg-[var(--learn-500)] hover:shadow-[0_4px_0_var(--learn-700)] active:translate-y-px disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-[var(--learn-100)] disabled:text-[var(--learn-700)] disabled:shadow-none"
        >
          {nextPending
            ? "整理本組中…"
            : isLast
              ? "完成本組 5 題"
              : "下一題 →"}
        </button>
        <p className="mt-2 text-center text-xs text-[var(--txt-3)]">
          {q.kind === "mcq"
            ? "選好選項即可按「下一題」。若要導師回饋，請在下方提交思路。"
            : "填寫答案後可按「下一題」。若要導師回饋，請在下方提交思路。"}
        </p>
        </div>
      </section>

      <section className="overflow-hidden rounded-[var(--r-card)] border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-card)] transition-shadow duration-200 hover:shadow-[var(--shadow-lift)] sm:p-6">
        <div className="flex items-center gap-2 text-[var(--txt)]">
          <CloudIcon className="size-5 text-[var(--learn-600)]" />
          <h2 className="font-semibold">你的思路</h2>
          <span className="ml-auto text-xs text-[var(--txt-3)]">寫一步也可以，不用完整</span>
        </div>
        <MathLiveInput
          className="mt-3"
          instanceKey={`thought-${questionIndex}-${q.id}`}
          value={thought}
          onChange={setThought}
          defaultMode="math"
          smartMode
          keyboardHint={q.kind === "mcq"}
          fieldClassName="w-full min-h-[7rem] rounded-xl border border-[var(--border)] bg-[var(--bg-inset)] px-4 py-3 text-base text-[var(--txt)] shadow-inner outline-none focus:border-[var(--learn-500)] focus:ring-2 focus:ring-[var(--learn-500)]/20"
        />
        {error && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-400">
            <span>⚠</span> {error}
          </p>
        )}
        <button
          type="button"
          onClick={submitThought}
          disabled={!thought.trim() || pending}
          className="mt-4 w-full rounded-[var(--r-btn)] bg-[var(--learn-600)] px-6 py-2.5 text-sm font-medium text-white shadow-[0_2px_0_var(--learn-700)] transition-all hover:-translate-y-px hover:bg-[var(--learn-500)] hover:shadow-[0_4px_0_var(--learn-700)] active:translate-y-px disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-[var(--learn-100)] disabled:text-[var(--learn-700)] disabled:shadow-none"
        >
          {pending ? "分析中…" : "提交思路"}
        </button>
      </section>

      {tutorVisible && (
        <>
          <section className="relative overflow-hidden rounded-[var(--r-card)] border border-[var(--learn-500)]/30 bg-[var(--bg-card)] p-5 shadow-[var(--shadow-card)] sm:p-6">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--learn-500)]/80 to-transparent" />
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--learn-500)]/50 bg-[var(--learn-50)] text-xs font-bold text-[var(--learn-700)]">
                AI
              </span>
              <div>
                <h2 className="font-semibold text-[var(--txt)]">導師回應</h2>
                <p className="text-xs text-[var(--learn-600)]">Socratic 引導</p>
              </div>
            </div>
            <div className="mt-4 text-[var(--txt)]">
              <TutorMixedContent text={tutorText} className="text-[var(--txt)]" />
            </div>
            {tutorNotice && (
              <p className="mt-3 rounded-xl border border-amber-600/40 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                {tutorNotice}
              </p>
            )}
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  void requestHint();
                }}
                disabled={!canRequestMoreHint || hintPending}
                className="rounded-xl border border-[var(--learn-300)] bg-[var(--learn-100)] px-4 py-2 text-sm font-medium text-[var(--learn-700)] transition-colors hover:bg-[var(--learn-50)] disabled:cursor-not-allowed disabled:border-[var(--learn-200)] disabled:bg-[var(--learn-50)] disabled:text-[var(--learn-700)] disabled:opacity-55"
              >
                {hintPending ? "產生中…" : "需要提示"}
              </button>
              <button
                type="button"
                onClick={thinkAgain}
                className="rounded-xl border border-[var(--learn-200)] bg-[var(--bg-card)] px-4 py-2 text-sm font-medium text-[var(--learn-700)] transition-colors hover:bg-[var(--learn-50)]"
              >
                我再想想
              </button>
            </div>
            {allHintsUnlocked && (
              <p className="mt-3 text-xs text-[var(--txt-2)]">
                提示已全部解鎖；若要重新開始本題思路，可按「我再想想」。
              </p>
            )}
          </section>

          {hintPanelVisible && q.hintSteps.length > 0 && (
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-card)] sm:p-6">
              <h3 className="font-semibold text-[var(--txt)]">提示進度</h3>
              <p className="mt-1 text-xs text-[var(--txt-3)]">
                未解鎖的提示不顯示內容，避免提前暴雷。
              </p>
              <ul className="mt-3 divide-y divide-[var(--border)]">
                {q.hintSteps.map((_, i) => {
                  const unlocked = i <= hintsThrough;
                  return (
                    <li
                      key={i}
                      className="flex items-center justify-between gap-3 py-4 first:pt-1"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        {unlocked ? (
                          <span
                            className="flex size-8 shrink-0 items-center justify-center rounded-[var(--r-pill)] bg-[var(--clr-correct)]/15 text-sm text-[var(--clr-correct)] ring-1 ring-[var(--clr-correct)]/30"
                            aria-hidden
                          >
                            ✓
                          </span>
                        ) : (
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-[var(--r-pill)] bg-[var(--learn-50)] text-sm text-[var(--txt-3)] ring-1 ring-[var(--learn-200)]">
                            {i + 1}
                          </span>
                        )}
                        <div
                          className={
                            unlocked
                              ? "text-sm text-[var(--txt)]"
                              : "text-sm text-[var(--txt-3)]"
                          }
                        >
                          {unlocked
                            ? (
                              <TutorMixedContent
                                text={q.hintSteps[i]}
                                className="text-[var(--txt)]"
                              />
                            )
                            : `第 ${i + 1} 層提示（尚未解鎖）`}
                        </div>
                      </div>
                      <span
                        className={
                          unlocked
                            ? "shrink-0 rounded-[var(--r-pill)] bg-[var(--clr-correct)]/15 px-2.5 py-1 text-xs font-medium text-[var(--clr-correct)] ring-1 ring-[var(--clr-correct)]/30"
                            : "shrink-0 rounded-[var(--r-pill)] bg-[var(--learn-50)] px-2.5 py-1 text-xs font-medium text-[var(--txt-3)] ring-1 ring-[var(--learn-200)]"
                        }
                      >
                        {unlocked ? "已解鎖" : "鎖定"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </>
      )}

      <p className="text-center text-xs text-[var(--txt-3)]">
        題庫欄位對應見 <code className="rounded bg-zinc-100 px-1">lib/tutor/question-bank.ts</code>
        。若讀不到表，請檢查{" "}
        <code className="rounded bg-zinc-100 px-1">SUPABASE_QUESTIONS_TABLE</code>{" "}
        與 RLS，或加上{" "}
        <code className="rounded bg-zinc-100 px-1">SUPABASE_SERVICE_ROLE_KEY</code>。
        ·{" "}
        <Link
          href="/diagnostic/report"
          className="text-[var(--learn-600)] underline-offset-2 hover:underline"
        >
          掌握報告
        </Link>
      </p>
    </div>
  );
}
