import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

type TracePhase = "prompt" | "response" | "error" | "result";

type TraceRecord = {
  timestamp: string;
  route: string;
  phase: TracePhase;
  meta?: Record<string, unknown>;
  payload: unknown;
};

const SENSITIVE_KEY_PATTERN = /(api[_-]?key|token|authorization|password|secret|cookie)/i;
const MAX_STRING_LEN = 4000;
const MAX_ARRAY_ITEMS = 60;

function isEnabled(): boolean {
  const raw = process.env.AI_TRACE_LOG?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function truncateString(v: string): string {
  if (v.length <= MAX_STRING_LEN) return v;
  return `${v.slice(0, MAX_STRING_LEN)}…<truncated:${v.length - MAX_STRING_LEN}>`;
}

export function sanitizeForTrace(input: unknown): unknown {
  if (input == null) return input;
  if (typeof input === "string") return truncateString(input);
  if (typeof input !== "object") return input;
  if (Array.isArray(input)) {
    const arr = input.slice(0, MAX_ARRAY_ITEMS).map((x) => sanitizeForTrace(x));
    if (input.length > MAX_ARRAY_ITEMS) {
      arr.push(`…<truncated_items:${input.length - MAX_ARRAY_ITEMS}>`);
    }
    return arr;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (SENSITIVE_KEY_PATTERN.test(k)) {
      out[k] = "<masked>";
      continue;
    }
    out[k] = sanitizeForTrace(v);
  }
  return out;
}

function traceDir(): string {
  return path.join(process.cwd(), ".debug", "ai-traces");
}

function traceFilePath(at = new Date()): string {
  const yyyy = at.getFullYear();
  const mm = String(at.getMonth() + 1).padStart(2, "0");
  const dd = String(at.getDate()).padStart(2, "0");
  return path.join(traceDir(), `${yyyy}-${mm}-${dd}.jsonl`);
}

export async function logAiTrace(input: {
  route: string;
  phase: TracePhase;
  payload: unknown;
  meta?: Record<string, unknown>;
  sanitize?: boolean;
}): Promise<void> {
  if (!isEnabled()) return;
  try {
    const now = new Date();
    const record: TraceRecord = {
      timestamp: now.toISOString(),
      route: input.route,
      phase: input.phase,
      meta: input.meta ? (sanitizeForTrace(input.meta) as Record<string, unknown>) : undefined,
      payload: input.sanitize === false ? input.payload : sanitizeForTrace(input.payload),
    };
    const line = `${JSON.stringify(record)}\n`;
    await mkdir(traceDir(), { recursive: true });
    await appendFile(traceFilePath(now), line, "utf8");
  } catch {
    // tracing should never break runtime flow
  }
}

