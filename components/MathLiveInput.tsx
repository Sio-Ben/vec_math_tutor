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
  mf.setAttribute("smart-mode", smartMode ? "on" : "off");
  mf.mathVirtualKeyboardPolicy = "manual";
  mf.smartFence = true;
  mf.smartSuperscript = true;
  mf.removeExtraneousParentheses = true;
}

function showMathVirtualKeyboard() {
  try {
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
        "w-full min-h-[3.25rem] rounded-2xl border border-zinc-700 bg-[#0a0b10] px-3 py-2 text-base text-zinc-100 shadow-inner";
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
      if (hostRef.current) hostRef.current.innerHTML = "";
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
        <p className="mt-1.5 text-[10px] text-zinc-500">
          點進輸入框會開啟數學鍵盤；完成後可按畫面底部「關閉鍵盤」。
        </p>
      ) : null}
    </div>
  );
}
