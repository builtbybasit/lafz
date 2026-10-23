import { and, asc, eq, gt, lte, sql } from "drizzle-orm";
import { Hono } from "hono";
import { basicAuth } from "hono/basic-auth";
import type { D1Database } from "@cloudflare/workers-types";
import { dbFor, packs, profile, words, type Level } from "./db.ts";

type Db = ReturnType<typeof dbFor>;

const LEVELS: Level[] = ["A1", "A2", "B1"];
const WORLD_TITLES: Record<Level, string> = {
  A1: "Starter Island",
  A2: "Explorer Coast",
  B1: "Summit Peaks",
};
const BOX_DAYS = [0, 1, 2, 4, 8, 16]; // Leitner box -> days until next review
const XP_CORRECT = 10;
const XP_PER_STAR = 50;
const TIME_ZONE = "Asia/Karachi"; // the player's day; Workers themselves run on UTC

const day = (offset = 0) =>
  new Date(Date.now() + offset * 86_400_000).toLocaleDateString("en-CA", { timeZone: TIME_ZONE }); // YYYY-MM-DD

const me = async (db: Db) => (await db.select().from(profile).where(eq(profile.id, 1)).get())!;

async function packSummaries(db: Db) {
  const rows = await db
    .select({
      id: packs.id,
      level: packs.level,
      index: packs.index,
      title: packs.title,
      stars: packs.stars,
      total: sql<number>`count(${words.id})`,
      learned: sql<number>`coalesce(sum(${words.box} > 0), 0)`,
    })
    .from(packs)
    .innerJoin(words, eq(words.packId, packs.id))
    .groupBy(packs.id)
    .orderBy(asc(packs.id))
    .all();
  // A world's first pack is always open; every other pack opens once the one before it has a star.
  return rows.map((p, i) => ({ ...p, locked: p.index > 0 && rows[i - 1].stars === 0 }));
}

// Counts today towards the streak and adds XP.
async function play(db: Db, xp: number) {
  const p = await me(db);
  const today = day();
  const streak = p.lastPlayed === today ? p.streak : p.lastPlayed === day(-1) ? p.streak + 1 : 1;
  return (await db
    .update(profile)
    .set({ xp: p.xp + xp, streak, lastPlayed: today })
    .where(eq(profile.id, 1))
    .returning()
    .get())!;
}

type Env = {
  DB: D1Database;
  ASSETS: { fetch(req: Request): Promise<Response> }; // the static assets (Vue build, audio)
  APP_PASSWORD?: string;
};
const api = new Hono<{ Bindings: Env; Variables: { db: Db } }>();

api.use(async (c, next) => {
  c.set("db", dbFor(c.env.DB));
  await next();
});

api.get("/profile", async (c) => {
  const db = c.var.db;
  const p = await me(db);
  const [{ learned, due }] = await db
    .select({
      learned: sql<number>`count(*)`,
      due: sql<number>`coalesce(sum(${words.due} <= ${day()}), 0)`,
    })
    .from(words)
    .where(gt(words.box, 0))
    .all();
  return c.json({ xp: p.xp, streak: p.streak, lastPlayed: p.lastPlayed, learned, due });
});

api.get("/worlds", async (c) => {
  const all = await packSummaries(c.var.db);
  return c.json(
    LEVELS.map((level) => ({
      level,
      title: WORLD_TITLES[level],
      packs: all.filter((p) => p.level === level),
    })),
  );
});

api.get("/packs/:id", async (c) => {
  const db = c.var.db;
  const id = Number(c.req.param("id"));
  const pack = (await packSummaries(db)).find((p) => p.id === id);
  if (!pack) return c.json({ error: "pack not found" }, 404);
  return c.json({
    pack,
    words: await db.select().from(words).where(eq(words.packId, id)).orderBy(asc(words.id)).all(),
  });
});

api.get("/review", async (c) =>
  c.json(
    await c.var.db
      .select()
      .from(words)
      .where(and(gt(words.box, 0), lte(words.due, day())))
      .orderBy(asc(words.due), asc(words.box))
      .limit(20)
      .all(),
  ),
);

api.get("/distractors", async (c) => {
  const level = c.req.query("level") as Level | undefined;
  const n = Math.min(Number(c.req.query("n") ?? 30) || 30, 100);
  return c.json(
    await c.var.db
      .select()
      .from(words)
      .where(level && LEVELS.includes(level) ? eq(words.level, level) : undefined)
      .orderBy(sql`random()`)
      .limit(n)
      .all(),
  );
});

api.post("/answers", async (c) => {
  const db = c.var.db;
  const { wordId, correct } = await c.req.json<{ wordId: number; correct: boolean }>();
  const w = await db.select({ box: words.box }).from(words).where(eq(words.id, wordId)).get();
  if (!w) return c.json({ error: "word not found" }, 404);
  const box = correct ? Math.min(w.box + 1, 5) : 1;
  await db
    .update(words)
    .set({ box, due: day(BOX_DAYS[box]) })
    .where(eq(words.id, wordId))
    .run();
  const p = await play(db, correct ? XP_CORRECT : 0);
  return c.json({ box, xp: p.xp, streak: p.streak });
});

api.post("/packs/:id/complete", async (c) => {
  const db = c.var.db;
  const id = Number(c.req.param("id"));
  const { score } = await c.req.json<{ score: number }>();
  const pack = await db.select().from(packs).where(eq(packs.id, id)).get();
  if (!pack) return c.json({ error: "pack not found" }, 404);
  const stars = score >= 0.9 ? 3 : score >= 0.7 ? 2 : score >= 0.5 ? 1 : 0;
  // Replaying only pays out the stars beyond your previous best.
  const gained = Math.max(stars - pack.stars, 0);
  await db
    .update(packs)
    .set({ stars: Math.max(stars, pack.stars), best: Math.max(score, pack.best) })
    .where(eq(packs.id, id))
    .run();
  const p = await play(db, gained * XP_PER_STAR);
  const next = stars
    ? await db
        .select({ id: packs.id })
        .from(packs)
        .where(and(eq(packs.level, pack.level), eq(packs.index, pack.index + 1)))
        .get()
    : undefined;
  return c.json({ stars, xp: p.xp, unlocked: next?.id ?? null });
});

// One shared password in front of everything (pages, API, audio): one save, copyrighted content.
const app = new Hono<{ Bindings: Env }>();
app.use(async (c, next) => {
  const password = c.env.APP_PASSWORD;
  if (!password) return c.text("APP_PASSWORD is not set", 500); // fail closed, never open
  return basicAuth({ username: "lafz", password, realm: "lafz" })(c, next);
});
app.route("/api", api);
app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
