# lafz · لفظ

A vocabulary game for learning English words, built for a 13-year-old whose first language is Urdu. _Lafz_ is Urdu for "word".

Words come from the _Cambridge Essential English Dictionary_, with an Urdu translation for every word and meaning and real Cambridge US/UK pronunciation recordings. They're grouped into packs of 10 across three worlds that follow the CEFR levels:

| World          | Level | Words |
| -------------- | ----- | ----- |
| Starter Island | A1    | 595   |
| Explorer Coast | A2    | 895   |
| Summit Peaks   | B1    | 1,393 |

## How it plays

- **Learn a pack:** a card per word with the pronunciation, IPA, part of speech, English meaning, Urdu meaning and an example sentence.
- **Quiz:** four mini-games, mixed: hear the word and pick it, read the meaning and pick the word, fill the gap in the example, hear the word and spell it. Wrong answers come back once at the end.
- **Stars and unlocks:** 1–3 stars per pack, and a star unlocks the next pack.
- **Reviews:** spaced repetition with Leitner boxes. A correct answer moves a word up a box (due again in 1, 2, 4, 8, then 16 days); a wrong one sends it back to box 1. Due words show up as a daily review on the home screen.
- **Motivation:** XP, levels, a daily streak and a word book of everything learned.
- **US/UK switch:** pronunciation defaults to US. Words without a Cambridge recording fall back to the browser's voice in the same accent.

Keyboard: `1`–`4` to answer, `Enter` to continue, `Space` to hear the word again.

## Stack

- [Vite+](https://viteplus.dev) (`vp`), Vue 3, TypeScript, vue-router
- [Hono](https://hono.dev) API on Cloudflare Workers
- [Drizzle ORM](https://orm.drizzle.team) on Cloudflare D1, with SQLite (better-sqlite3) for the local build database
- Static assets (the Vue build and the MP3s) served by the same Worker
- Python + [PyMuPDF](https://pymupdf.readthedocs.io) for parsing the dictionary PDF

It's a single-player app: learning progress (Leitner box, stars, XP, streak) lives on the rows themselves, and one shared password protects the whole site.

## Dictionary content is not included

The dictionary text, Urdu translations and audio are Cambridge University Press copyright, so `data/` is gitignored and this repo contains code only. To build the game you need your own copy of the PDF and must run the pipeline below. Keep the result private: the Worker is password-protected for that reason.

## Data pipeline

```
dictionary PDF ─parse─▶ dictionary.raw.json ─review─▶ reviewed/*.jsonl
                                                          │
            Cambridge API ─fetch-audio─▶ audio/*.mp3 + cambridge.json
                                                          │
                                          seed ─▶ data/lafz.db ─sync─▶ D1
```

1. **Parse** the PDF into `data/dictionary.raw.json` (7,800 entries). Spans are classified by font (headword, IPA, part of speech, sense number, CEFR level, definition, example, cross-reference):

   ```sh
   uv run scripts/parse_dictionary.py "path/to/Cambridge Essential English Dictionary.pdf"
   ```

2. **Review and translate.** The raw parse was split into 65 chunks of 120 entries in `data/chunks/`. Each chunk was given to a Claude Haiku agent, which fixed parse errors and added Urdu. The agents wrote `data/reviewed/<chunk>.jsonl`, one line per entry:

   ```json
   { "id": 2, "ur": "ایک", "senses_ur": ["ایک", "ہر"], "fix": { "ipa": "eɪ" } }
   ```

   `fix` is `null`, or holds only the fields to replace. The seed re-matches each fixed sense's CEFR level to the original PDF entry, because reviewers sometimes shifted levels when they dropped a junk sense.

3. **Create the local build database and seed it.** Seeding merges the review, groups homographs into one game word, keeps CEFR-levelled meanings and builds packs of 10. It keeps existing progress by word text; `--force` wipes it.

   ```sh
   vp run db:push
   vp run seed
   ```

4. **Fetch Cambridge recordings and word forms** (resumable) through [chenelias/cambridge-dictionary-api](https://github.com/chenelias/cambridge-dictionary-api). This saves `data/audio/<word>-us.mp3` / `-uk.mp3` and `data/cambridge.json`. Run `vp run seed` again afterwards to apply the word forms (`go → went, gone`), which the fill-the-gap game uses.

   ```sh
   vp run fetch-audio
   ```

## Development

```sh
vp install
echo "APP_PASSWORD=choose-a-password" > .dev.vars   # gitignored
ln -s ../data/audio public/audio                     # recordings as static files (gitignored)
vp run sync                                          # load data/lafz.db into the local D1
vp dev
```

`vp dev` runs the real Worker in workerd through the Cloudflare Vite plugin, with a local D1 in `.cloudflare/state`. Sign in with username `lafz` and your `APP_PASSWORD`. If `/api` is unreachable, the UI falls back to a small mock (`src/mock.ts`).

Checks: `vp check` (format, lint, types) and `vp test`.

## Deploy to Cloudflare

Configuration is in `cloudflare.config.ts`, deployed with the [`cf` CLI](https://developers.cloudflare.com/cf/).

1. Create a D1 database with `cf d1 create --name lafz`, and put its id in `cloudflare.config.ts` and `scripts/sync_d1.ts`.
2. Load the content with `vp run sync:remote`. This applies the migrations in `drizzle/`, first pulls the player's progress from D1 back into `data/lafz.db`, then replaces the content, so updating the dictionary data never resets progress.
3. Deploy with `vp run deploy`. This type-checks, builds, uploads the Worker and assets (including the audio), and uploads `APP_PASSWORD` from `.dev.vars` as a secret.

All requests run through the Worker, so the password covers pages, API and audio alike. The app refuses to serve if `APP_PASSWORD` is missing, and per-version preview URLs are disabled because they would bypass it. Dates (streaks, due reviews) use `Asia/Karachi`, the player's time zone, because Workers run on UTC.

To change the password, edit `.dev.vars` and run `vp run deploy`.

## Layout

```
server/index.ts           Hono API + password gate + static assets
server/db.ts              Drizzle schema
src/                      Vue app (views, quiz logic in game.ts, audio/TTS in speech.ts)
scripts/parse_dictionary.py   PDF → raw entries
scripts/seed.ts           raw + review + word forms → data/lafz.db
scripts/fetch_cambridge.ts    Cambridge recordings and word forms
scripts/sync_d1.ts        data/lafz.db → D1, keeping progress
drizzle/                  D1 migrations
cloudflare.config.ts      Worker, D1, assets, secret
```

## Credits

- _Cambridge Essential English Dictionary_ (2011), Cambridge University Press: word list, definitions, examples and CEFR levels
- Pronunciation recordings from Cambridge Dictionary via [chenelias/cambridge-dictionary-api](https://github.com/chenelias/cambridge-dictionary-api)
- Urdu translations and parse fixes by Claude Haiku agents
