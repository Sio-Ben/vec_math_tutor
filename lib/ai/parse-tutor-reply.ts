import type { TutorUiSignal } from "@/lib/tutor/types";

const MARK = "<!-- UI_SIGNAL -->";

/** 拆出給學生看的文字 + 可選的 UI JSON（不展示給學生） */
export function splitTutorReplyAndUiSignal(full: string): {
  visible: string;
  uiSignal: TutorUiSignal | null;
} {
  const idx = full.indexOf(MARK);
  if (idx === -1) {
    return { visible: full.trim(), uiSignal: null };
  }
  const visible = full.slice(0, idx).trim();
  const rest = full.slice(idx + MARK.length).trim();
  try {
    const uiSignal = JSON.parse(rest) as TutorUiSignal;
    return { visible, uiSignal };
  } catch {
    return { visible, uiSignal: null };
  }
}
