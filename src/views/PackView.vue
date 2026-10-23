<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { useEventListener } from "@vueuse/core";
import { ArrowLeft, ChevronLeft, ChevronRight, Zap } from "@lucide/vue";
import { api, type PackSummary, type Word } from "@/api";
import { WORLD_NO } from "@/game";
import { useSpeech } from "@/speech";
import WordCard from "@/components/WordCard.vue";

const route = useRoute();
const router = useRouter();
const id = Number(route.params.id);
const { playWord } = useSpeech();

const pack = ref<PackSummary>();
const words = ref<Word[]>([]);
const i = ref(0);
onMounted(async () => {
  const r = await api.pack(id);
  pack.value = r.pack;
  words.value = r.words;
});

const word = computed(() => words.value[i.value]);
const last = computed(() => i.value >= words.value.length - 1);
const quiz = `/pack/${id}/quiz`;

useEventListener(window, "keydown", (e: KeyboardEvent) => {
  if (!words.value.length) return;
  if (e.key === "ArrowRight" || e.key === "Enter") {
    e.preventDefault();
    if (last.value) router.push(quiz);
    else i.value++;
  } else if (e.key === "ArrowLeft") i.value = Math.max(0, i.value - 1);
  else if (e.key === " " && word.value) {
    e.preventDefault();
    playWord(word.value);
  }
});
</script>

<template>
  <div class="page narrow pack">
    <header v-if="pack" class="head rise">
      <RouterLink :to="`/world/${pack.level}`" class="icon-btn" aria-label="Back to map"
        ><ArrowLeft :size="22"
      /></RouterLink>
      <div class="title">
        <p class="eyebrow">World {{ WORLD_NO[pack.level] }} · Pack {{ pack.index + 1 }}</p>
        <h1>{{ pack.title }}</h1>
      </div>
      <RouterLink v-if="pack.learned === pack.total" :to="quiz" class="btn btn-sm btn-ghost"
        >Skip to quiz</RouterLink
      >
    </header>

    <ol class="dots">
      <li v-for="(w, k) in words" :key="w.id" :class="{ on: k === i, seen: k < i }">
        <button :aria-label="`Word ${k + 1}`" @click="i = k" />
      </li>
    </ol>

    <WordCard v-if="word" :key="word.id" :word="word" />

    <footer v-if="words.length" class="nav">
      <button class="btn btn-ghost" :disabled="i === 0" @click="i--">
        <ChevronLeft :size="20" /> Back
      </button>
      <span class="muted count">{{ i + 1 }} / {{ words.length }}</span>
      <button v-if="!last" class="btn" @click="i++">Next <ChevronRight :size="20" /></button>
      <RouterLink v-else :to="quiz" class="btn btn-lime">Start quiz <Zap :size="20" /></RouterLink>
    </footer>

    <p class="muted keys">← → move · Space hear · Enter next</p>
  </div>
</template>

<style scoped>
.pack {
  display: grid;
  gap: 20px;
}

.head {
  display: flex;
  align-items: center;
  gap: 16px;
}

.title {
  flex: 1;
}

.title h1 {
  font-size: 1.8rem;
  font-weight: 900;
}

.dots {
  display: flex;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.dots li {
  flex: 1;
}

.dots button {
  display: block;
  width: 100%;
  height: 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  transition: background 0.2s;
}

.dots .seen button {
  background: var(--violet);
}

.dots .on button {
  background: var(--lime);
  box-shadow: 0 0 0 3px rgba(163, 230, 53, 0.25);
}

.nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.count {
  font-size: 1.1rem;
}

.keys {
  text-align: center;
  font-size: 0.85rem;
}
</style>
