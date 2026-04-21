import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const TABLE = process.env.SUPABASE_QUESTIONS_TABLE || "vector_questions";
const OUT_DIR = path.resolve(process.cwd(), "docs", "generated");

const DIFFICULTIES = ["L1", "L2", "L3", "L4"];
const TOPIC_ORDER = [
  "vec_magnitude",
  "vec_addition",
  "scalar_mult",
  "vec_collinear",
  "dot_product",
  "vec_angle",
  "vec_geometry",
  "synthesis",
  "vec_perpendicular",
  "vec_section",
  "vec_projection",
  "vec_3d_coord",
  "vec_proof",
];

function createSupabase() {
  if (!SUPABASE_URL) {
    throw new Error("缺少 NEXT_PUBLIC_SUPABASE_URL");
  }
  const key = SERVICE_KEY || ANON_KEY;
  if (!key) {
    throw new Error("缺少 SUPABASE_SERVICE_ROLE_KEY 或 NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return createClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function normalizeDifficulty(raw) {
  const d = String(raw ?? "").trim().toUpperCase();
  return DIFFICULTIES.includes(d) ? d : "OTHER";
}

function normalizeTopic(raw) {
  return String(raw ?? "").trim();
}

function initRow(topic) {
  return { topic, L1: 0, L2: 0, L3: 0, L4: 0, OTHER: 0, TOTAL: 0 };
}

function toMarkdown(rows, totals) {
  const header = "| topic_tag | L1 | L2 | L3 | L4 | 合計 |";
  const sep = "|---|---:|---:|---:|---:|---:|";
  const body = rows
    .map((r) => `| ${r.topic} | ${r.L1} | ${r.L2} | ${r.L3} | ${r.L4} | ${r.TOTAL} |`)
    .join("\n");
  const sum = `| 合計 | ${totals.L1} | ${totals.L2} | ${totals.L3} | ${totals.L4} | ${totals.TOTAL} |`;
  return [header, sep, body, sum].join("\n");
}

function toCsv(rows, totals) {
  const header = "topic_tag,L1,L2,L3,L4,total";
  const body = rows
    .map((r) => `${r.topic},${r.L1},${r.L2},${r.L3},${r.L4},${r.TOTAL}`)
    .join("\n");
  const sum = `合計,${totals.L1},${totals.L2},${totals.L3},${totals.L4},${totals.TOTAL}`;
  return [header, body, sum].join("\n");
}

async function main() {
  const supabase = createSupabase();
  console.log(`[table3] 讀取資料表: ${TABLE}`);

  const { data, error } = await supabase.from(TABLE).select("topic,difficulty");
  if (error) {
    throw new Error(`讀取資料失敗: ${error.message}`);
  }
  if (!Array.isArray(data)) {
    throw new Error("資料格式錯誤：查詢結果不是陣列");
  }

  const map = new Map();
  for (const t of TOPIC_ORDER) map.set(t, initRow(t));

  for (const row of data) {
    const topic = normalizeTopic(row.topic);
    const diff = normalizeDifficulty(row.difficulty);
    if (!map.has(topic)) map.set(topic, initRow(topic || "(empty_topic)"));
    const target = map.get(topic);
    target[diff] = (target[diff] ?? 0) + 1;
    target.TOTAL += 1;
  }

  const ordered = [
    ...TOPIC_ORDER.map((t) => map.get(t)).filter(Boolean),
    ...[...map.values()].filter((r) => !TOPIC_ORDER.includes(r.topic)),
  ];

  const totals = { L1: 0, L2: 0, L3: 0, L4: 0, TOTAL: 0 };
  for (const r of ordered) {
    totals.L1 += r.L1;
    totals.L2 += r.L2;
    totals.L3 += r.L3;
    totals.L4 += r.L4;
    totals.TOTAL += r.TOTAL;
  }

  const md = toMarkdown(ordered, totals);
  const csv = toCsv(ordered, totals);

  await mkdir(OUT_DIR, { recursive: true });
  const mdPath = path.join(OUT_DIR, "table3-topic-difficulty.md");
  const csvPath = path.join(OUT_DIR, "table3-topic-difficulty.csv");
  await writeFile(mdPath, md, "utf8");
  await writeFile(csvPath, csv, "utf8");

  console.log(`[table3] 完成，總題數=${totals.TOTAL}`);
  console.log(`[table3] Markdown: ${mdPath}`);
  console.log(`[table3] CSV: ${csvPath}`);
}

main().catch((e) => {
  console.error("[table3] fatal:", e.message || e);
  process.exit(1);
});
