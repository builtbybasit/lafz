<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { BookOpen, ChevronRight, Flame, Map, RotateCcw, Sparkles, Zap } from "@lucide/vue";
import { api, type World } from "@/api";
import { WORLD_NO } from "@/game";
import { level, loadProfile, profile } from "@/store";

const worlds = ref<World[]>([]);
onMounted(async () => {
  [worlds.value] = await Promise.all([api.worlds(), loadProfile()]);
});

const next = computed(() => {
  for (const w of worlds.value) {
    const p =
      w.packs.find((p) => !p.locked && p.stars === 0) ??
      [...w.packs].reverse().find((p) => !p.locked);
    if (p) return { w, p };
  }
  return null;
});

const hour = new Date().getHours();
const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
</script>

<template>
  <div class="page home">
    <section class="hero rise">
      <div class="hello">
        <p class="ur salaam">السلام علیکم</p>
        <h1>{{ greeting }}, champ!</h1>
        <p class="muted sub">Ready to grab some new words?</p>
      </div>

      <div class="stats">
        <div class="card stat flame" :class="{ hot: profile.streak > 0 }">
          <Flame :size="30" />
          <b>{{ profile.streak }}</b>
          <span>day streak</span>
        </div>
        <div class="card stat lvl">
          <Zap :size="30" />
          <b>Level {{ level.n }}</b>
          <span>{{ level.pct }} / {{ level.need }} XP</span>
          <span class="bar"><i :style="{ width: level.pct + '%' }" /></span>
        </div>
        <div class="card stat known">
          <BookOpen :size="30" />
          <b>{{ profile.learned }}</b>
          <span>words known</span>
        </div>
      </div>
    </section>

    <section class="actions">
      <RouterLink v-if="profile.due > 0" to="/review" class="card action review rise">
        <span class="ico"><RotateCcw :size="34" /></span>
        <span class="txt">
          <span class="eyebrow">Daily review · bonus XP</span>
          <h2>Review {{ profile.due }} words</h2>
          <span class="muted">Keep them fresh before they fade</span>
        </span>
        <ChevronRight :size="30" />
      </RouterLink>

      <RouterLink v-if="next" :to="`/pack/${next.p.id}`" class="card action learn rise">
        <span class="ico"><Sparkles :size="34" /></span>
        <span class="txt">
          <span class="eyebrow"
            >World {{ WORLD_NO[next.w.level] }} · Pack {{ next.p.index + 1 }}</span
          >
          <h2>{{ next.p.stars ? "Replay" : "Continue" }} · {{ next.p.title }}</h2>
          <span class="muted">{{ next.p.total }} words · {{ next.w.title }}</span>
        </span>
        <ChevronRight :size="30" />
      </RouterLink>

      <div class="tiles">
        <RouterLink to="/world" class="card tile rise"><Map :size="26" /> World map</RouterLink>
        <RouterLink to="/words" class="card tile rise"
          ><BookOpen :size="26" /> Word book</RouterLink
        >
      </div>
    </section>
  </div>
</template>

<style scoped>
.home {
  display: grid;
  gap: 32px;
}

.hero {
  display: grid;
  gap: 28px;
}

.salaam {
  font-size: 1.4rem;
  color: var(--amber);
  text-align: left;
  direction: rtl;
}

.hello h1 {
  font-size: clamp(2.2rem, 5vw, 3.4rem);
  font-weight: 900;
  letter-spacing: -0.02em;
}

.sub {
  font-size: 1.15rem;
}

.stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.stat {
  display: grid;
  gap: 2px;
  padding: 20px 22px;
  color: var(--muted);
}

.stat b {
  font-size: 2rem;
  color: var(--text);
  line-height: 1.1;
}

.stat .bar {
  margin-top: 10px;
}

.flame svg {
  color: var(--muted);
}

.flame.hot svg {
  color: var(--amber);
  fill: rgba(251, 191, 36, 0.3);
  animation: flicker 1.2s ease-in-out infinite;
}

.lvl svg {
  color: var(--violet-2);
}

.known svg {
  color: var(--sky);
}

.actions {
  display: grid;
  gap: 16px;
}

.action {
  display: flex;
  align-items: center;
  gap: 22px;
  padding: 24px 28px;
  transition:
    transform 0.15s,
    box-shadow 0.15s;
}

.action:hover {
  transform: translateY(-3px);
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.45);
}

.action .txt {
  flex: 1;
  display: grid;
  gap: 2px;
}

.action h2 {
  font-size: 1.7rem;
  font-weight: 900;
}

.ico {
  display: grid;
  place-items: center;
  width: 68px;
  height: 68px;
  border-radius: 20px;
  flex: none;
}

.review {
  background: linear-gradient(135deg, #2f4a12, #1f3a12 60%, var(--panel));
  border-color: rgba(163, 230, 53, 0.35);
  animation: glow 2.4s ease-in-out infinite;
}

.review .ico {
  background: var(--lime);
  color: #15200a;
}

.review .eyebrow {
  color: var(--lime);
}

.learn {
  background: linear-gradient(135deg, #3b2a7a, #2a2a62 60%, var(--panel));
  border-color: rgba(139, 92, 246, 0.4);
}

.learn .ico {
  background: var(--violet);
  color: #fff;
}

.tiles {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.tile {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 22px 26px;
  font-size: 1.2rem;
  font-weight: 900;
  color: var(--text);
  transition: transform 0.15s;
}

.tile:hover {
  transform: translateY(-3px);
}

.tile svg {
  color: var(--sky);
}

@media (max-width: 720px) {
  .stats,
  .tiles {
    grid-template-columns: 1fr;
  }
}
</style>
