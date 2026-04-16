"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "首頁" },
  { href: "/diagnostic", label: "問卷" },
  { href: "/diagnostic/report", label: "掌握報告" },
  { href: "/mastery", label: "掌握追蹤" },
  { href: "/practice", label: "練習引導" },
] as const;

function VectorIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M3 14 L14 3" />
      <path d="M14 3 L11 3 M14 3 L14 6" />
    </svg>
  );
}

export function MainNav() {
  const pathname = usePathname();
  const isPracticeMode =
    pathname === "/practice" ||
    pathname.startsWith("/practice/") ||
    pathname === "/mastery" ||
    pathname.startsWith("/mastery/");

  return (
    <header
      className={
        isPracticeMode
          ? "sticky top-0 z-40 border-b border-zinc-800 bg-[#0f1014]/96 backdrop-blur-md"
          : "sticky top-0 z-40 border-b border-zinc-200/80 bg-white/92 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/92"
      }
    >
      {isPracticeMode && (
        <div className="h-0.5 w-full bg-gradient-to-r from-violet-600 via-violet-400 to-violet-600/0" />
      )}
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className={
            isPracticeMode
              ? "flex shrink-0 items-center gap-1.5 font-semibold tracking-tight text-violet-300 hover:text-violet-200"
              : "flex shrink-0 items-center gap-1.5 font-semibold tracking-tight text-teal-800 hover:text-teal-600 dark:text-teal-300 dark:hover:text-teal-200"
          }
        >
          <VectorIcon className="size-4.5" />
          向量教學助手
        </Link>

        <nav className="flex flex-wrap items-center justify-end gap-0.5 sm:gap-1">
          {links.map(({ href, label }) => {
            const active =
              href === "/"
                ? pathname === "/"
                : pathname === href || pathname.startsWith(`${href}/`);

            if (isPracticeMode) {
              return (
                <Link
                  key={href}
                  href={href}
                  className={
                    active
                      ? "rounded-lg bg-violet-500/20 px-3 py-1.5 text-sm font-medium text-violet-100 ring-1 ring-violet-500/30"
                      : "rounded-lg px-3 py-1.5 text-sm text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-100"
                  }
                >
                  {label}
                </Link>
              );
            }

            return (
              <Link
                key={href}
                href={href}
                className={
                  active
                    ? "rounded-lg bg-teal-100 px-3 py-1.5 text-sm font-medium text-teal-900 ring-1 ring-teal-300/50 dark:bg-teal-950/80 dark:text-teal-100 dark:ring-teal-700/40"
                    : "rounded-lg px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/70 dark:hover:text-zinc-100"
                }
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
