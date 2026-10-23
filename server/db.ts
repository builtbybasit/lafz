import Database from "better-sqlite3";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export type Level = "A1" | "A2" | "B1";
export interface Sense {
  level: Level | null;
  phrase: string;
  labels: string;
  def: string;
  ur: string;
  examples: string[];
}

// Single-user app: learning state (box, due, stars) lives on the rows themselves.
export const packs = sqliteTable("packs", {
  id: integer().primaryKey(),
  level: text().$type<Level>().notNull(),
  index: integer().notNull(),
  title: text().notNull(),
  stars: integer().notNull().default(0),
  best: real().notNull().default(0),
});

export const words = sqliteTable("words", {
  id: integer().primaryKey(),
  word: text().notNull(),
  ipa: text().notNull(),
  pos: text().notNull(),
  gram: text().notNull(),
  level: text().$type<Level>().notNull(),
  ur: text().notNull(),
  senses: text({ mode: "json" }).$type<Sense[]>().notNull(),
  forms: text({ mode: "json" })
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'`), // inflections from Cambridge
  packId: integer()
    .notNull()
    .references(() => packs.id),
  box: integer().notNull().default(0),
  due: text(), // YYYY-MM-DD, null until first answered
});

export const profile = sqliteTable("profile", {
  id: integer().primaryKey(),
  xp: integer().notNull().default(0),
  streak: integer().notNull().default(0),
  lastPlayed: text(),
});

export type Accent = "us" | "uk";
// Cambridge recordings, keyed by word text so they survive a reseed (scripts/fetch_cambridge.ts).
export const audioFile = (word: string, accent: Accent) =>
  `data/audio/${word.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${accent}.mp3`;

export const db = drizzle(new Database("data/lafz.db"), { casing: "snake_case" });
