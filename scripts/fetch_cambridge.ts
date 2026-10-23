// Fetch US/UK recordings and word forms for every game word from a Cambridge Dictionary API
// (github.com/chenelias/cambridge-dictionary-api), once, into data/audio/ and data/cambridge.json.
// Usage: node scripts/fetch_cambridge.ts   (resumable: cached words are skipped)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { audioFile, casing, words, type Accent } from "../server/db.ts";

const API = "https://dictionary-api.eliaschen.dev/api/dictionary/en/";
const CACHE = "data/cambridge.json";
// Cambridge's media server rejects requests that don't look like a browser.
const BROWSER = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130 Safari/537.36",
  Referer: "https://dictionary.cambridge.org/",
};

interface Hit {
  forms: string[];
  us: string | null;
  uk: string | null;
}
type Cached = Hit | { missing: true };
interface ApiWord {
  word: string;
  verbs: { type: string; text: string }[];
  pronunciation: { lang: string; url: string }[];
}

const cache: Record<string, Cached> = existsSync(CACHE)
  ? JSON.parse(readFileSync(CACHE, "utf8"))
  : {};
const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[-\s]+/g, " ")
    .trim();

// The API lists inflection blocks for every part of speech and related words ("bored" also gets
// "bore, bores, boring"); keep only blocks headed by our word, single words only.
export function formsOf(word: string, verbs: ApiWord["verbs"]) {
  const out = new Set<string>();
  let keep = false;
  for (const v of verbs) {
    if (["Positive", "Singular", "Plain form"].includes(v.type)) keep = norm(v.text) === norm(word);
    if (keep && !/\s/.test(v.text) && v.text !== "none" && norm(v.text) !== norm(word))
      out.add(v.text);
  }
  return [...out];
}

async function download(url: string, file: string) {
  if (existsSync(file)) return true;
  const res = await fetch(url, { headers: BROWSER });
  if (!res.ok || !res.headers.get("content-type")?.includes("audio")) return false;
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  return true;
}

async function fetchWord(word: string): Promise<Cached> {
  const res = await fetch(API + encodeURIComponent(word.replace(/ /g, "-")));
  if (res.status === 404) return { missing: true };
  if (!res.ok) throw new Error(`${word}: HTTP ${res.status}`);
  const d = (await res.json()) as ApiWord;
  // A redirect to another headword ("ate" -> "eat") would teach the wrong sound.
  if (norm(d.word) !== norm(word)) return { missing: true };
  const hit: Hit = { forms: formsOf(word, d.verbs), us: null, uk: null };
  for (const accent of ["us", "uk"] as Accent[]) {
    const p = d.pronunciation.find((x) => x.lang === accent);
    if (p && (await download(p.url, audioFile(word, accent)))) hit[accent] = p.url;
  }
  return hit;
}

if (process.argv[1]?.endsWith("fetch_cambridge.ts")) {
  mkdirSync("data/audio", { recursive: true });
  // word list from the local build DB; `node scripts/seed.ts` applies the cached forms
  const db = drizzle(new Database("data/lafz.db"), { casing });
  const todo = db
    .select({ id: words.id, word: words.word })
    .from(words)
    .all()
    .filter((w) => !cache[w.word]);
  console.log(`${todo.length} words to fetch`);
  let done = 0;
  let failed = 0;
  // ponytail: 4 workers with a pause stays gentle on someone's free server; ~45 min for the full list
  const worker = async () => {
    for (let w = todo.shift(); w; w = todo.shift()) {
      try {
        cache[w.word] = await fetchWord(w.word);
      } catch (e) {
        failed++;
        console.error(String(e));
      }
      if (++done % 50 === 0) {
        writeFileSync(CACHE, JSON.stringify(cache));
        console.log(`${done} done`);
      }
      await new Promise((r) => setTimeout(r, 300));
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  writeFileSync(CACHE, JSON.stringify(cache));
  const hits = Object.values(cache).filter((c): c is Hit => "forms" in c);
  console.log(
    `${hits.length} found (${hits.filter((h) => h.us).length} US, ${hits.filter((h) => h.uk).length} UK audio), ` +
      `${Object.keys(cache).length - hits.length} missing, ${failed} failed (rerun to retry)`,
  );
}
