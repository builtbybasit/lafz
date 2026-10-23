import { computed, ref } from "vue";
import { api, type Profile } from "./api";
import { celebrate, sfx } from "./fx";

export const profile = ref<Profile>({ xp: 0, streak: 0, lastPlayed: null, learned: 0, due: 0 });
export const pops = ref<{ id: number; text: string }[]>([]);

const XP_PER_LEVEL = 100;
export const level = computed(() => ({
  n: Math.floor(profile.value.xp / XP_PER_LEVEL) + 1,
  pct: profile.value.xp % XP_PER_LEVEL,
  need: XP_PER_LEVEL,
}));

export async function loadProfile() {
  profile.value = await api.profile();
}

let seq = 0;
export function pop(text: string) {
  const id = ++seq;
  pops.value.push({ id, text });
  setTimeout(() => (pops.value = pops.value.filter((p) => p.id !== id)), 1300);
}

/** Apply a new XP total from the server; shows "+N XP" and celebrates level-ups. */
export function setXp(total: number) {
  const before = level.value.n;
  const gained = total - profile.value.xp;
  profile.value.xp = total;
  if (gained > 0) pop(`+${gained} XP`);
  if (level.value.n > before) {
    pop(`Level ${level.value.n}!`);
    sfx("win");
    celebrate(true);
  }
}
