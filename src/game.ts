import { mainSense, type Level, type Word } from "./api";

export const WORLD_NO: Record<Level, number> = { A1: 1, A2: 2, B1: 3 };

export type QType = "listen" | "meaning" | "blank" | "spell";

export interface Blank {
  before: string;
  match: string;
  after: string;
}

export interface Question {
  type: QType;
  word: Word;
  options: Word[]; // 4 words incl. the answer (empty for spell)
  blank?: Blank;
  retry?: boolean;
}

export const shuffle = <T>(a: T[]): T[] => {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j]!, r[i]!];
  }
  return r;
};

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Find the headword (or an inflection like "runs"/"bigger") in a sentence and split around it. */
export function findBlank(word: Word, sentence: string): Blank | null {
  // Real inflections first ("go" -> "went"), longest first; then the prefix guess for regular forms.
  const forms = [...(word.forms ?? [])].sort((a, b) => b.length - a.length).map(esc);
  const m = new RegExp(`\\b(${[...forms, `${esc(word.word)}\\w*`].join("|")})`, "i").exec(sentence);
  if (!m) return null;
  return {
    before: sentence.slice(0, m.index),
    match: m[1]!,
    after: sentence.slice(m.index + m[1]!.length),
  };
}

export const exampleOf = (w: Word) => mainSense(w).examples[0];

function pickDistractors(word: Word, pool: Word[]): Word[] {
  const rest = shuffle(
    pool.filter((p) => p.id !== word.id && p.word.toLowerCase() !== word.word.toLowerCase()),
  );
  const same = rest.filter((p) => p.pos === word.pos);
  const other = rest.filter((p) => p.pos !== word.pos);
  return [...same, ...other].slice(0, 3);
}

export function buildQuestions(words: Word[], pool: Word[]): Question[] {
  return shuffle(words).map((word) => {
    const types: QType[] = ["listen", "meaning"];
    const ex = mainSense(word).examples.find((e) => findBlank(word, e));
    if (ex) types.push("blank");
    if (/^[a-z]{2,8}$/i.test(word.word)) types.push("spell");
    const type = types[Math.floor(Math.random() * types.length)]!;
    return {
      type,
      word,
      options: type === "spell" ? [] : shuffle([word, ...pickDistractors(word, pool)]),
      blank: type === "blank" && ex ? (findBlank(word, ex) ?? undefined) : undefined,
    };
  });
}

export const starsFor = (score: number): 0 | 1 | 2 | 3 =>
  score >= 0.9 ? 3 : score >= 0.7 ? 2 : score >= 0.5 ? 1 : 0;
