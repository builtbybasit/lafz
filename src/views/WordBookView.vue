<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { Search, Volume2 } from "@lucide/vue";
import { api, mainSense, type Word } from "@/api";
import { useSpeech } from "@/speech";

const { playWord } = useSpeech();
const words = ref<Word[]>([]);
const query = ref("");
const loading = ref(true);

const STRENGTH = ["", "New", "Weak", "OK", "Strong", "Mastered"];

onMounted(async () => {
  // ponytail: no "all learned words" endpoint; fetch every started pack in parallel (≈1 request per 10 words).
  const packs = (await api.worlds()).flatMap((w) => w.packs).filter((p) => p.learned > 0);
  const res = await Promise.all(packs.map((p) => api.pack(p.id)));
  words.value = res
    .flatMap((r) => r.words)
    .filter((w) => w.box > 0)
    .sort((a, b) => a.word.localeCompare(b.word));
  loading.value = false;
});

const filtered = computed(() => {
  const s = query.value.trim().toLowerCase();
  if (!s) return words.value;
  return words.value.filter(
    (w) =>
      w.word.toLowerCase().includes(s) ||
      w.ur.includes(s) ||
      mainSense(w).def.toLowerCase().includes(s),
  );
});
</script>

<template>
  <div class="page narrow book">
    <header class="head rise">
      <div>
        <p class="eyebrow">Word book</p>
        <h1>You know {{ words.length }} words</h1>
      </div>
      <label class="search">
        <Search :size="18" />
        <input v-model="query" type="search" placeholder="Search English or اردو" />
      </label>
    </header>

    <p v-if="loading" class="muted center">Loading…</p>

    <section v-else-if="!words.length" class="card empty pop">
      <h2>No words yet</h2>
      <p class="muted">Finish your first pack and they'll show up here.</p>
      <RouterLink to="/world" class="btn btn-lime">Go to the map</RouterLink>
    </section>

    <ul v-else class="list">
      <li v-for="w in filtered" :key="w.id" class="card row rise">
        <button class="icon-btn" :aria-label="`Play ${w.word}`" @click="playWord(w)">
          <Volume2 :size="20" />
        </button>
        <div class="main">
          <div class="line">
            <b class="w">{{ w.word }}</b>
            <span class="muted ipa">/{{ w.ipa }}/</span>
            <span class="pill">{{ w.pos }}</span>
          </div>
          <p class="muted def">{{ mainSense(w).def }}</p>
        </div>
        <span v-if="w.ur" class="ur">{{ w.ur }}</span>
        <div class="strength" :title="`Box ${w.box}`">
          <span class="boxes"><i v-for="b in 5" :key="b" :class="{ on: b <= w.box }" /></span>
          <span class="muted lbl">{{ STRENGTH[w.box] }}</span>
        </div>
      </li>
      <li v-if="!filtered.length" class="muted center">No matches for “{{ query }}”</li>
    </ul>
  </div>
</template>

<style scoped>
.book {
  display: grid;
  gap: 24px;
}

.head {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
}

.head h1 {
  font-size: 2rem;
  font-weight: 900;
}

.search {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  color: var(--muted);
  min-width: 280px;
}

.search input {
  flex: 1;
  background: none;
  border: 0;
  outline: none;
  font-weight: 700;
}

.center {
  text-align: center;
}

.empty {
  display: grid;
  justify-items: center;
  gap: 10px;
  padding: 40px;
  text-align: center;
}

.list {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 18px;
  border-radius: 16px;
}

.main {
  flex: 1;
  min-width: 0;
}

.line {
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
}

.w {
  font-size: 1.25rem;
  font-weight: 900;
}

.ipa {
  font-weight: 600;
}

.def {
  font-size: 0.9rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.row .ur {
  color: var(--amber);
  font-size: 1.2rem;
  min-width: 90px;
  text-align: right;
}

.strength {
  display: grid;
  justify-items: center;
  gap: 2px;
  min-width: 70px;
}

.boxes {
  display: flex;
  gap: 3px;
}

.boxes i {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
}

.boxes .on {
  background: var(--lime);
  box-shadow: 0 0 6px rgba(163, 230, 53, 0.5);
}

.lbl {
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
</style>
