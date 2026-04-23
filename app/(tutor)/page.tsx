import Link from "next/link";

function ClipboardIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="size-5 text-teal-600" aria-hidden>
      <rect x="6" y="2" width="8" height="3" rx="1" />
      <path d="M6 3H4a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1h-2" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="size-5 text-teal-600" aria-hidden>
      <path d="M3 15 L7 9 L11 12 L16 5" />
      <circle cx="16" cy="5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function BookOpenIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="size-5 text-teal-600" aria-hidden>
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
      <section className="relative overflow-hidden rounded-[var(--r-card)] border border-[var(--border)] bg-[var(--bg-card)] p-8 py-16 shadow-[var(--shadow-card)] sm:py-20">
        <svg
          className="pointer-events-none absolute left-0 top-0 h-48 w-48 opacity-[0.06]"
          viewBox="0 0 120 120"
          fill="none"
          aria-hidden
        >
          <line
            x1="20"
            y1="100"
            x2="20"
            y2="10"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-[var(--learn-600)]"
          />
          <line
            x1="20"
            y1="100"
            x2="110"
            y2="100"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-[var(--learn-600)]"
          />
          <polyline
            points="15,20 20,10 25,20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-[var(--learn-600)]"
          />
          <polyline
            points="100,95 110,100 100,105"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-[var(--learn-600)]"
          />
        </svg>
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-[var(--learn-500)]/10 blur-3xl"
        />
        <p className="relative text-sm font-semibold uppercase tracking-widest text-[var(--learn-700)]">
          澳門高中數學 · 平面向量
        </p>
        <h1 className="relative mt-2 font-[family-name:var(--font-display)] text-4xl font-bold leading-tight tracking-tight text-[var(--txt)] sm:text-5xl">
          AI 向量教學助手
        </h1>
        <p className="relative mt-4 max-w-xl text-lg leading-relaxed text-[var(--txt-2)]">
          透過約十分鐘問卷了解你的起點，再以蘇格拉底式提問陪你逐步思考——不直接給答案，而是把思路留給你。
        </p>
        <div className="relative mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            href="/diagnostic"
            className="group inline-flex items-center gap-2 rounded-[var(--r-btn)] bg-[var(--learn-600)] px-6 py-2.5 text-sm font-medium text-white shadow-[0_2px_0_var(--learn-700),0_4px_16px_rgba(13,140,122,0.3)] transition-all duration-150 hover:-translate-y-px hover:bg-[var(--learn-500)] hover:shadow-[0_4px_0_var(--learn-700),0_8px_24px_rgba(13,140,122,0.4)] active:translate-y-px"
          >
            開始診斷問卷
            <ArrowRightIcon />
          </Link>
          <Link
            href="/practice"
            className="inline-flex items-center gap-2 rounded-[var(--r-btn)] border border-[var(--border)] bg-[var(--bg-card)] px-6 py-2.5 text-[var(--txt-2)] shadow-[var(--shadow-card)] transition-all duration-150 hover:-translate-y-px hover:border-[var(--learn-500)]/40 hover:text-[var(--txt)] hover:shadow-[var(--shadow-lift)] active:translate-y-px"
          >
            直接進入練習引導
          </Link>
        </div>
        <p className="relative mt-6 text-sm text-[var(--txt-3)]">
          登入功能將於之後版本接上；目前介面用作流程與版面預覽。
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {cards.map(({ title, desc, href, Icon }) => (
          <Link
            key={href}
            href={href}
            className="group rounded-[var(--r-card)] border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-card)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]"
          >
            <div className="mb-3 flex size-9 items-center justify-center rounded-xl border border-[var(--learn-100)] bg-[var(--learn-50)]">
              <Icon />
            </div>
            <h2 className="font-semibold text-[var(--txt)] group-hover:text-[var(--learn-700)]">
              {title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--txt-2)]">
              {desc}
            </p>
          </Link>
        ))}
      </section>
    </div>
  );
}
