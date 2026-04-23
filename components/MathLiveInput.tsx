"use client";

import { useEffect, useRef } from "react";
import type { MathfieldElement } from "mathlive";

type MathLiveInputProps = {
  value: string;
  onChange: (latex: string) => void;
  /** 換題或重置時強制重建 */
  instanceKey?: string;
  className?: string;
  /** 填空用 math；思路建議 math + smartMode 以支援中文與數式混排 */
  defaultMode?: "math" | "text" | "inline-math";
  smartMode?: boolean;
  /** 套在 `<math-field>` 上，例如加高 */
  fieldClassName?: string;
  /** 是否顯示鍵盤操作說明（同一頁多個欄位時建議只有一個為 true） */
  keyboardHint?: boolean;
};

function configureField(
  mf: MathfieldElement,
  mode: "math" | "text" | "inline-math",
  smartMode: boolean,
) {
  mf.defaultMode = mode;
  mf.setAttribute("theme", "light");
  mf.setAttribute("smart-mode", smartMode ? "on" : "off");
  mf.mathVirtualKeyboardPolicy = "manual";
  mf.smartFence = true;
  mf.smartSuperscript = true;
  mf.removeExtraneousParentheses = true;
  mf.style.setProperty("color-scheme", "light");
  mf.style.setProperty("--hue", "168");
  mf.style.setProperty("--caret-color", "#0d8c7a");
  mf.style.setProperty("--selection-color", "#0b3d36");
  mf.style.setProperty("--selection-background-color", "#c5ede4");
  mf.style.setProperty("--contains-highlight-color", "#0d8c7a");
  mf.style.setProperty("--contains-highlight-background-color", "#e7f6f2");
  mf.style.setProperty("--placeholder-color", "#0d8c7a");
  mf.style.setProperty("--box-placeholder-color", "#0d8c7a");
  mf.style.setProperty("--box-placeholder-pressed-color", "#0b3d36");
}

function showMathVirtualKeyboard() {
  try {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("theme", "light");
      document.body.setAttribute("theme", "light");
    }
    globalThis.window?.mathVirtualKeyboard?.show({ animate: true });
  } catch {
    /* ignore */
  }
}

export function MathLiveInput({
  value,
  onChange,
  instanceKey = "default",
  className,
  defaultMode = "math",
  smartMode = false,
  fieldClassName,
  keyboardHint = true,
}: MathLiveInputProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mfRef = useRef<MathfieldElement | null>(null);
  const lastPropValue = useRef<string>(value);

  useEffect(() => {
    let cancelled = false;
    let mf: MathfieldElement | null = null;
    let onInput: (() => void) | null = null;
    let onFocusIn: (() => void) | null = null;

    void (async () => {
      await import("mathlive/fonts.css");
      await import("mathlive/static.css");
      const ml = await import("mathlive");
      try {
        ml.initVirtualKeyboardInCurrentBrowsingContext();
        if (typeof document !== "undefined") {
          document.documentElement.setAttribute("theme", "light");
          document.body.setAttribute("theme", "light");
        }
      } catch {
        /* ignore */
      }
      const host = hostRef.current;
      if (cancelled || !host) return;

      host.innerHTML = "";
      mf = document.createElement("math-field") as MathfieldElement;
      configureField(mf, defaultMode, smartMode);
      mf.className =
        fieldClassName?.trim() ||
        "w-full min-h-[3.25rem] rounded-xl border border-[var(--border)] bg-[var(--bg-inset)] px-4 py-3 text-base text-[var(--txt)] shadow-inner outline-none focus:border-[var(--learn-500)] focus:ring-2 focus:ring-[var(--learn-500)]/20";
      if (cancelled || !hostRef.current) return;
      mf.setValue(value || "", { focus: false, silenceNotifications: true });
      lastPropValue.current = value || "";

      onInput = () => {
        const next = mf!.value;
        lastPropValue.current = next;
        onChange(next);
      };
      onFocusIn = () => showMathVirtualKeyboard();

      mf.addEventListener("input", onInput);
      mf.addEventListener("focusin", onFocusIn);
      host.appendChild(mf);
      mfRef.current = mf;
    })();

    return () => {
      cancelled = true;
      if (mf && onInput) mf.removeEventListener("input", onInput);
      if (mf && onFocusIn) mf.removeEventListener("focusin", onFocusIn);
      if (mf) mf.remove();
      mfRef.current = null;
      host.innerHTML = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rebuild when instanceKey / mode changes
  }, [instanceKey, defaultMode, fieldClassName, smartMode]);

  useEffect(() => {
    const el = mfRef.current;
    if (!el) return;
    if (value === lastPropValue.current) return;
    el.setValue(value || "", { focus: false, silenceNotifications: true });
    lastPropValue.current = value || "";
  }, [value]);

  return (
    <div className={className}>
      <div ref={hostRef} className="desmos-math-host" />
      {keyboardHint ? (
        <p className="mt-1.5 text-[10px] text-[var(--txt-3)]">
          點進輸入框會開啟數學鍵盤；完成後可按畫面底部「關閉鍵盤」。
        </p>
      ) : null}
    </div>
  );
}
