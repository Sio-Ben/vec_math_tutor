"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { InlineLatex, TutorMixedContent } from "@/components/MathText";
import { DIAGNOSTIC_STORAGE_KEY } from "@/lib/diagnostic-types";
import type { ClientReport } from "@/lib/report-from-results";
import { PRACTICE_EVENTS_STORAGE_KEY } from "@/lib/progress/storage-keys";
import type { PracticeEvent } from "@/lib/progress/types";
import { stemToPlainWithLatex } from "@/lib/ai/prompt-b";
import type {
  TutorChatResponse,
  TutorChatTurn,
  TutorDiagnosticContext,
} from "@/lib/tutor/types";
import { isPracticeAnswerCorrect } from "@/lib/tutor/evaluate-practice";
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
  const [error, setError] = useState<string | null>(null);
  const [tutorNotice, setTutorNotice] = useState<string | null>(null);
  const [lastQuestionRecap, setLastQuestionRecap] = useState<string | null>(
    null,
  );
  const [recapLoading, setRecapLoading] = useState(false);
  const [thoughtSubmitCount, setThoughtSubmitCount] = useState(0);
  const [tutorTurns, setTutorTurns] = useState<TutorChatTurn[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const tags = readWeakTopicTagsFromDiagnostic();
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
          const report = readDiagnosticReport();
          if (report) {
            try {
              const cur = await fetch("/api/practice/ai-curation", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  report,
                  questions: data.questions,
                  options: {
                    minWeakTopicCoverage: 1,
                    minTotalQuestions: 4,
                    maxGenerate: 5,
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
                if (j.meta?.orderedByAi) {
                  aiNotes.push("已由 DeepSeek 依掌握報告調整練習題順序。");
                }
                if ((j.meta?.generatedCount ?? 0) > 0) {
                  aiNotes.push(
                    `已依報告與題庫風格補上 ${j.meta!.generatedCount} 題 AI 新題。`,
                  );
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
          setList(finalQuestions);
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
          setList(PRACTICE_QUESTIONS);
          setLoadNote(data.warning ?? "使用本機示範題");
        }
        setLoadState("ready");
      } catch {
        if (!cancelled) {
          setList(PRACTICE_QUESTIONS);
          setLoadNote("無法載入題庫 API，使用本機示範題");
          setLoadState("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const total = list.length;
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

  const goNextQuestion = useCallback(async () => {
    if (!canAdvance || !q || recapLoading) return;

    const correct = isPracticeAnswerCorrect(
      q,
      selected,
      q.kind === "fill" ? fillInput : null,
    );
    const studentAns =
      q.kind === "mcq"
        ? `選項 ${selected ?? "（未選）"}`
        : fillInput.trim() || "（未填）";
    const stdAns =
      q.kind === "mcq"
        ? `選項 ${q.correctKey}`
        : (q.fillAnswer?.trim() || "（題庫未設標準答案）");

    setRecapLoading(true);
    let recapText: string | null = null;
    try {
      const r = await fetch("/api/tutor/question-recap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: q.id,
          questionStemPlain: stemToPlainWithLatex(q),
          topicLabel: q.unitPill ?? q.topicTag ?? "向量",
          kind: q.kind,
          studentAnswerSummary: studentAns,
          standardAnswerSummary: stdAns,
          isCorrect: correct,
          thoughtSummary: thought.trim(),
          lastTutorReply: tutorVisible && tutorText.trim() ? tutorText.trim() : null,
          hintsUnlockedLayerMax: hintsThrough,
        }),
      });
      if (r.ok) {
        const j = (await r.json()) as { recap?: string | null };
        if (j.recap?.trim()) recapText = j.recap.trim();
      }
    } catch {
      /* 略過小結 */
    } finally {
      setRecapLoading(false);
    }

    appendPracticeEvent({
      questionId: q.id,
      topicTag: q.topicTag,
      at: new Date().toISOString(),
      completed: true,
      maxHintLayer: hintsThrough,
      hadThoughtSubmit: thought.trim().length > 0,
    });

    if (isLast) {
      setLastQuestionRecap(recapText);
      setFinished(true);
      return;
    }

    setLastQuestionRecap(recapText);
    resetToQuestion(questionIndex + 1);
  }, [
    canAdvance,
    q,
    isLast,
    questionIndex,
    resetToQuestion,
    hintsThrough,
    thought,
    recapLoading,
    selected,
    fillInput,
    tutorVisible,
    tutorText,
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
    setLastQuestionRecap(null);
  }, []);

  if (loadState === "loading" || !q) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center text-sm text-zinc-400">
        載入題庫…
      </div>
    );
  }

  if (finished) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-center text-xl font-semibold text-zinc-100">
          本輪練習完成
        </h1>
        <p className="text-center text-sm text-zinc-400">你已做完 {total} 題。</p>
        {lastQuestionRecap && (
          <section className="rounded-2xl border border-emerald-600/35 bg-emerald-50/95 p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-emerald-950">最後一題小結</h2>
            <div className="mt-2">
              <TutorMixedContent text={lastQuestionRecap} />
            </div>
          </section>
        )}
        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => {
              setLastQuestionRecap(null);
              setFinished(false);
              resetToQuestion(0);
            }}
            className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-500"
          >
            再來一輪
          </button>
          <Link
            href="/mastery"
            className="rounded-xl border border-violet-500/50 px-5 py-2.5 text-sm font-medium text-violet-200 hover:bg-zinc-800"
          >
            掌握追蹤（AI 報告）
          </Link>
          <Link
            href="/"
            className="rounded-xl border border-zinc-600 px-5 py-2.5 text-sm font-medium text-zinc-200 hover:bg-zinc-800"
          >
            回到首頁
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {loadNote && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-center text-xs text-amber-200/90">
          {loadNote}
        </p>
      )}

      {lastQuestionRecap && (
        <section className="rounded-2xl border border-emerald-600/35 bg-emerald-50/95 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-sm font-semibold text-emerald-950">上一題小結</h2>
            <button
              type="button"
              onClick={() => setLastQuestionRecap(null)}
              className="shrink-0 text-xs font-medium text-emerald-800/80 underline-offset-2 hover:text-emerald-950 hover:underline"
            >
              關閉
            </button>
          </div>
          <div className="mt-2">
            <TutorMixedContent text={lastQuestionRecap} />
          </div>
        </section>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="rounded-full bg-violet-500/25 px-4 py-1.5 text-sm font-medium text-violet-200">
          {q.unitPill}
          {q.difficulty ? (
            <span className="ml-2 text-violet-300/80">· {q.difficulty}</span>
          ) : null}
        </span>
        <div className="flex items-center gap-3">
          <div className="h-2 w-28 overflow-hidden rounded-full bg-zinc-800 sm:w-40">
            <div
              className="h-full rounded-full bg-violet-500 transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="text-sm tabular-nums text-zinc-400">
            {questionIndex + 1}/{total}題
          </span>
        </div>
      </div>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 sm:p-6">
        <p className="text-xs font-medium text-violet-400">{q.typeLabel}</p>

        {q.imageUrl ? (
          <div className="mt-4 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/50 p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={q.imageUrl}
              alt="題目附圖"
              className={imageWrapperClass(q.imagePosition)}
            />
          </div>
        ) : null}

        <div className="mt-4 text-base leading-relaxed text-zinc-100">
          {q.stemLatex.map((seg, i) =>
            seg.t === "text" ? (
              <span key={i}>{seg.v}</span>
            ) : (
              <InlineLatex key={i} latex={seg.m} className="text-zinc-100" />
            ),
          )}
        </div>

        {q.kind === "mcq" ? (
          <div className="mt-6 grid grid-cols-2 gap-3">
            {q.options.map((opt) => {
              const on = selected === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setSelected(opt.key)}
                  className={
                    on
                      ? "flex items-center gap-3 rounded-2xl border-2 border-violet-500 bg-violet-500/15 p-4 text-left transition"
                      : "flex items-center gap-3 rounded-2xl border border-zinc-700 bg-zinc-950/40 p-4 text-left transition hover:border-zinc-600"
                  }
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-violet-600 text-sm font-bold text-white">
                    {opt.key}
                  </span>
                  <span className="text-lg text-zinc-100">
                    <InlineLatex latex={opt.latex} className="text-zinc-100" />
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="mt-6">
            <label className="text-xs font-medium text-zinc-400">
              你的答案
            </label>
            <textarea
              value={fillInput}
              onChange={(e) => setFillInput(e.target.value)}
              rows={3}
              placeholder="輸入答案或簡要過程…"
              className="mt-1 w-full resize-y rounded-2xl border border-zinc-700 bg-[#0a0b10] px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/25"
            />
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            void goNextQuestion();
          }}
          disabled={!canAdvance || recapLoading}
          className="mt-6 w-full rounded-2xl border border-zinc-600 bg-zinc-800/80 py-3 text-sm font-semibold text-zinc-100 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:bg-zinc-900 disabled:text-zinc-600"
        >
          {recapLoading
            ? "產生小結中…"
            : isLast
              ? "完成本輪"
              : "下一題"}
        </button>
        <p className="mt-2 text-center text-xs text-zinc-500">
          {q.kind === "mcq"
            ? "選好選項即可按「下一題」。若要導師回饋，請在下方提交思路。"
            : "填寫答案後可按「下一題」。若要導師回饋，請在下方提交思路。"}
        </p>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 sm:p-6">
        <div className="flex items-center gap-2 text-zinc-100">
          <CloudIcon className="size-5 text-violet-400" />
          <h2 className="font-semibold">你的思路</h2>
        </div>
        <textarea
          value={thought}
          onChange={(e) => setThought(e.target.value)}
          rows={5}
          placeholder="把你的想法寫在這裡，不用完整，寫一步也可以…"
          className="mt-4 w-full resize-y rounded-2xl border border-zinc-700 bg-[#0a0b10] px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/25"
        />
        {error && <p className="mt-2 text-xs text-amber-400">{error}</p>}
        <button
          type="button"
          onClick={submitThought}
          disabled={!thought.trim() || pending}
          className="mt-4 w-full rounded-2xl bg-violet-600 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
        >
          {pending ? "送出中…" : "提交思路"}
        </button>
      </section>

      {tutorVisible && (
        <>
          <section className="rounded-2xl border border-violet-400/35 bg-violet-200/90 p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white">
                AI
              </span>
              <h2 className="font-semibold text-zinc-900">導師回應</h2>
            </div>
            <div className="mt-3">
              <TutorMixedContent text={tutorText} />
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
                className="rounded-xl border border-violet-400/60 bg-white/60 px-4 py-2 text-sm font-medium text-violet-950 backdrop-blur-sm hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {hintPending ? "產生中…" : "需要提示"}
              </button>
              <button
                type="button"
                onClick={thinkAgain}
                className="rounded-xl border border-zinc-400/50 bg-transparent px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-white/40"
              >
                我再想想
              </button>
            </div>
            {allHintsUnlocked && (
              <p className="mt-3 text-xs text-zinc-600">
                提示已全部解鎖；若要重新開始本題思路，可按「我再想想」。
              </p>
            )}
          </section>

          {hintPanelVisible && q.hintSteps.length > 0 && (
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 sm:p-6">
              <h3 className="font-semibold text-zinc-100">提示進度</h3>
              <p className="mt-1 text-xs text-zinc-500">
                未解鎖的提示不顯示內容，避免提前暴雷。
              </p>
              <ul className="mt-3 divide-y divide-zinc-800">
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
                            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/25 text-sm text-emerald-400"
                            aria-hidden
                          >
                            ✓
                          </span>
                        ) : (
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-sm text-zinc-500">
                            {i + 1}
                          </span>
                        )}
                        <span
                          className={
                            unlocked
                              ? "text-sm text-zinc-200"
                              : "text-sm text-zinc-500"
                          }
                        >
                          {unlocked
                            ? q.hintSteps[i]
                            : `第 ${i + 1} 層提示（尚未解鎖）`}
                        </span>
                      </div>
                      <span
                        className={
                          unlocked
                            ? "shrink-0 rounded-full bg-emerald-500/20 px-2.5 py-1 text-xs font-medium text-emerald-400"
                            : "shrink-0 rounded-full bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-500"
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

      <p className="text-center text-xs text-zinc-500">
        題庫欄位對應見 <code className="rounded bg-zinc-800 px-1">lib/tutor/question-bank.ts</code>
        。若讀不到表，請檢查{" "}
        <code className="rounded bg-zinc-800 px-1">SUPABASE_QUESTIONS_TABLE</code>{" "}
        與 RLS，或加上{" "}
        <code className="rounded bg-zinc-800 px-1">SUPABASE_SERVICE_ROLE_KEY</code>。
        ·{" "}
        <Link
          href="/diagnostic/report"
          className="text-violet-400 underline-offset-2 hover:underline"
        >
          掌握報告
        </Link>
      </p>
    </div>
  );
}
