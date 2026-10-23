import { readFile } from "node:fs/promises";
import { and, asc, eq, gt, lte, sql } from "drizzle-orm";
import { Hono } from "hono";
import { audioFile, db, packs, profile, words, type Accent, type Level } from "./db.ts";

const LEVELS: Level[] = ["A1", "A2", "B1"];
const WORLD_TITLES: Record<Level, string> = {
  A1: "Starter Island",
  A2: "Explorer Coast",
  B1: "Summit Peaks",
};
const BOX_DAYS = [0, 1, 2, 4, 8, 16]; // Leitner box -> days until next review
const XP_CORRECT = 10;
const XP_PER_STAR = 50;

const day = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString("en-CA"); // YYYY-MM-DD, local time
};

const me = () => db.select().from(profile).where(eq(profile.id, 1)).get()!;

function packSummaries(level?: Level) {
  const rows = db
    .select({
      id: packs.id,
      level: packs.level,
      index: packs.index,
      title: packs.title,
      stars: packs.stars,
      total: sql<number>`count(${words.id})`,
      learned: sql<number>`sum(${words.box} > 0)`,
    })
    .from(packs)
    .innerJoin(words, eq(words.packId, packs.id))
    .where(level ? eq(packs.level, level) : undefined)
    .groupBy(packs.id)
    .orderBy(asc(packs.id))
    .all();
  // A world's first pack is always open; every other pack opens once the one before it has a star.
  return rows.map((p, i) => ({ ...p, locked: p.index > 0 && rows[i - 1].stars === 0 }));
}

const app = new Hono().basePath("/api");

app.get("/profile", (c) => {
  const p = me();
  const [{ learned, due }] = db
    .select({
      learned: sql<number>`count(*)`,
      due: sql<number>`coalesce(sum(${words.due} <= ${day()}), 0)`,
    })
    .from(words)
    .where(gt(words.box, 0))
    .all();
  return c.json({ xp: p.xp, streak: p.streak, lastPlayed: p.lastPlayed, learned, due });
});

app.get("/worlds", (c) => {
  const all = packSummaries();
  return c.json(
    LEVELS.map((level) => ({
      level,
      title: WORLD_TITLES[level],
      packs: all.filter((p) => p.level === level),
    })),
  );
});

app.get("/packs/:id", (c) => {
  const id = Number(c.req.param("id"));
  const pack = packSummaries().find((p) => p.id === id);
  if (!pack) return c.json({ error: "pack not found" }, 404);
  return c.json({
    pack,
    words: db.select().from(words).where(eq(words.packId, id)).orderBy(asc(words.id)).all(),
  });
});

app.get("/review", (c) =>
  c.json(
    db
      .select()
      .from(words)
      .where(and(gt(words.box, 0), lte(words.due, day())))
      .orderBy(asc(words.due), asc(words.box))
      .limit(20)
      .all(),
  ),
);

// Cambridge recording; 404 when we have none, and the client falls back to browser speech.
app.get("/audio/:id/:accent", async (c) => {
  const accent = c.req.param("accent") as Accent;
  const w = db
    .select({ word: words.word })
    .from(words)
    .where(eq(words.id, Number(c.req.param("id"))))
    .get();
  if (!w || (accent !== "us" && accent !== "uk")) return c.notFound();
  try {
    const mp3 = await readFile(audioFile(w.word, accent));
    return c.body(mp3, 200, { "Content-Type": "audio/mpeg", "Cache-Control": "max-age=604800" });
  } catch {
    return c.notFound();
  }
});

app.get("/distractors", (c) => {
  const level = c.req.query("level") as Level | undefined;
  const n = Math.min(Number(c.req.query("n") ?? 30) || 30, 100);
  return c.json(
    db
      .select()
      .from(words)
      .where(level && LEVELS.includes(level) ? eq(words.level, level) : undefined)
      .orderBy(sql`random()`)
      .limit(n)
      .all(),
  );
});

// Counts today towards the streak and adds XP.
function play(xp: number) {
  const p = me();
  const today = day();
  const streak = p.lastPlayed === today ? p.streak : p.lastPlayed === day(-1) ? p.streak + 1 : 1;
  return db
    .update(profile)
    .set({ xp: p.xp + xp, streak, lastPlayed: today })
    .where(eq(profile.id, 1))
    .returning()
    .get();
}

app.post("/answers", async (c) => {
  const { wordId, correct } = await c.req.json<{ wordId: number; correct: boolean }>();
  const w = db.select({ box: words.box }).from(words).where(eq(words.id, wordId)).get();
  if (!w) return c.json({ error: "word not found" }, 404);
  const box = correct ? Math.min(w.box + 1, 5) : 1;
  db.update(words)
    .set({ box, due: day(BOX_DAYS[box]) })
    .where(eq(words.id, wordId))
    .run();
  const p = play(correct ? XP_CORRECT : 0);
  return c.json({ box, xp: p.xp, streak: p.streak });
});

app.post("/packs/:id/complete", async (c) => {
  const id = Number(c.req.param("id"));
  const { score } = await c.req.json<{ score: number }>();
  const pack = db.select().from(packs).where(eq(packs.id, id)).get();
  if (!pack) return c.json({ error: "pack not found" }, 404);
  const stars = score >= 0.9 ? 3 : score >= 0.7 ? 2 : score >= 0.5 ? 1 : 0;
  // Replaying only pays out the stars beyond your previous best.
  const gained = Math.max(stars - pack.stars, 0);
  db.update(packs)
    .set({ stars: Math.max(stars, pack.stars), best: Math.max(score, pack.best) })
    .where(eq(packs.id, id))
    .run();
  const p = play(gained * XP_PER_STAR);
  const next = stars
    ? db
        .select({ id: packs.id })
        .from(packs)
        .where(and(eq(packs.level, pack.level), eq(packs.index, pack.index + 1)))
        .get()
    : undefined;
  return c.json({ stars, xp: p.xp, unlocked: next?.id ?? null });
});

export default app;
