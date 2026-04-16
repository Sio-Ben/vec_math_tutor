import Link from "next/link";

function ClipboardIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="size-5 text-teal-600 dark:text-teal-400" aria-hidden>
      <rect x="6" y="2" width="8" height="3" rx="1" />
      <path d="M6 3H4a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1h-2" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="size-5 text-teal-600 dark:text-teal-400" aria-hidden>
      <path d="M3 15 L7 9 L11 12 L16 5" />
      <circle cx="16" cy="5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function BookOpenIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="size-5 text-teal-600 dark:text-teal-400" aria-hidden>
      <path d="M10 5C10 5 7 4 4 4v11c3 0 6 1 6 1V5z" />
      <path d="M10 5c0 0 3-1 6-1v11c-3 0-6 1-6 1V5z" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-4 ml-1.5 group-hover:translate-x-0.5" aria-hidden>
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  );
}

const cards = [
  {
    title: "問卷",
    desc: "8 題混合計算，約 10 分鐘，對應 L1–L3 各項標準。",
    href: "/diagnostic",
    Icon: ClipboardIcon,
  },
  {
    title: "掌握報告",
    desc: "問卷完成後即可查看加權掌握分、強弱項分析。",
    href: "/diagnostic/report",
    Icon: ChartIcon,
  },
  {
    title: "練習引導",
    desc: "題目區與「向量老師」對話區並列，逐步以 Socratic 問答陪你思考。",
    href: "/practice",
    Icon: BookOpenIcon,
  },
];

export default function HomePage() {
  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-2xl border border-zinc-200/80 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-teal-400/10 blur-3xl dark:bg-teal-500/8"
        />
        <p className="relative text-sm font-semibold uppercase tracking-widest text-teal-700 dark:text-teal-400">
          澳門高中數學 · 平面向量
        </p>
        <h1 className="relative mt-2 text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          AI 向量教學助手
        </h1>
        <p className="relative mt-4 max-w-xl text-lg leading-relaxed text-zinc-600 dark:text-zinc-300">
          透過約十分鐘問卷了解你的起點，再以蘇格拉底式提問陪你逐步思考——不直接給答案，而是把思路留給你。
        </p>
        <div className="relative mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            href="/diagnostic"
            className="group inline-flex items-center justify-center rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500"
          >
            開始診斷問卷
            <ArrowRightIcon />
          </Link>
          <Link
            href="/practice"
            className="inline-flex items-center justify-center rounded-xl border border-zinc-300 bg-white px-5 py-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
          >
            直接進入練習引導
          </Link>
        </div>
        <p className="relative mt-6 text-sm text-zinc-400 dark:text-zinc-500">
          登入功能將於之後版本接上；目前介面用作流程與版面預覽。
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {cards.map(({ title, desc, href, Icon }) => (
          <Link
            key={href}
            href={href}
            className="group rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm hover:border-teal-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:border-teal-800"
          >
            <div className="mb-3 flex size-9 items-center justify-center rounded-xl border border-teal-200/60 bg-teal-50/80 dark:border-teal-900/60 dark:bg-teal-950/40">
              <Icon />
            </div>
            <h2 className="font-semibold text-zinc-900 group-hover:text-teal-800 dark:text-zinc-100 dark:group-hover:text-teal-300">
              {title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              {desc}
            </p>
          </Link>
        ))}
      </section>
    </div>
  );
}
