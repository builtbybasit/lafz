<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { Check, Star, Trophy, X } from "@lucide/vue";
import { api, type CompleteResult, type Level, type PackSummary, type Word } from "@/api";
import { buildQuestions, type Question } from "@/game";
import { celebrate, sfx } from "@/fx";
import { loadProfile, profile, setXp } from "@/store";
import QuizQuestion from "@/components/QuizQuestion.vue";

const route = useRoute();
const router = useRouter();
const mode = route.name === "review" ? "review" : "pack";
const packId = Number(route.params.id);

const pack = ref<PackSummary>();
const words = ref<Word[]>([]);
const pool = ref<Word[]>([]);
const queue = ref<Question[]>([]);
const idx = ref(0);
const firsts = ref<{ word: Word; ok: boolean }[]>([]);
const phase = ref<"loading" | "empty" | "play" | "done">("loading");
const result = ref<CompleteResult | null>(null);

const q = computed(() => queue.value[idx.value]);
const correct = computed(() => firsts.value.filter((r) => r.ok).length);
const exitTo = computed(() => (pack.value ? `/world/${pack.value.level}` : "/"));

onMounted(async () => {
  if (mode === "pack") {
    const r = await api.pack(packId);
    pack.value = r.pack;
    words.value = r.words;
  } else words.value = await api.review();
  if (!words.value.length) return (phase.value = "empty");

  const levels = [...new Set(words.value.map((w) => w.level ?? "A1"))] as Level[];
  const extra = (await Promise.all(levels.map((l) => api.distractors(l, 30)))).flat();
  const seen = new Set<number>();
  pool.value = [...words.value, ...extra].filter((w) => !seen.has(w.id) && seen.add(w.id));
  start();
});

function start() {
  queue.value = buildQuestions(words.value, pool.value);
  idx.value = 0;
  firsts.value = [];
  result.value = null;
  phase.value = "play";
}

async function onAnswer(ok: boolean) {
  const cur = q.value!;
  if (cur.retry) return;
  firsts.value.push({ word: cur.word, ok });
  if (!ok) queue.value.push({ ...cur, retry: true });
  const r = await api.answer(cur.word.id, ok);
  setXp(r.xp);
  profile.value.streak = r.streak;
}

async function onNext() {
  if (idx.value < queue.value.length - 1) return idx.value++;
  phase.value = "done";
  sfx("win");
  if (mode === "pack") {
    result.value = await api.complete(packId, correct.value / firsts.value.length);
    setXp(result.value.xp);
    if (result.value.stars >= 2) celebrate(result.value.stars === 3);
  } else celebrate();
  loadProfile();
}

const headline = computed(() =>
  mode === "review"
    ? `${correct.value} / ${firsts.value.length} remembered`
    : (["Keep trying!", "Nice work!", "Great job!", "Perfect!"][
        result.value?.stars ?? 0
      ] as string),
);
</script>

<template>
  <div class="page narrow quiz">
    <header v-if="phase === 'play'" class="head">
      <button class="icon-btn" aria-label="Quit" @click="router.push(exitTo)">
        <X :size="22" />
      </button>
      <span class="bar lime"><i :style="{ width: (idx / queue.length) * 100 + '%' }" /></span>
      <span class="muted count">{{ idx + 1 }} / {{ queue.length }}</span>
    </header>

    <p v-if="phase === 'loading'" class="muted center">Loading…</p>

    <section v-else-if="phase === 'empty'" class="card results pop">
      <Trophy :size="64" class="gold" />
      <h1>Nothing to review!</h1>
      <p class="muted">Come back tomorrow, or learn a new pack.</p>
      <div class="cta"><RouterLink to="/" class="btn btn-lime btn-big">Home</RouterLink></div>
    </section>

    <QuizQuestion
      v-else-if="phase === 'play' && q"
      :key="idx"
      :q="q"
      @answer="onAnswer"
      @next="onNext"
    />

    <section v-else-if="phase === 'done'" class="card results pop">
      <p class="eyebrow">{{ mode === "pack" ? "Pack complete" : "Review complete" }}</p>

      <div v-if="mode === 'pack' && result" class="stars">
        <Star
          v-for="s in 3"
          :key="s"
          :size="72"
          :class="{ lit: s <= result.stars }"
          :style="{ animationDelay: s * 0.3 + 's' }"
        />
      </div>
      <Trophy v-else :size="72" class="gold" />

      <h1>{{ headline }}</h1>
      <p class="muted">
        <template v-if="mode === 'pack'">{{ correct }} / {{ firsts.length }} correct</template>
        <template v-else>Correct words moved up a box · wrong ones went back to box 1</template>
      </p>

      <ul class="recap">
        <li v-for="r in firsts" :key="r.word.id" :class="r.ok ? 'ok' : 'bad'">
          <Check v-if="r.ok" :size="18" stroke-width="3" />
          <X v-else :size="18" stroke-width="3" />
          <span class="w">{{ r.word.word }}</span>
          <span v-if="r.word.ur" class="ur">{{ r.word.ur }}</span>
        </li>
      </ul>

      <div class="cta">
        <template v-if="mode === 'pack'">
          <RouterLink
            v-if="result?.unlocked"
            :to="`/pack/${result.unlocked}`"
            class="btn btn-lime btn-big"
          >
            Next pack
          </RouterLink>
          <button v-if="(result?.stars ?? 0) < 3" class="btn btn-ghost" @click="start">
            Play again
          </button>
          <RouterLink :to="exitTo" class="btn btn-ghost">World map</RouterLink>
        </template>
        <RouterLink v-else to="/" class="btn btn-lime btn-big">Home</RouterLink>
      </div>
    </section>
  </div>
</template>

<style scoped>
.quiz {
  display: grid;
  gap: 28px;
}

.head {
  display: flex;
  align-items: center;
  gap: 16px;
}

.head .bar {
  flex: 1;
}

.count {
  min-width: 56px;
  text-align: right;
}

.center {
  text-align: center;
}

.results {
  display: grid;
  justify-items: center;
  gap: 14px;
  padding: 40px 32px;
  text-align: center;
}

.results h1 {
  font-size: 2.4rem;
  font-weight: 900;
}

.gold {
  color: var(--amber);
  fill: rgba(251, 191, 36, 0.3);
}

.stars {
  display: flex;
  gap: 8px;
  color: rgba(255, 255, 255, 0.15);
}

.stars svg {
  animation: pop 0.5s cubic-bezier(0.2, 0.9, 0.3, 1.4) both;
}

.stars svg:nth-child(2) {
  transform-origin: center;
  margin-top: -16px;
}

.stars .lit {
  color: var(--amber);
  fill: var(--amber);
  filter: drop-shadow(0 0 14px rgba(251, 191, 36, 0.7));
}

.recap {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px 20px;
  width: 100%;
  max-width: 520px;
  margin: 10px 0;
  padding: 0;
  list-style: none;
}

.recap li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.2);
  text-align: left;
}

.recap .w {
  flex: 1;
  font-weight: 900;
}

.recap .ur {
  color: var(--amber);
}

.recap .ok svg {
  color: var(--green);
}

.recap .bad svg {
  color: var(--coral);
}

.cta {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
  margin-top: 8px;
}
</style>
