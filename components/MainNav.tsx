"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "首頁" },
  { href: "/diagnostic", label: "診斷問卷" },
  { href: "/diagnostic/report", label: "掌握報告" },
  { href: "/mastery", label: "掌握追蹤" },
  { href: "/practice", label: "練習與引導" },
] as const;

export function MainNav() {
  const pathname = usePathname();
  const practice =
    pathname === "/practice" ||
    pathname.startsWith("/practice/") ||
    pathname === "/mastery" ||
    pathname.startsWith("/mastery/");
  return (
    <header
      className={
        practice
          ? "border-b border-zinc-800 bg-[#0f1014]/95 backdrop-blur-md"
          : "border-b border-zinc-200/80 bg-white/90 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/90"
      }
    >
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className={
            practice
              ? "shrink-0 font-semibold tracking-tight text-violet-300"
              : "shrink-0 font-semibold tracking-tight text-teal-800 dark:text-teal-300"
          }
        >
          向量教學助手
        </Link>
        <nav className="flex flex-wrap items-center justify-end gap-1 sm:gap-2">
          {links.map(({ href, label }) => {
            const active =
              href === "/"
                ? pathname === "/"
                : pathname === href || pathname.startsWith(`${href}/`);
            if (practice) {
              return (
                <Link
                  key={href}
                  href={href}
                  className={
                    active
                      ? "rounded-lg bg-violet-600/30 px-2.5 py-1.5 text-sm font-medium text-violet-100"
                      : "rounded-lg px-2.5 py-1.5 text-sm text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
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
                    ? "rounded-lg bg-teal-100 px-2.5 py-1.5 text-sm font-medium text-teal-900 dark:bg-teal-950/80 dark:text-teal-100"
                    : "rounded-lg px-2.5 py-1.5 text-sm text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
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
