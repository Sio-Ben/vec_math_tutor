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
          ? "relative sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg-card)]/95 backdrop-blur-xl"
          : "relative sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg-card)]/90 shadow-[0_1px_0_rgba(0,0,0,0.04)] backdrop-blur-xl"
      }
    >
      {isPracticeMode && (
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--learn-500)]/70 to-transparent" />
      )}
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className={
            isPracticeMode
              ? "flex shrink-0 items-center gap-1.5 font-[family-name:var(--font-display)] font-semibold tracking-tight text-[var(--learn-700)] hover:text-[var(--learn-500)]"
              : "flex shrink-0 items-center gap-1.5 font-[family-name:var(--font-display)] font-semibold tracking-tight text-[var(--learn-700)] hover:text-[var(--learn-500)]"
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
                      ? "rounded-[var(--r-btn)] bg-[var(--learn-500)] px-3 py-1.5 text-sm font-medium text-white shadow-[0_2px_8px_rgba(13,140,122,0.35)]"
                      : "rounded-[var(--r-btn)] px-3 py-1.5 text-sm text-[var(--txt-2)] hover:bg-[var(--bg-hover)] hover:text-[var(--txt)]"
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
                    ? "rounded-[var(--r-btn)] bg-[var(--learn-500)] px-3 py-1.5 text-sm font-medium text-white shadow-[0_2px_8px_rgba(13,140,122,0.35)]"
                    : "rounded-[var(--r-btn)] px-3 py-1.5 text-sm text-[var(--txt-2)] hover:bg-[var(--bg-hover)] hover:text-[var(--txt)]"
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
