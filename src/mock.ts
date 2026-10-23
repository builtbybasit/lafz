// In-memory stand-in for /api while the backend is being built. Two real A1 packs; everything else is locked.
import type { Level, PackSummary, Sense, Word, World } from "./api";

const S = (def: string, ur: string, examples: string[], phrase = ""): Sense => ({
  level: "A1",
  phrase,
  labels: "",
  def,
  ur,
  examples,
});

const W = (
  id: number,
  word: string,
  ipa: string,
  pos: string,
  ur: string,
  def: string,
  examples: string[],
  gram = "",
  more: Sense[] = [],
): Word => ({
  id,
  word,
  ipa,
  pos,
  gram,
  level: "A1",
  ur,
  senses: [S(def, ur, examples), ...more],
  box: 0,
});

const words: Word[] = [
  W(
    1,
    "apple",
    "ˈæp.əl",
    "noun",
    "سیب",
    "a hard, round fruit that is white inside and has a red, green, or yellow skin",
    ["I eat an apple every day.", "an apple tree"],
  ),
  W(
    2,
    "book",
    "bʊk",
    "noun",
    "کتاب",
    "a set of pages fastened together inside a cover, to be read",
    ["I'm reading a good book.", "a book about animals"],
  ),
  W(
    3,
    "cat",
    "kæt",
    "noun",
    "بلی",
    "a small animal with fur, four legs, and a tail that people keep as a pet",
    ["The cat is sleeping on the chair."],
  ),
  W(
    4,
    "dog",
    "dɒɡ",
    "noun",
    "کتا",
    "an animal with fur, four legs, and a tail that people keep as a pet",
    ["We have a big dog.", "The dog barked all night."],
  ),
  W(
    5,
    "water",
    "ˈwɔː.tər",
    "noun",
    "پانی",
    "the clear liquid that falls from the sky as rain and that you drink",
    ["Can I have a glass of water?"],
    "[no plural]",
  ),
  W(6, "house", "haʊs", "noun", "گھر", "a building where people live", [
    "They live in a small house.",
    "Come to my house after school.",
  ]),
  W(
    7,
    "big",
    "bɪɡ",
    "adj",
    "بڑا",
    "large in size or amount",
    ["I come from a big family.", "We're looking for a bigger house."],
    "(bigger, biggest)",
  ),
  W(8, "small", "smɔːl", "adj", "چھوٹا", "little in size or amount", [
    "They live in a small house.",
    "a small child",
  ]),
  W(
    9,
    "run",
    "rʌn",
    "verb",
    "دوڑنا",
    "to move on your feet faster than you walk",
    ["I run every morning.", "He runs very fast."],
    "(running, ran, run)",
  ),
  W(
    10,
    "happy",
    "ˈhæp.i",
    "adj",
    "خوش",
    "feeling or showing pleasure",
    ["She looks very happy today.", "I'm so happy to see you!"],
    "(happier, happiest)",
    [
      S(
        "something you say to someone on their birthday",
        "سالگرہ مبارک",
        ["Happy birthday, Ali!"],
        "happy birthday!",
      ),
    ],
  ),
  W(
    11,
    "door",
    "dɔːr",
    "noun",
    "دروازہ",
    "the part of a building or room that you open and close to go in or out",
    ["Please close the door.", "Someone is knocking at the door."],
  ),
  W(
    12,
    "window",
    "ˈwɪn.dəʊ",
    "noun",
    "کھڑکی",
    "a space in the wall of a building with glass in it that lets in light",
    ["Open the window, it's hot in here.", "She looked out of the window."],
  ),
  W(
    13,
    "chair",
    "tʃeər",
    "noun",
    "کرسی",
    "a seat for one person, with a back and usually four legs",
    ["Sit on this chair.", "a kitchen chair"],
  ),
  W(14, "table", "ˈteɪ.bəl", "noun", "میز", "a piece of furniture with a flat top and legs", [
    "The food is on the table.",
    "the kitchen table",
  ]),
  W(15, "friend", "frend", "noun", "دوست", "someone who you know well and like", [
    "Ali is my best friend.",
    "She's going out with friends tonight.",
  ]),
  W(16, "school", "skuːl", "noun", "اسکول", "a place where children go to learn", [
    "I go to school by bus.",
    "What did you do at school today?",
  ]),
  W(
    17,
    "eat",
    "iːt",
    "verb",
    "کھانا",
    "to put food in your mouth and swallow it",
    ["We eat dinner at seven.", "Do you eat meat?"],
    "(ate, eaten)",
  ),
  W(
    18,
    "drink",
    "drɪŋk",
    "verb",
    "پینا",
    "to put liquid in your mouth and swallow it",
    ["Drink some water.", "He drinks a lot of tea."],
    "(drank, drunk)",
  ),
  W(
    19,
    "between",
    "bɪˈtwiːn",
    "preposition",
    "کے درمیان",
    "in the space that separates two places, people, or things",
    ["The town lies halfway between Florence and Rome.", "Sit between Sara and me."],
  ),
  W(
    20,
    "red",
    "red",
    "adj",
    "سرخ",
    "being the colour of blood",
    ["She has a red car.", "a red apple"],
    "(redder, reddest)",
  ),
];

