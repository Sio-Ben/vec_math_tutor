"use client";

import { useEffect, useState } from "react";

/**
 * MathLive 虛擬鍵盤沒有固定「關閉」鈕時，提供全站浮層按鈕呼叫 `mathVirtualKeyboard.hide()`。
 */
export function MathLiveKeyboardCloser() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setInterval> | undefined;

    void import("mathlive").then((ml) => {
      if (!alive) return;
      try {
        ml.initVirtualKeyboardInCurrentBrowsingContext?.();
      } catch {
        /* ignore */
      }
      timer = setInterval(() => {
        const v = globalThis.window?.mathVirtualKeyboard?.visible ?? false;
        setOpen(v);
      }, 200);
    });

    return () => {
      alive = false;
      if (timer) clearInterval(timer);
    };
  }, []);

  if (!open) return null;

  return (
    <button
      type="button"
      aria-label="關閉數學鍵盤"
      className="fixed right-4 top-20 z-[10000] inline-flex items-center gap-1.5 rounded-full border border-zinc-600 bg-zinc-900/95 px-3 py-1.5 text-xs font-semibold text-zinc-100 shadow-lg backdrop-blur-sm hover:bg-zinc-800 dark:border-zinc-500 sm:right-6"
      onClick={() => {
        try {
          globalThis.window?.mathVirtualKeyboard?.hide({ animate: true });
        } catch {
          /* ignore */
        }
        setOpen(false);
      }}
    >
      <span aria-hidden>⌨</span>
      <span>關閉鍵盤</span>
    </button>
  );
}
