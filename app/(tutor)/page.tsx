import Link from "next/link";

export default function HomePage() {
  return (
    <div className="space-y-10">
      <section className="rounded-2xl border border-zinc-200/80 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
        <p className="text-sm font-medium uppercase tracking-wider text-teal-700 dark:text-teal-400">
          澳門高中數學 · 平面向量
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          AI 向量教學助手
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-zinc-600 dark:text-zinc-300">
          透過約十分鐘的診斷問卷了解你的起點，再以蘇格拉底式提問陪你逐步思考——不直接餵答案，而是把思路留給你。
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            href="/diagnostic"
            className="inline-flex items-center justify-center rounded-xl bg-teal-700 px-5 py-3 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500"
          >
            開始診斷問卷
          </Link>
          <Link
            href="/practice"
            className="inline-flex items-center justify-center rounded-xl border border-zinc-300 bg-white px-5 py-3 text-center text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
          >
            進入練習與引導
          </Link>
        </div>
        <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
          登入與帳號功能將於之後版本接上；目前介面用於展示教學流程與版面。
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          {
            title: "診斷問卷",
            desc: "8 題混合選擇與計算，約 10 分鐘，對應 L1–L3 與各知識點標籤。",
            href: "/diagnostic",
          },
          {
            title: "掌握報告",
            desc: "問卷完成後可檢視加權掌握分、強弱項與建議起點（之後由 Prompt A 產生）。",
            href: "/diagnostic/report",
          },
          {
            title: "練習與引導",
            desc: "題目區與「向量老師」對話區並列，模擬每次作答後的 Socratic 回饋。",
            href: "/practice",
          },
        ].map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm transition hover:border-teal-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:border-teal-800"
          >
            <h2 className="font-semibold text-zinc-900 group-hover:text-teal-800 dark:text-zinc-100 dark:group-hover:text-teal-300">
              {card.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              {card.desc}
            </p>
          </Link>
        ))}
      </section>
    </div>
  );
}
