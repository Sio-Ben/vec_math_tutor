"use client";

import {
  Component,
  Fragment,
  type ReactNode,
  type ErrorInfo,
} from "react";
import { BlockMath, InlineMath } from "react-katex";

type StemPart =
  | { type: "text"; value: string }
  | { type: "math"; latex: string; display?: boolean };

export function InlineLatex({
  latex,
  className,
}: {
  latex: string;
  /** 例如深色題幹區可傳 `text-zinc-100` 讓 KaTeX 跟隨前景色 */
  className?: string;
}) {
  return (
    <span
      className={`mx-0.5 inline-block align-middle [&_.katex]:text-inherit ${className ?? ""}`}
    >
      <InlineMath math={latex} />
    </span>
  );
}

export function BlockLatex({ latex }: { latex: string }) {
  return (
    <div className="my-3 overflow-x-auto text-center">
      <BlockMath math={latex} />
    </div>
  );
}

export function MixedStem({ parts }: { parts: StemPart[] }) {
  return (
    <div className="text-[1.05rem] leading-relaxed text-zinc-800 dark:text-zinc-100">
      {parts.map((p, i) => {
        if (p.type === "text") {
          return <span key={i}>{p.value}</span>;
        }
        if (p.display) {
          return <BlockLatex key={i} latex={p.latex} />;
        }
        return <InlineLatex key={i} latex={p.latex} />;
      })}
    </div>
  );
}

type KatexBoundaryProps = {
  latexKey: string;
  fallback: ReactNode;
  children: ReactNode;
};

class KatexErrorBoundary extends Component<
  KatexBoundaryProps,
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(_e: Error, _info: ErrorInfo) {
    /* KaTeX / react-katex 語法錯誤時改顯示後備文字 */
  }

  componentDidUpdate(prev: KatexBoundaryProps) {
    if (prev.latexKey !== this.props.latexKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

function BoldSpans({ line }: { line: string }): ReactNode[] {
  const parts = line.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    const m = part.match(/^\*\*([^*]+)\*\*$/);
    if (m) {
      return (
        <strong key={i} className="font-semibold text-violet-950">
          {m[1]}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function TextWithBoldAndBreaks({ text }: { text: string }): ReactNode {
  const lines = text.split("\n");
  return lines.map((line, li) => (
    <Fragment key={li}>
      {BoldSpans({ line })}
      {li < lines.length - 1 ? <br /> : null}
    </Fragment>
  ));
}

type InlineTok = { k: "text" | "inline"; v: string };

function tokenizeInline(text: string): InlineTok[] {
  const out: InlineTok[] = [];
  let i = 0;
  while (i < text.length) {
    const j = text.indexOf("$", i);
    if (j === -1) {
      if (i < text.length) out.push({ k: "text", v: text.slice(i) });
      break;
    }
    if (j > i) out.push({ k: "text", v: text.slice(i, j) });
    const k = text.indexOf("$", j + 1);
    if (k === -1) {
      out.push({ k: "text", v: text.slice(j) });
      break;
    }
    const inner = text.slice(j + 1, k).trim();
    if (inner) out.push({ k: "inline", v: inner });
    i = k + 1;
  }
  return out;
}

type DisplayTok = { k: "text" | "display"; v: string };

function tokenizeDisplayBlocks(s: string): DisplayTok[] {
  const out: DisplayTok[] = [];
  let rest = s;
  while (rest.length) {
    const start = rest.indexOf("$$");
    if (start === -1) {
      out.push({ k: "text", v: rest });
      break;
    }
    if (start > 0) out.push({ k: "text", v: rest.slice(0, start) });
    rest = rest.slice(start + 2);
    const end = rest.indexOf("$$");
    if (end === -1) {
      out.push({ k: "text", v: `$$${rest}` });
      break;
    }
    const inner = rest.slice(0, end).trim();
    if (inner) out.push({ k: "display", v: inner });
    rest = rest.slice(end + 2);
  }
  return out;
}

function SafeInlineLatex({ latex }: { latex: string }) {
  const plain = `$${latex}$`;
  return (
    <KatexErrorBoundary latexKey={latex} fallback={<span>{plain}</span>}>
      <InlineLatex latex={latex} className="text-violet-950" />
    </KatexErrorBoundary>
  );
}

function SafeBlockLatex({ latex }: { latex: string }) {
  const plain = `$$${latex}$$`;
  return (
    <KatexErrorBoundary latexKey={latex} fallback={<pre className="my-2 overflow-x-auto rounded-lg bg-white/80 p-2 text-left text-xs">{plain}</pre>}>
      <div className="text-violet-950 [&_.katex]:text-inherit">
        <BlockLatex latex={latex} />
      </div>
    </KatexErrorBoundary>
  );
}

/** AI 導師回覆：支援 **粗體**、行內 $...$、區塊 $$...$$ 與 KaTeX */
export function TutorMixedContent({
  text,
  className,
}: {
  text: string;
  /** 併入最外層，例如深色區塊用 `text-zinc-200` */
  className?: string;
}) {
  const blocks = tokenizeDisplayBlocks(text);
  const root = className?.trim()
    ? `space-y-3 text-sm leading-relaxed ${className}`
    : "space-y-3 text-sm leading-relaxed text-zinc-800";
  return (
    <div className={root}>
      {blocks.map((tok, bi) => {
        if (tok.k === "display") {
          return <SafeBlockLatex key={`d-${bi}`} latex={tok.v} />;
        }
        const inlines = tokenizeInline(tok.v);
        const hasVisible = inlines.some(
          (seg) => seg.k === "inline" || seg.v.trim().length > 0,
        );
        if (!hasVisible) return null;
        return (
          <p key={`t-${bi}`} className="m-0">
            {inlines.map((seg, si) =>
              seg.k === "inline" ? (
                <SafeInlineLatex key={si} latex={seg.v} />
              ) : (
                <TextWithBoldAndBreaks key={si} text={seg.v} />
              ),
            )}
          </p>
        );
      })}
    </div>
  );
}
