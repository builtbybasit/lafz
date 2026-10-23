// Copy the local build DB (data/lafz.db, from scripts/seed.ts) into D1 without losing the player's
// progress: progress is pulled from D1 into data/lafz.db first (by word text), then content is replaced.
// A failed run is safe to rerun, since data/lafz.db already holds the pulled progress.
// Usage: node scripts/sync_d1.ts [--remote]   (default: the local D1 that `vp dev` uses)
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import Database from "better-sqlite3";

const DB_ID = "128bb3e4-b33d-4d36-9c74-8b40e3e067f0"; // keep in sync with cloudflare.config.ts
const remote = process.argv.includes("--remote");
// the Cloudflare Vite plugin keeps its local D1 in .cloudflare/state, not cf's default location
const where = remote ? [] : ["--local", "--persist-to", ".cloudflare/state"];
const BATCH_BYTES = 500_000; // per `cf d1 raw --batch` request

const cf = (...args: string[]) =>
  execFileSync("cf", ["d1", ...args, ...where], { encoding: "utf8", maxBuffer: 64 << 20 });

type Cell = string | number | null;
function query(sql: string): Cell[][] {
  const [res] = JSON.parse(cf("raw", DB_ID, "--sql", sql)) as { results: { rows: Cell[][] } }[];
  return res.results.rows;
}

cf("migrations", "apply", DB_ID, "--dir", "drizzle");

const local = new Database("data/lafz.db");

// 1. D1 is the source of truth for progress: make local progress match it exactly.
const wordRows = query("select word, box, due from words where box > 0");
const packRows = query('select level, "index", stars, best from packs where stars > 0 or best > 0');
const [prof] = query("select xp, streak, last_played from profile where id = 1");
local.transaction(() => {
  local.prepare("update words set box = 0, due = null").run();
  local.prepare("update packs set stars = 0, best = 0").run();
  local.prepare("update profile set xp = 0, streak = 0, last_played = null").run();
  const w = local.prepare("update words set box = ?, due = ? where word = ?");
  for (const [word, box, due] of wordRows) w.run(box, due, word);
  const p = local.prepare('update packs set stars = ?, best = ? where level = ? and "index" = ?');
  for (const [level, index, stars, best] of packRows) p.run(stars, best, level, index);
  if (prof)
    local
      .prepare("update profile set xp = ?, streak = ?, last_played = ? where id = 1")
      .run(...prof);
})();
console.log(
  `pulled progress: ${wordRows.length} words, ${packRows.length} packs, xp ${prof?.[0] ?? 0}`,
);

// 2. Replace D1's content. Children before parents for the words -> packs foreign key.
// The D1 HTTP API only takes string params: numbers go as strings (column affinity converts them back), nulls as SQL NULL.
type Stmt = { sql: string; params?: string[] };
const statements: Stmt[] = ["words", "packs", "profile"].map((t) => ({ sql: `delete from ${t}` }));
for (const table of ["packs", "profile", "words"]) {
  for (const row of local.prepare(`select * from ${table}`).all() as Record<string, Cell>[]) {
    const cols = Object.keys(row);
    const vals = Object.values(row);
    statements.push({
      sql: `insert into ${table} (${cols.map((c) => `"${c}"`).join(", ")}) values (${vals.map((v) => (v === null ? "NULL" : "?")).join(", ")})`,
      params: vals.filter((v) => v !== null).map(String),
    });
  }
}
let batch: Stmt[] = [];
let size = 0;
let sent = 0;
const flush = () => {
  if (!batch.length) return;
  writeFileSync("data/d1-batch.json", JSON.stringify(batch));
  cf("raw", DB_ID, "--batch", "@data/d1-batch.json");
  sent += batch.length;
  batch = [];
  size = 0;
};
for (const s of statements) {
  const bytes = JSON.stringify(s).length;
  if (size + bytes > BATCH_BYTES) flush();
  batch.push(s);
  size += bytes;
}
flush();

const [[words, learned]] = query("select count(*), coalesce(sum(box > 0), 0) from words");
console.log(
  `${remote ? "remote" : "local"} D1: ${sent} statements, ${words} words, ${learned} learned`,
);
