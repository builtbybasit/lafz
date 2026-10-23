import { expect, test } from "vite-plus/test";
import { formsOf } from "./fetch_cambridge.ts";

const v = (pairs: [string, string][]) => pairs.map(([type, text]) => ({ type, text }));

test("formsOf keeps only inflection blocks headed by the word", () => {
  const bored = v([
    ["Positive", "bored"],
    ["Comparative", "more bored"],
    ["Superlative", "most bored"],
    ["Plain form", "bore"],
    ["Past tense", "bored"],
    ["Present participle", "boring"],
  ]);
  expect(formsOf("bored", bored)).toEqual([]);

  const best = v([
    ["Positive", "good"],
    ["Comparative", "better"],
    ["Superlative", "best"],
    ["Singular", "best"],
    ["Plural", "none"],
    ["Plain form", "best"],
    ["Past tense", "bested"],
  ]);
  expect(formsOf("best", best)).toEqual(["bested"]);

  const go = v([
    ["Plain form", "go"],
    ["Third-person singular", "goes"],
    ["Past tense", "went"],
    ["Past participle", "gone"],
  ]);
  expect(formsOf("go", go)).toEqual(["goes", "went", "gone"]);
});
