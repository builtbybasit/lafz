// Build the game DB from data/dictionary.raw.json + the Haiku review in data/reviewed/*.jsonl
// + word forms from data/cambridge.json. Learning progress is carried over by word text.
// Usage: node scripts/seed.ts [--force]   (--force wipes progress; run `vp exec drizzle-kit push` first)
import { existsSync, readdirSync, readFileSync } from "node:fs";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { casing, packs, profile, words, type Level, type Sense } from "../server/db.ts";

// The local build DB; scripts/sync_d1.ts copies it into D1.
const db = drizzle(new Database("data/lafz.db"), { casing });

const LEVELS: Level[] = ["A1", "A2", "B1"];
const PACK_SIZE = 10;

interface Entry {
  id: number;
  word: string;
  ipa: string;
  pos: string;
  gram: string;
  senses: Omit<Sense, "ur">[];
}
interface Review {
  id: number;
  ur: string;
  senses_ur: string[];
  fix: Partial<Omit<Entry, "id">> | null;
}

const raw: Entry[] = JSON.parse(readFileSync("data/dictionary.raw.json", "utf8"));
const reviews = new Map<number, Review>();
let badLines = 0;
for (const f of existsSync("data/reviewed") ? readdirSync("data/reviewed") : []) {
  for (const line of readFileSync(`data/reviewed/${f}`, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const r: Review = JSON.parse(line);
      reviews.set(r.id, r);
    } catch {
      badLines++;
    }
  }
}

// Jaccard similarity of the two texts' word sets.
function overlap(a: string, b: string) {
  const wa = new Set(a.toLowerCase().match(/[a-z’']+/g));
  const wb = new Set(b.toLowerCase().match(/[a-z’']+/g));
  const shared = [...wa].filter((w) => wb.has(w)).length;
  return shared / (wa.size + wb.size - shared || 1);
}

let unreviewed = 0;
let urMismatch = 0;
const entries = raw.map((e): Entry & { ur: string; senses: Sense[] } => {
  const r = reviews.get(e.id);
  if (!r) unreviewed++;
  const fixed = { ...e, ...r?.fix };
  if (!Array.isArray(fixed.senses) || fixed.senses.some((s) => typeof s?.def !== "string"))
    fixed.senses = e.senses;
  const sensesUr = r?.senses_ur ?? [];
  if (r && sensesUr.length !== fixed.senses.length) urMismatch++;
  // Levels come from the PDF; the reviewers sometimes shift them when dropping a junk sense,
  // so each fixed sense takes the level of the original sense it best matches (each claimed once).
  const claimed = new Set<number>();
  const levelOf = (s: Omit<Sense, "ur">) => {
    let best = -1;
    let score = 0;
    e.senses.forEach((o, j) => {
      const sc = overlap(`${s.phrase} ${s.def}`, `${o.phrase} ${o.def}`);
      if (sc > score && !claimed.has(j)) [best, score] = [j, sc];
    });
    if (best < 0) return null;
    claimed.add(best);
    return e.senses[best].level;
  };
  return {
    ...fixed,
    ur: r?.ur ?? "",
    senses: fixed.senses.map((s, i) => ({
      level: fixed.senses === e.senses ? s.level : levelOf(s),
      phrase: s.phrase ?? "",
      labels: s.labels ?? "",
      def: s.def,
      examples: s.examples ?? [],
      ur: sensesUr.length === fixed.senses.length ? sensesUr[i] : "",
    })),
  };
});

// One game word per headword: homographs (best¹ adj, best² adv, best³ noun) merge, keeping only levelled senses.
const byWord = new Map<string, typeof entries>();
for (const e of entries) byWord.set(e.word, [...(byWord.get(e.word) ?? []), e]);
const rank = (l: Level | null) => (l ? LEVELS.indexOf(l) : 99);
const gameWords = [...byWord.values()].flatMap((group) => {
  const senses = group.flatMap((e) => e.senses).filter((s) => s.level);
  if (!senses.length) return [];
  senses.sort((a, b) => rank(a.level) - rank(b.level));
  const main = group.find((e) => e.senses.some((s) => s.level)) ?? group[0];
  return [
    {
      id: group[0].id,
      word: main.word,
      ipa: main.ipa,
      pos: [...new Set(group.map((e) => e.pos).filter(Boolean))].join(", "),
      gram: main.gram,
      ur: group.map((e) => e.ur).find(Boolean) ?? "",
      level: senses[0].level!,
      senses,
    },
  ];
});

// Deterministic shuffle so packs mix words instead of marching through the alphabet.
function shuffle<T>(items: T[], seed: number) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    seed = (seed * 1103515245 + 12345) % 2 ** 31;
    const j = seed % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const cambridge: Record<string, { forms?: string[] }> = existsSync("data/cambridge.json")
  ? JSON.parse(readFileSync("data/cambridge.json", "utf8"))
  : {};

const keep = !process.argv.includes("--force");
const oldWords = new Map(
  keep
    ? db
        .select({ word: words.word, box: words.box, due: words.due })
        .from(words)
        .all()
        .map((w) => [w.word, w])
    : [],
);
const oldStars = new Map(
  keep
    ? db
        .select()
        .from(packs)
        .all()
        .map((p) => [`${p.level}:${p.index}`, p])
    : [],
);
const oldProfile = keep ? db.select().from(profile).get() : undefined;

db.transaction((tx) => {
  tx.delete(words).run();
  tx.delete(packs).run();
  tx.delete(profile).run();
  tx.insert(profile)
    .values({ ...oldProfile, id: 1 })
    .run();
  let packId = 0;
  for (const level of LEVELS) {
    const list = shuffle(
      gameWords.filter((w) => w.level === level),
      LEVELS.indexOf(level) + 7,
    );
    for (let i = 0; i < list.length; i += PACK_SIZE) {
      // sorted by id, the same order the API serves a pack's words in, so the title names the first cards
      const chunk = list.slice(i, i + PACK_SIZE).sort((a, b) => a.id - b.id);
      packId++;
      tx.insert(packs)
        .values({
          id: packId,
          level,
          index: i / PACK_SIZE,
          stars: oldStars.get(`${level}:${i / PACK_SIZE}`)?.stars ?? 0,
          best: oldStars.get(`${level}:${i / PACK_SIZE}`)?.best ?? 0,
          title: chunk
            .slice(0, 3)
            .map((w) => w.word)
            .join(" · "),
        })
        .run();
      for (const w of chunk)
        tx.insert(words)
          .values({
            ...w,
            packId,
            forms: cambridge[w.word]?.forms ?? [],
            box: oldWords.get(w.word)?.box ?? 0,
            due: oldWords.get(w.word)?.due ?? null,
          })
          .run();
    }
  }
});

const counts = LEVELS.map((l) => `${l} ${gameWords.filter((w) => w.level === l).length}`).join(
  ", ",
);
console.log(
  `${gameWords.length} game words (${counts}) in ${db.select().from(packs).all().length} packs`,
);
console.log(
  keep
    ? `kept progress on ${[...oldWords.values()].filter((w) => w.box > 0).length} words`
    : "progress wiped",
);
console.log(
  `review: ${reviews.size} lines, ${unreviewed} entries unreviewed, ${urMismatch} sense-gloss count mismatches, ${badLines} bad lines`,
);
