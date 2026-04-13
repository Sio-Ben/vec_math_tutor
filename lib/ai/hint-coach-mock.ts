/**
 * 依題庫「原始提示句」在後端作為 grounding，產出導師口吻（本 mock 不逐字貼上 DB）。
 * 之後改為 LLM：在 system 放入 hint 原文，但要求「不可逐字複誦，須改寫為提問式引導」。
 */
export function mockHintCoachReply(input: {
  hintSourceText: string;
  hintIndex: number;
  questionId: string;
  studentThought?: string | null;
}): string {
  const layer = input.hintIndex + 1;
  const thought = input.studentThought?.trim();
  const hasHint = input.hintSourceText.trim().length > 0;

  const opener = thought
    ? `我先呼應你剛才寫的想法；我們先不判對錯。`
    : `好，我們進入第 ${layer} 層引導。`;

  if (!hasHint) {
    return `${opener} 這一題目前沒有可讀的提示文本，請檢查題庫 hint 欄位。`;
  }

  return (
    `${opener} 我已讀過題庫裡第 ${layer} 條「內部提示」（此示範不回貼原文）。` +
    ` 請你現在做两件事：① 用一句話說你下一步想先處理題幹裡的哪個量；② 那一步與「${layer === 1 ? "定義" : layer === 2 ? "代入" : "檢查"}」哪個比較有關？` +
    ` （接上 LLM 後，模型會依該提示改寫成完整 Socratic 回覆。）`
  );
}
