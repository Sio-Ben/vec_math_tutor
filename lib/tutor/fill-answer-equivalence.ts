/**
 * 填空題：標準答案與學生答案在「格式不同但數學意義相同」時盡量判對。
 * 規則為啟發式，無法涵蓋所有代數等价；極端情況可擴充或改走 CAS。
 */

function collapseSpacesLower(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, "");
}

/** 移除常見角度單位，便於比較「60」與「60°」 */
function stripAngleSuffix(s: string): string {
  return s
    .replace(/°|度|deg(?!\w)/gi, "")
    .replace(/\s+/g, "");
}

function parseFiniteNumber(raw: string): number | null {
  const t = raw.trim().replace(/,/g, "");
  if (!t || !/^[-+]?\d*\.?\d+(?:e[-+]?\d+)?$/i.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** 解析 a/b 為數值 */
function parseFractionValue(s: string): number | null {
  const m = /^(-?\d+)\s*\/\s*(-?\d+)$/.exec(s.trim());
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (b === 0 || !Number.isFinite(a) || !Number.isFinite(b)) return null;
  return a / b;
}

/** 正規化常見 LaTeX／符號變體，再比字串 */
function normalizeSymbolic(s: string): string {
  let t = collapseSpacesLower(s);
  t = t.replace(/\$/g, "");
  t = t.replace(/\\left\s*/g, "").replace(/\\right\s*/g, "");
  t = t.replace(/\\overrightarrow\{([^}]*)\}/g, "$1");
  t = t.replace(/\\overrightarrow/g, "");
  t = t.replace(/\\vec\{([^}]*)\}/g, "$1");
  t = t.replace(/\\vec/g, "");
  t = t.replace(/\\mathbf\{([^}]*)\}/g, "$1");
  t = t.replace(/\\mathbf/g, "");
  t = t.replace(/\\[dt]?frac\{([^}]*)\}\{([^}]*)\}/g, "($1/$2)");
  t = t.replace(/\\[dt]?frac(\d)(\d)(?!\d)/g, "($1/$2)");
  t = t.replace(/\\cdot/g, "*");
  t = t.replace(/\\times/g, "*");
  t = t.replace(/\\sqrt\{([^}]+)\}/g, "sqrt($1)");
  t = t.replace(/√\(?([0-9a-z+*/^.]+)\)?/g, "sqrt($1)");
  t = t.replace(/（/g, "(").replace(/）/g, ")");
  t = t.replace(/，/g, ",");
  return t;
}

/** 二維有序對 (x,y)，允許括號與空格差異 */
function parseOrderedPair(s: string): [number, number] | null {
  const t = collapseSpacesLower(s).replace(/\$/g, "");
  const m = /^\(?([-+]?\d*\.?\d+)\s*,\s*([-+]?\d*\.?\d+)\)?$/.exec(t);
  if (!m) return null;
  const x = Number(m[1]);
  const y = Number(m[2]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return [x, y];
}

const EPS = 1e-6;

function numbersClose(a: number, b: number): boolean {
  return Math.abs(a - b) <= EPS * Math.max(1, Math.abs(a), Math.abs(b));
}

/**
 * 學生答案與標準答案是否視為相同（練習填空用）。
 */
export function fillAnswersEquivalent(studentRaw: string, expectedRaw: string): boolean {
  const student = studentRaw.trim();
  const expected = expectedRaw.trim();
  if (!student || !expected) return false;

  const ns = normalizeSymbolic(student);
  const ne = normalizeSymbolic(expected);
  if (ns === ne) return true;

  const sAngle = stripAngleSuffix(ns);
  const eAngle = stripAngleSuffix(ne);
  if (sAngle === eAngle) return true;

  const ps = parseFiniteNumber(sAngle);
  const pe = parseFiniteNumber(eAngle);
  if (ps != null && pe != null && numbersClose(ps, pe)) return true;

  const fs = parseFractionValue(ns);
  const fe = parseFractionValue(ne);
  if (fs != null && fe != null && numbersClose(fs, fe)) return true;
  if (fs != null && pe != null && numbersClose(fs, pe)) return true;
  if (ps != null && fe != null && numbersClose(ps, fe)) return true;

  const pairS = parseOrderedPair(student);
  const pairE = parseOrderedPair(expected);
  if (pairS && pairE) {
    return (
      numbersClose(pairS[0], pairE[0]) && numbersClose(pairS[1], pairE[1])
    );
  }

  return false;
}
