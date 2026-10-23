<script setup lang="ts">
import { onMounted } from "vue";
import { RouterLink, RouterView } from "vue-router";
import { BookOpen, Flame, House, Map, Zap } from "@lucide/vue";
import { level, loadProfile, pops, profile } from "./store";
import { accent, type Accent } from "./speech";

const ACCENTS: Accent[] = ["us", "uk"];

onMounted(loadProfile);
</script>

<template>
  <header class="top">
    <RouterLink to="/" class="logo">
      <span class="ur mark">لفظ</span>
      <span class="name">lafz</span>
    </RouterLink>

    <nav class="nav">
      <RouterLink to="/" exact-active-class="on"><House :size="18" /> Home</RouterLink>
      <RouterLink to="/world" active-class="on"><Map :size="18" /> Map</RouterLink>
      <RouterLink to="/words" active-class="on"><BookOpen :size="18" /> Words</RouterLink>
    </nav>

    <div class="stats">
      <div class="stat accent" role="group" aria-label="Pronunciation">
        <button
          v-for="a in ACCENTS"
          :key="a"
          :class="{ on: accent === a }"
          :aria-pressed="accent === a"
          :title="a === 'us' ? 'American pronunciation' : 'British pronunciation'"
          @click="accent = a"
        >
          {{ a.toUpperCase() }}
        </button>
      </div>
      <div class="stat streak" :class="{ hot: profile.streak > 0 }" title="Daily streak">
        <Flame :size="20" />
        <b>{{ profile.streak }}</b>
      </div>
      <div class="stat xp" title="XP">
        <Zap :size="18" />
        <b>Lv {{ level.n }}</b>
        <span class="bar mini"><i :style="{ width: level.pct + '%' }" /></span>
        <span class="pops">
          <span v-for="p in pops" :key="p.id" class="xp-pop">{{ p.text }}</span>
        </span>
      </div>
    </div>
  </header>

  <RouterView v-slot="{ Component, route }">
    <Transition name="fade" mode="out-in">
      <component :is="Component" :key="route.path" />
    </Transition>
  </RouterView>
</template>

<style scoped>
.top {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 12px 24px;
  background: rgba(18, 18, 43, 0.75);
  backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--line);
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 900;
  font-size: 1.3rem;
}

.mark {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: var(--violet);
  color: #fff;
  font-size: 1.15rem;
  line-height: 1;
  padding-top: 6px;
  box-shadow: 0 4px 0 var(--violet-d);
}

.nav {
  display: flex;
  gap: 4px;
  margin-left: 8px;
}

.nav a {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 8px 14px;
  border-radius: 999px;
  color: var(--muted);
  font-weight: 800;
  transition: 0.15s;
}

.nav a:hover {
  color: var(--text);
  background: rgba(255, 255, 255, 0.06);
}

.nav a.on {
  color: #fff;
  background: rgba(139, 92, 246, 0.35);
}

.stats {
  margin-left: auto;
  display: flex;
  gap: 10px;
}

.stat {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 8px 14px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.07);
  font-weight: 900;
}

.accent {
  gap: 2px;
  padding: 4px;
}

.accent button {
  padding: 4px 10px;
  border: 0;
  border-radius: 999px;
  background: none;
  color: var(--muted);
  font: inherit;
  font-size: 0.8rem;
  cursor: pointer;
  transition: 0.15s;
}

.accent button.on {
  background: var(--violet);
  color: #fff;
}

.streak {
  color: var(--muted);
}

.streak.hot {
  color: var(--amber);
  background: rgba(251, 191, 36, 0.14);
}

.streak.hot svg {
  animation: flicker 1.2s ease-in-out infinite;
  fill: rgba(251, 191, 36, 0.35);
}

.xp {
  color: var(--violet-2);
  background: rgba(139, 92, 246, 0.16);
}

.bar.mini {
  width: 90px;
  height: 8px;
}

.pops {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.xp-pop {
  position: absolute;
  left: 50%;
  top: 0;
  transform: translateX(-50%);
  white-space: nowrap;
  color: var(--lime);
  font-size: 1.1rem;
  font-weight: 900;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
  animation: float-up 1.3s ease-out forwards;
}

@media (max-width: 720px) {
  .top {
    gap: 12px;
    padding: 10px 16px;
  }
  .name,
  .nav a span {
    display: none;
  }
  .bar.mini {
    display: none;
  }
}
</style>
