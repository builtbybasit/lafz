export type Level = "A1" | "A2" | "B1";

export interface Sense {
  level: Level | null;
  phrase: string;
  labels: string;
  def: string;
  ur: string;
  examples: string[];
}

export interface Word {
  id: number;
  word: string;
  ipa: string;
  pos: string;
  gram: string;
  level: Level | null;
  ur: string;
  senses: Sense[];
  forms?: string[]; // inflections from Cambridge ("went", "gone"); absent in the mock
  box: number;
}

export interface PackSummary {
  id: number;
  level: Level;
  index: number;
  title: string;
  total: number;
  learned: number;
  stars: 0 | 1 | 2 | 3;
  locked: boolean;
}

export interface World {
  level: Level;
  title: string;
  packs: PackSummary[];
}

export interface Profile {
  xp: number;
  streak: number;
  lastPlayed: string | null;
  learned: number;
  due: number;
}

export interface AnswerResult {
  box: number;
  xp: number;
  streak: number;
}

export interface CompleteResult {
  stars: 0 | 1 | 2 | 3;
  xp: number;
  unlocked: number | null;
}

let mock: typeof import("./mock") | null = null;

async function call<T>(path: string, body?: unknown): Promise<T> {
  if (!mock) {
    try {
      const r = await fetch("/api" + path, {
        method: body === undefined ? "GET" : "POST",
        headers: { "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      // Vite's SPA fallback answers unknown paths with index.html (200), so check the type too.
      if (r.ok && r.headers.get("content-type")?.includes("json")) return (await r.json()) as T;
    } catch {
      /* fall through to mock */
    }
    mock = await import("./mock");
    console.warn("[lafz] /api unavailable, using in-memory mock");
  }
  return mock.handle(path, body) as T;
}

export const api = {
  profile: () => call<Profile>("/profile"),
  worlds: () => call<World[]>("/worlds"),
  pack: (id: number) => call<{ pack: PackSummary; words: Word[] }>(`/packs/${id}`),
  review: () => call<Word[]>("/review"),
  distractors: (level: Level, n = 30) => call<Word[]>(`/distractors?level=${level}&n=${n}`),
  answer: (wordId: number, correct: boolean) => call<AnswerResult>("/answers", { wordId, correct }),
  complete: (id: number, score: number) => call<CompleteResult>(`/packs/${id}/complete`, { score }),
};

export const mainSense = (w: Word): Sense =>
  w.senses[0] ?? { level: w.level, phrase: "", labels: "", def: "", ur: w.ur, examples: [] };
