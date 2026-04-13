/** 從模型輸出取出 JSON（支援外層 ```json 围栏） */
export function parseJsonFromModelText(text: string): unknown {
  let t = text.trim();
  const m = /^```(?:json)?\s*([\s\S]*?)```$/im.exec(t);
  if (m) t = m[1].trim();
  return JSON.parse(t) as unknown;
}
