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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Cambridge throttles bursts, so retry with backoff before giving up (a rerun tries again).
async function download(url: string, file: string) {
  for (const wait of [0, 2000, 6000]) {
    await sleep(wait);
    const res = await fetch(url, { headers: BROWSER }).catch(() => null);
    if (res?.ok && res.headers.get("content-type")?.includes("audio")) {
      writeFileSync(file, Buffer.from(await res.arrayBuffer()));
      return true;
    }
  }
  return false;
}

async function fetchWord(word: string): Promise<Cached> {
  const res = await fetch(API + encodeURIComponent(word.replace(/ /g, "-")));
  if (res.status === 404) return { missing: true };
  if (!res.ok) throw new Error(`${word}: HTTP ${res.status}`);
  const d = (await res.json()) as ApiWord;
  // A redirect to another headword ("ate" -> "eat") would teach the wrong sound.
  if (norm(d.word) !== norm(word)) return { missing: true };
  // URLs are kept even if a download fails; the audio pass below fetches whatever file is missing.
  const url = (accent: Accent) => d.pronunciation.find((x) => x.lang === accent)?.url ?? null;
  return { forms: formsOf(word, d.verbs), us: url("us"), uk: url("uk") };
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
      await sleep(300);
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  writeFileSync(CACHE, JSON.stringify(cache));

  // Audio pass: download every recording we have a URL for but no file yet.
  const files = Object.entries(cache).flatMap(([word, c]) =>
    "forms" in c
      ? (["us", "uk"] as Accent[]).flatMap((a) => {
          const url = c[a];
          const file = audioFile(word, a);
          return url && !existsSync(file) ? [{ url, file }] : [];
        })
      : [],
  );
  console.log(`${files.length} recordings to download`);
  let missingAudio = 0;
  const downloader = async () => {
    for (let f = files.shift(); f; f = files.shift()) {
      if (!(await download(f.url, f.file))) missingAudio++;
      if (files.length % 100 === 0) console.log(`${files.length} recordings left`);
      await sleep(250);
    }
  };
  await Promise.all([downloader(), downloader()]);

  const hits = Object.entries(cache).filter((e): e is [string, Hit] => "forms" in e[1]);
  const have = (a: Accent) => hits.filter(([w]) => existsSync(audioFile(w, a))).length;
  console.log(
    `${hits.length} found (${have("us")} US, ${have("uk")} UK audio files), ` +
      `${Object.keys(cache).length - hits.length} missing, ${failed} lookups and ${missingAudio} downloads failed (rerun to retry)`,
  );
}
