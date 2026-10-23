<script setup lang="ts">
import { computed, watch } from "vue";
import { Play, Volume2 } from "@lucide/vue";
import { mainSense, type Word } from "@/api";
import { exampleOf, findBlank } from "@/game";
import { useSpeech } from "@/speech";

const props = defineProps<{ word: Word }>();
const { speak, playWord, speaking } = useSpeech();

const sense = computed(() => mainSense(props.word));
const example = computed(() => exampleOf(props.word));
const blank = computed(() => (example.value ? findBlank(props.word, example.value) : null));
const say = () => playWord(props.word);

watch(
  () => props.word.id,
  () => setTimeout(say, 250),
  { immediate: true },
);
</script>

<template>
  <article class="card wordcard rise">
    <div class="meta">
      <span class="pill pos">{{ word.pos || "word" }}</span>
      <span v-if="word.gram" class="muted gram">{{ word.gram }}</span>
      <span v-if="word.level" class="pill lvl">{{ word.level }}</span>
    </div>

    <div class="head">
      <div>
        <h1 class="w">{{ word.word }}</h1>
        <p v-if="word.ipa" class="ipa">/{{ word.ipa }}/</p>
      </div>
      <button class="speak" :class="{ on: speaking }" aria-label="Play pronunciation" @click="say">
        <Volume2 :size="34" />
      </button>
    </div>

    <p v-if="word.ur" class="ur urdu">{{ word.ur }}</p>

    <div class="def">
      <p v-if="sense.phrase" class="phrase">{{ sense.phrase }}</p>
      <p class="en">{{ sense.def }}</p>
      <p v-if="sense.ur && sense.ur !== word.ur" class="ur sense-ur">{{ sense.ur }}</p>
    </div>

    <div v-if="example" class="example">
      <button class="icon-btn" aria-label="Play example" @click="speak(example, 0.9)">
        <Play :size="20" />
      </button>
      <p>
        <template v-if="blank"
          >{{ blank.before }}<mark>{{ blank.match }}</mark
          >{{ blank.after }}</template
        >
        <template v-else>{{ example }}</template>
      </p>
    </div>

    <details v-if="word.senses.length > 1" class="more">
      <summary>More meanings ({{ word.senses.length - 1 }})</summary>
      <ul>
        <li v-for="(s, i) in word.senses.slice(1)" :key="i">
          <b v-if="s.phrase" class="phrase">{{ s.phrase }}</b>
          <span>{{ s.def }}</span>
          <span v-if="s.ur" class="ur">{{ s.ur }}</span>
        </li>
      </ul>
    </details>
  </article>
</template>

<style scoped>
.wordcard {
  padding: 28px 32px 24px;
  display: grid;
  gap: 18px;
}

.meta {
  display: flex;
  align-items: center;
  gap: 10px;
}

.pos {
  color: var(--sky);
  background: rgba(56, 189, 248, 0.14);
}

.lvl {
  color: var(--lime);
  background: rgba(163, 230, 53, 0.14);
}

.gram {
  font-size: 0.9rem;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.w {
  font-size: clamp(2.6rem, 6vw, 4rem);
  font-weight: 900;
  line-height: 1;
  letter-spacing: -0.02em;
}

.ipa {
  margin-top: 8px;
  color: var(--muted);
  font-size: 1.2rem;
  font-weight: 600;
  font-family: "Charis SIL", "Gentium Plus", "Noto Serif", var(--font);
}

.urdu {
  font-size: 2rem;
  color: var(--amber);
}

.def {
  display: grid;
  gap: 4px;
  padding: 16px 20px;
  border-radius: var(--radius-s);
  background: rgba(0, 0, 0, 0.22);
}

.phrase {
  font-weight: 900;
  color: var(--violet-2);
  font-size: 1.1rem;
}

.en {
  font-size: 1.2rem;
  font-weight: 700;
}

.sense-ur {
  color: var(--muted);
  font-size: 1.1rem;
}

.example {
  display: flex;
  align-items: center;
  gap: 14px;
  font-size: 1.15rem;
  font-weight: 600;
  font-style: italic;
  color: #d9d8f2;
}

.example .icon-btn {
  flex: none;
  color: var(--lime);
}

mark {
  background: rgba(163, 230, 53, 0.25);
  color: var(--lime);
  border-radius: 6px;
  padding: 0 4px;
  font-weight: 900;
  font-style: normal;
}

.more {
  color: var(--muted);
}

.more summary {
  cursor: pointer;
  font-weight: 800;
}

.more ul {
  margin: 10px 0 0;
  padding-left: 18px;
  display: grid;
  gap: 8px;
  color: var(--text);
}

.more li {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: baseline;
}

.more .ur {
  color: var(--amber);
}
</style>
