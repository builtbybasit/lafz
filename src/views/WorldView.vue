<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { Check, Lock, Star } from "@lucide/vue";
import { api, type Level, type World } from "@/api";

const route = useRoute();
const router = useRouter();
const worlds = ref<World[]>([]);
onMounted(async () => (worlds.value = await api.worlds()));

const level = computed(() => (route.params.level as Level) || "A1");
const world = computed(() => worlds.value.find((w) => w.level === level.value));
const packs = computed(() => world.value?.packs ?? []);
const current = computed(() => packs.value.find((p) => !p.locked && p.stars === 0)?.id);

// winding path geometry
const W = 560;
const ROW = 124;
const x = (i: number) => W / 2 + Math.sin(i * 1.05) * 160;
const y = (i: number) => i * ROW + 70;
const height = computed(() => packs.value.length * ROW + 40);
const trail = computed(() =>
  packs.value
    .map((_, i) =>
      i === 0
        ? `M ${x(0)} ${y(0)}`
        : `C ${x(i - 1)} ${y(i - 1) + ROW / 2}, ${x(i)} ${y(i) - ROW / 2}, ${x(i)} ${y(i)}`,
    )
    .join(" "),
);
const done = (w: World) => w.packs.filter((p) => p.stars > 0).length;
</script>

<template>
  <div class="page world">
    <nav class="tabs">
      <RouterLink
        v-for="(w, i) in worlds"
        :key="w.level"
        :to="`/world/${w.level}`"
        class="card tab"
        :class="{ on: w.level === level, locked: w.packs[0]?.locked }"
      >
        <span class="eyebrow">World {{ i + 1 }} · {{ w.level }}</span>
        <b>{{ w.title }}</b>
        <span class="muted">{{ done(w) }} / {{ w.packs.length }} packs</span>
        <Lock v-if="w.packs[0]?.locked" class="lk" :size="18" />
      </RouterLink>
    </nav>

    <div class="map" :style="{ height: height + 'px', width: W + 'px' }">
      <svg
        class="trail"
        :viewBox="`0 0 ${W} ${height}`"
        :width="W"
        :height="height"
        aria-hidden="true"
      >
        <path :d="trail" />
      </svg>

      <div
        v-for="(p, i) in packs"
        :key="p.id"
        class="stop rise"
        :class="{
          locked: p.locked,
          done: p.stars > 0,
          current: p.id === current,
          flip: x(i) > W / 2,
        }"
        :style="{ left: x(i) + 'px', top: y(i) + 'px', animationDelay: i * 40 + 'ms' }"
      >
        <button
          class="node"
          :disabled="p.locked"
          :aria-label="`Pack ${p.index + 1}: ${p.title}`"
          @click="router.push(`/pack/${p.id}`)"
        >
          <Lock v-if="p.locked" :size="26" />
          <Check v-else-if="p.stars === 3" :size="34" stroke-width="3" />
          <span v-else>{{ p.index + 1 }}</span>
        </button>
        <div class="stars">
          <Star v-for="s in 3" :key="s" :size="18" :class="{ lit: s <= p.stars }" />
        </div>
        <div class="label">
          <b>{{ p.title }}</b>
          <span class="muted">
            Pack {{ p.index + 1
            }}<template v-if="p.learned"> · {{ p.learned }}/{{ p.total }} words</template>
          </span>
        </div>
        <span v-if="p.id === current" class="tag">START</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.world {
  display: grid;
  gap: 36px;
  justify-items: center;
}

.tabs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  width: 100%;
}

.tab {
  position: relative;
  display: grid;
  gap: 2px;
  padding: 16px 20px;
  opacity: 0.75;
  transition: 0.15s;
}

.tab b {
  font-size: 1.25rem;
  font-weight: 900;
}

.tab.on {
  opacity: 1;
  border-color: var(--violet-2);
  box-shadow:
    0 0 0 3px rgba(139, 92, 246, 0.35),
    var(--shadow);
}

.tab.locked {
  opacity: 0.45;
}

.lk {
  position: absolute;
  top: 16px;
  right: 16px;
  color: var(--muted);
}

.map {
  position: relative;
  max-width: 100%;
}

.trail {
  position: absolute;
  inset: 0;
}

.trail path {
  fill: none;
  stroke: rgba(255, 255, 255, 0.18);
  stroke-width: 12;
  stroke-linecap: round;
  stroke-dasharray: 2 24;
}

.stop {
  position: absolute;
  transform: translate(-50%, -50%);
  display: grid;
  justify-items: center;
  gap: 6px;
}

.node {
  position: relative;
  display: grid;
  place-items: center;
  width: 84px;
  height: 84px;
  border-radius: 50%;
  font-size: 2rem;
  font-weight: 900;
  color: #fff;
  background: radial-gradient(
    circle at 30% 30%,
    var(--violet-2),
    var(--violet) 55%,
    var(--violet-d)
  );
  box-shadow:
    0 7px 0 var(--violet-d),
    0 12px 30px rgba(0, 0, 0, 0.4);
  transition: transform 0.1s;
}

.node:hover:not(:disabled) {
  transform: scale(1.06);
}

.node:active:not(:disabled) {
  transform: translateY(5px);
  box-shadow:
    0 2px 0 var(--violet-d),
    0 8px 20px rgba(0, 0, 0, 0.4);
}

.done .node {
  background: radial-gradient(circle at 30% 30%, #ffe08a, var(--amber) 55%, #c98a0a);
  box-shadow:
    0 7px 0 #a8720a,
    0 12px 30px rgba(251, 191, 36, 0.35);
  color: #4a3000;
}

.locked .node {
  background: radial-gradient(circle at 30% 30%, #3b3b6d, #2a2a56 60%, #1c1c3e);
  box-shadow: 0 7px 0 #141430;
  color: var(--muted);
}

.current .node {
  animation: pulse-ring 1.4s ease-out infinite;
}

.stars {
  display: flex;
  gap: 2px;
  color: rgba(255, 255, 255, 0.18);
}

.stars .lit {
  color: var(--amber);
  fill: var(--amber);
  filter: drop-shadow(0 0 6px rgba(251, 191, 36, 0.6));
}

.label {
  position: absolute;
  top: 18px;
  left: calc(100% + 16px);
  display: grid;
  white-space: nowrap;
  text-align: left;
}

.flip .label {
  left: auto;
  right: calc(100% + 16px);
  text-align: right;
}

.label b {
  font-size: 1.1rem;
  font-weight: 900;
}

.locked .label {
  opacity: 0.5;
}

.tag {
  position: absolute;
  top: -22px;
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--lime);
  color: #15200a;
  font-size: 0.72rem;
  font-weight: 900;
  letter-spacing: 0.12em;
  animation: flicker 1.6s ease-in-out infinite;
}

@media (max-width: 720px) {
  .tabs {
    grid-template-columns: 1fr;
  }
  .label {
    display: none;
  }
}
</style>