const realPacks = [
  { id: 1, title: "First words", ids: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
  { id: 2, title: "Around you", ids: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20] },
];
const titles = [
  "First words",
  "Around you",
  "Family",
  "Food & drink",
  "Colours",
  "At school",
  "My day",
  "Animals",
];

const state = {
  xp: 0,
  streak: 1,
  lastPlayed: null as string | null,
  stars: {} as Record<number, 0 | 1 | 2 | 3>,
  unlocked: 1,
  reviewed: new Set<number>(),
};

const byId = (id: number) => words.find((w) => w.id === id);
const packWords = (id: number) =>
  (realPacks.find((p) => p.id === id) ?? realPacks[0]!).ids.map((i) => byId(i)!);
const learnedCount = () => words.filter((w) => w.box > 0).length;
const due = () => words.filter((w) => w.box > 0 && !state.reviewed.has(w.id));

function summary(id: number, level: Level, index: number): PackSummary {
  const real = realPacks.find((p) => p.id === id);
  return {
    id,
    level,
    index,
    title: real?.title ?? (level === "A1" ? titles[index - 1]! : `Pack ${index}`),
    total: 10,
    learned: real ? packWords(id).filter((w) => w.box > 0).length : 0,
    stars: state.stars[id] ?? 0,
    locked: id > state.unlocked,
  };
}

const worlds = (): World[] => [
  {
    level: "A1",
    title: "Beginner Village",
    packs: Array.from({ length: 8 }, (_, i) => summary(i + 1, "A1", i + 1)),
  },
  {
    level: "A2",
    title: "Market Town",
    packs: Array.from({ length: 6 }, (_, i) => summary(i + 9, "A2", i + 1)),
  },
  {
    level: "B1",
    title: "Sky City",
    packs: Array.from({ length: 6 }, (_, i) => summary(i + 15, "B1", i + 1)),
  },
];

const shuffled = <T>(a: T[]) => [...a].sort(() => Math.random() - 0.5);

export function handle(path: string, body?: unknown): unknown {
  const url = new URL(path, "http://x");
  const p = url.pathname;
  let m: RegExpMatchArray | null;

  if (p === "/profile")
    return {
      xp: state.xp,
      streak: state.streak,
      lastPlayed: state.lastPlayed,
      learned: learnedCount(),
      due: due().length,
    };
  if (p === "/worlds") return worlds();
  if (p === "/review") return due().slice(0, 20);
  if (p === "/distractors")
    return shuffled(words).slice(0, Number(url.searchParams.get("n") ?? 30));

  if ((m = p.match(/^\/packs\/(\d+)\/complete$/))) {
    const id = Number(m[1]);
    const { score } = body as { score: number };
    const stars = (score >= 0.9 ? 3 : score >= 0.7 ? 2 : score >= 0.5 ? 1 : 0) as 0 | 1 | 2 | 3;
    state.stars[id] = Math.max(state.stars[id] ?? 0, stars) as 0 | 1 | 2 | 3;
    if (stars > 0) for (const w of packWords(id)) w.box = Math.max(w.box, 1);
    let unlocked: number | null = null;
    if (stars > 0 && id === state.unlocked) unlocked = ++state.unlocked;
    state.xp += 20 + stars * 15;
    return { stars, xp: state.xp, unlocked };
  }
  if ((m = p.match(/^\/packs\/(\d+)$/))) {
    const id = Number(m[1]);
    const w = worlds()
      .flatMap((x) => x.packs)
      .find((x) => x.id === id)!;
    return { pack: w, words: packWords(id) };
  }
  if (p === "/answers") {
    const { wordId, correct } = body as { wordId: number; correct: boolean };
    const w = byId(wordId);
    if (w) {
      w.box = correct ? Math.min(5, w.box + 1) : 1;
      state.reviewed.add(w.id);
    }
    state.xp += correct ? 10 : 2;
    state.lastPlayed = new Date().toISOString().slice(0, 10);
    return { box: w?.box ?? 1, xp: state.xp, streak: state.streak };
  }
  throw new Error(`mock: no route for ${path}`);
}
