/**
 * 練習用示範題（之後改為 Supabase）。每題含三層提示與「解鎖該層時」導師回應。
 */
export type StemSeg =
  | { t: "text"; v: string }
  | { t: "math"; m: string };

export type QuestionKind = "mcq" | "fill";

export type PracticeQuestion = {
  id: string;
  source?: "bank" | "ai";
  unitPill: string;
  typeLabel: string;
  kind: QuestionKind;
  stemLatex: StemSeg[];
  options: { key: string; latex: string }[];
  correctKey: string;
  fillAnswer?: string | null;
  difficulty?: string;
  /** 三層提示文案（解鎖前不向學生顯示全文） */
  hintSteps: string[];
  /** 第一次提交思路後（尚未按「需要提示」） */
  thoughtReply: string;
  /** 解鎖第 i 層提示時，導師配合該提示的說明（與 hintSteps 對齊） */
  hintReplies: string[];
  explanation?: string;
  commonMistakes?: string;
  embedText?: string | null;
  imageUrl?: string | null;
  imagePosition?: string | null;
  /** 與題庫 topic 欄一致，供依診斷弱項排序 */
  topicTag?: string;
};

export const PRACTICE_QUESTIONS: PracticeQuestion[] = [
  {
    id: "demo-dot-001",
    unitPill: "向量 · 點積",
    typeLabel: "選擇題",
    kind: "mcq",
    topicTag: "dot_product",
    stemLatex: [
      { t: "text", v: "已知向量 " },
      { t: "math", m: "\\mathbf{a} = (1, 2)" },
      { t: "text", v: "，" },
      { t: "math", m: "\\mathbf{b} = (3, 4)" },
      { t: "text", v: "，求 " },
      { t: "math", m: "\\mathbf{a} \\cdot \\mathbf{b}" },
      { t: "text", v: " 的值。" },
    ],
    options: [
      { key: "A", latex: "10" },
      { key: "B", latex: "11" },
      { key: "C", latex: "12" },
      { key: "D", latex: "14" },
    ],
    correctKey: "B",
    hintSteps: [
      "點積公式是什麼？",
      "把對應分量相乘再相加",
      "1×3 = 3，2×4 = 8，然後呢？",
    ],
    thoughtReply:
      "你說點積就是兩個數相乘，方向很對！不過 **a** 和 **b** 都是二維向量，有兩對分量。那你覺得應該怎麼處理這兩對數字呢？",
    hintReplies: [
      "在平面或空間裡，兩個向量的數量積（點積）通常寫成 **對應分量相乘再相加**。你願意試著用符號把這句話寫成一個式子嗎？",
      "很好，下一步就是把 **第一個分量彼此相乘**、**第二個分量彼此相乘**，再把兩個乘積 **加起來**。對這題而言，你會列出哪兩個乘法？",
      "你算出了 **3** 和 **8**；數量積就是把這兩個數 **相加**。加完之後，答案應該對應哪一個選項呢？",
    ],
  },
  {
    id: "demo-mag-002",
    unitPill: "向量 · 模",
    typeLabel: "選擇題",
    kind: "mcq",
    topicTag: "vec_magnitude",
    stemLatex: [
      { t: "text", v: "設 " },
      { t: "math", m: "\\mathbf{a} = (3, 4)" },
      { t: "text", v: "，則 " },
      { t: "math", m: "|\\mathbf{a}|" },
      { t: "text", v: " 等於：" },
    ],
    options: [
      { key: "A", latex: "5" },
      { key: "B", latex: "7" },
      { key: "C", latex: "12" },
      { key: "D", latex: "25" },
    ],
    correctKey: "A",
    hintSteps: [
      "平面向量的模長公式是什麼？",
      "分量平方後要怎麼組合？",
      "9 + 16 的平方根是多少？",
    ],
    thoughtReply:
      "模長和「向量的長度」有關。你腦中浮現的公式，是只用其中一個分量，還是同時用到 **兩個分量**？",
    hintReplies: [
      "對於分量形式 **(x, y)**，模長常寫成根號裡面 **x² 與 y² 的和**。這題的 x、y 分別是多少？",
      "把 **3²** 與 **4²** 加起來後，再取 **平方根**。你願意先算加法裡面的那一項嗎？",
      "**9 + 16 = 25**，再開根號。哪個選項符合這個結果？",
    ],
  },
  {
    id: "demo-add-003",
    unitPill: "向量 · 加減",
    typeLabel: "選擇題",
    kind: "mcq",
    topicTag: "vec_addition",
    stemLatex: [
      { t: "text", v: "已知 " },
      { t: "math", m: "\\mathbf{a} = (2, -1)" },
      { t: "text", v: "，" },
      { t: "math", m: "\\mathbf{b} = (1, 3)" },
      { t: "text", v: "，則 " },
      { t: "math", m: "\\mathbf{a} + \\mathbf{b}" },
      { t: "text", v: " 為：" },
    ],
    options: [
      { key: "A", latex: "(3, 2)" },
      { key: "B", latex: "(1, -4)" },
      { key: "C", latex: "(3, -2)" },
      { key: "D", latex: "(2, 3)" },
    ],
    correctKey: "A",
    hintSteps: [
      "向量相加時，分量怎麼處理？",
      "第一個分量相加、第二個分量相加",
      "2+1 與 -1+3 各是多少？",
    ],
    thoughtReply:
      "向量相加時，你會把兩個向量的 **x** 分量放在一起處理，還是交叉相乘？先想清楚「對齊」的是哪兩個數。",
    hintReplies: [
      "兩個平面向量相加，通常是 **x 與 x 相加**、**y 與 y 相加**。你覺得這題的兩個 x 是誰跟誰？",
      "第一個位置：**2 + 1**；第二個位置：**-1 + 3**。你分別得到多少？",
      "把兩個結果排成 **( , )** 的形式，看看與哪個選項一致。",
    ],
  },
  {
    id: "demo-scalar-004",
    unitPill: "向量 · 數乘",
    typeLabel: "選擇題",
    kind: "mcq",
    topicTag: "scalar_mult",
    stemLatex: [
      { t: "text", v: "設 " },
      { t: "math", m: "\\mathbf{a} = (2, -3)" },
      { t: "text", v: "，則 " },
      { t: "math", m: "-2\\mathbf{a}" },
      { t: "text", v: " 等於：" },
    ],
    options: [
      { key: "A", latex: "(-4, 6)" },
      { key: "B", latex: "(-4, -6)" },
      { key: "C", latex: "(4, -6)" },
      { key: "D", latex: "(4, 6)" },
    ],
    correctKey: "A",
    hintSteps: [
      "數乘向量時，誰要乘到每一個分量？",
      "負號代表什麼？",
      "分別計算兩個分量",
    ],
    thoughtReply:
      "**-2** 這個數會同時作用在 **兩個分量** 上嗎？還是只作用在其中一個？先說說你的直覺。",
    hintReplies: [
      "數乘時，**純量要乘進每一個分量**。這裡的純量是 **-2**，你會先乘哪一個分量？",
      "負號會讓結果的方向與原向量 **相反**（在幾何上），在分量上則是 **兩個分量都變號再放大**。試算 **-2×2** 與 **-2×(-3)**。",
      "你應該得到 **(-4, 6)**。對照選項，選哪一個？",
    ],
  },
  {
    id: "demo-dot-005",
    unitPill: "向量 · 點積",
    typeLabel: "選擇題",
    kind: "mcq",
    topicTag: "dot_product",
    stemLatex: [
      { t: "text", v: "若 " },
      { t: "math", m: "\\mathbf{a} = (0, 1)" },
      { t: "text", v: "，" },
      { t: "math", m: "\\mathbf{b} = (1, 0)" },
      { t: "text", v: "，則 " },
      { t: "math", m: "\\mathbf{a} \\cdot \\mathbf{b}" },
      { t: "text", v: " 為：" },
    ],
    options: [
      { key: "A", latex: "0" },
      { key: "B", latex: "1" },
      { key: "C", latex: "-1" },
      { key: "D", latex: "2" },
    ],
    correctKey: "A",
    hintSteps: [
      "點積的定義（分量形式）",
      "對應分量相乘再相加",
      "0×1 與 1×0",
    ],
    thoughtReply:
      "這題的分量裡有 **0**。你覺得 0 在「相乘再相加」裡，會把結果拉向哪一邊？",
    hintReplies: [
      "用 **對應分量相乘再相加** 寫出一行式子。這題幾乎不用背公式，只要代數字。",
      "第一個分量相乘：**0×1**；第二個：**1×0**。兩個乘積各是多少？",
      "兩個都是 **0**，加起來仍是 **0**。選哪個選項？",
    ],
  },
];
