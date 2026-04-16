import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TABLE = process.env.SUPABASE_QUESTIONS_TABLE || "vector_questions";
const BATCH = Number(process.env.BACKSLASH_FIX_BATCH || "200");
const APPLY = process.argv.includes("--apply");

if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error("缺少 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function collapseDoubleBackslashes(text) {
  return text.replace(/\\\\/g, "\\");
}

function buildPatch(row) {
  const patch = {};
  let changed = 0;
  for (const [key, value] of Object.entries(row)) {
    if (typeof value !== "string") continue;
    const fixed = collapseDoubleBackslashes(value);
    if (fixed !== value) {
      patch[key] = fixed;
      changed += 1;
    }
  }
  return { patch, changed };
}

async function main() {
  let offset = 0;
  let touchedRows = 0;
  let touchedCells = 0;
  console.log(
    `[fix-slash] table=${TABLE}, batch=${BATCH}, mode=${APPLY ? "apply" : "dry-run"}`,
  );

  while (true) {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .order("id")
      .range(offset, offset + BATCH - 1);

    if (error) throw new Error(`讀取資料失敗: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const row of data) {
      const { patch, changed } = buildPatch(row);
      if (changed === 0) continue;

      touchedRows += 1;
      touchedCells += changed;

      if (!APPLY) {
        console.log(
          `[fix-slash][dry-run] row=${row.id} changed_cells=${changed} keys=${Object.keys(patch).join(",")}`,
        );
        continue;
      }

      const { error: upErr } = await supabase.from(TABLE).update(patch).eq("id", row.id);
      if (upErr) {
        console.error(`[fix-slash] 更新失敗 id=${row.id}: ${upErr.message}`);
        continue;
      }
      console.log(`[fix-slash] updated ${row.id} (${changed} cells)`);
    }

    offset += data.length;
  }

  console.log(`[fix-slash] done. rows=${touchedRows}, cells=${touchedCells}`);
  if (!APPLY) {
    console.log("[fix-slash] 這是 dry-run。確認後可加 --apply 真正寫回。");
  }
}

main().catch((e) => {
  console.error("[fix-slash] fatal:", e.message || e);
  process.exit(1);
});
