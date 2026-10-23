<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { useEventListener, useStorage } from "@vueuse/core";
import { Check, Eye, EyeOff, Volume2, X } from "@lucide/vue";
import { mainSense } from "@/api";
import type { Question } from "@/game";
import { sfx } from "@/fx";
import { useSpeech } from "@/speech";

const props = defineProps<{ q: Question }>();
const emit = defineEmits<{ answer: [correct: boolean]; next: [] }>();

const { playWord, speaking } = useSpeech();
const urHint = useStorage("lafz:ur-hint", true);

const picked = ref<number | null>(null);
const typed = ref("");
const result = ref<boolean | null>(null);
const input = ref<HTMLInputElement>();

const sense = computed(() => mainSense(props.q.word));
const hasAudio = computed(() => props.q.type === "listen" || props.q.type === "spell");
const label = computed(
  () =>
    ({
      listen: "Listen and pick the word",
      meaning: "Which word means this?",
      blank: "Fill the gap",
      spell: "Listen and type the word",
    })[props.q.type],
);

const say = () => playWord(props.q.word);

function finish(ok: boolean) {
  result.value = ok;
  sfx(ok ? "ok" : "bad");
  emit("answer", ok);
  if (props.q.type !== "listen") setTimeout(say, 350);
}

function choose(i: number) {
  if (result.value !== null || !props.q.options[i]) return;
  picked.value = i;
  finish(props.q.options[i].id === props.q.word.id);
}

function submit() {
  if (result.value !== null || !typed.value.trim()) return;
  finish(typed.value.trim().toLowerCase() === props.q.word.word.toLowerCase());
}

watch(
  () => props.q,
  async () => {
    picked.value = null;
    typed.value = "";
    result.value = null;
    if (hasAudio.value) setTimeout(say, 300);
    await nextTick();
    input.value?.focus();
  },
  { immediate: true },
);

useEventListener(window, "keydown", (e: KeyboardEvent) => {
  const typing = e.target instanceof HTMLInputElement;
  if (e.key === "Enter") {
    e.preventDefault();
    if (result.value !== null) emit("next");
    else if (props.q.type === "spell") submit();
    return;
  }
  if (typing) return;
  if (e.key === " ") {
    e.preventDefault();
    say();
  } else if (result.value === null && /^[1-4]$/.test(e.key)) choose(Number(e.key) - 1);
});
</script>

<template>
  <section class="q rise">
    <p class="eyebrow">{{ label }}<span v-if="q.retry" class="retry"> · try again</span></p>

    <!-- prompt -->
    <div class="prompt" :class="q.type">
      <template v-if="hasAudio">
        <button class="speak xl" :class="{ on: speaking }" aria-label="Play word" @click="say">
          <Volume2 :size="52" />
        </button>
        <p class="muted tip">Space to hear it again</p>
      </template>

      <template v-else-if="q.type === 'meaning'">
        <p v-if="sense.phrase" class="phrase">{{ sense.phrase }}</p>
        <p class="def">{{ sense.def }}</p>
        <button class="hint" @click="urHint = !urHint">
          <component :is="urHint ? EyeOff : Eye" :size="16" />
          {{ urHint ? "Hide" : "Show" }} Urdu
        </button>
        <p v-if="urHint && q.word.ur" class="ur hint-ur pop">{{ q.word.ur }}</p>
      </template>

      <template v-else-if="q.blank">
        <p class="sentence">
          {{ q.blank.before
          }}<span
            class="gap"
            :class="{ filled: result !== null, good: result, bad: result === false }"
            >{{ result !== null ? q.blank.match : "____" }}</span
          >{{ q.blank.after }}
        </p>
        <p v-if="urHint && q.word.ur" class="ur hint-ur">{{ q.word.ur }}</p>
      </template>
    </div>

    <!-- answers -->
    <div v-if="q.options.length" class="options">
      <button
        v-for="(o, i) in q.options"
        :key="o.id"
        class="opt"
        :class="{
          correct: result !== null && o.id === q.word.id,
          wrong: result === false && picked === i,
          dim: result !== null && o.id !== q.word.id && picked !== i,
        }"
        :disabled="result !== null"
        @click="choose(i)"
      >
        <kbd>{{ i + 1 }}</kbd>
        <span class="w">{{ o.word }}</span>
        <Check v-if="result !== null && o.id === q.word.id" :size="22" />
        <X v-else-if="result === false && picked === i" :size="22" />
      </button>
    </div>

    <form v-else class="spell" @submit.prevent="submit">
      <input
        ref="input"
        v-model="typed"
        :class="{ good: result, bad: result === false }"
        :disabled="result !== null"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        placeholder="Type the word…"
        aria-label="Type the word you hear"
      />
      <button class="btn" type="submit" :disabled="result !== null || !typed.trim()">Check</button>
      <p class="muted letters">
        {{ q.word.word.length }} letters · starts with <b>{{ q.word.word[0] }}</b>
      </p>
    </form>

    <!-- verdict: teleported so position: fixed isn't trapped by the animated (transformed) ancestors -->
    <Teleport to="body">
      <Transition name="fade">
        <footer v-if="result !== null" class="verdict" :class="result ? 'good' : 'bad'">
          <div class="vtext">
            <b>{{ result ? "Correct!" : "Not quite" }}</b>
            <span class="answer">
              {{ q.word.word }} <span v-if="q.word.ur" class="ur">{{ q.word.ur }}</span>
            </span>
            <span v-if="!result || q.type === 'listen' || q.type === 'spell'" class="muted">{{
              sense.def
            }}</span>
          </div>
          <button class="btn" :class="result ? 'btn-lime' : 'btn-coral'" @click="emit('next')">
            Continue <kbd>↵</kbd>
          </button>
        </footer>
      </Transition>
    </Teleport>
  </section>
</template>

<style scoped>
.q {
  display: grid;
  gap: 26px;
  justify-items: center;
  text-align: center;
  padding-bottom: 120px;
}

.retry {
  color: var(--amber);
}

.prompt {
  display: grid;
  justify-items: center;
  gap: 12px;
  min-height: 150px;
  align-content: center;
}

.tip {
  font-size: 0.85rem;
}

.phrase {
  color: var(--violet-2);
  font-size: 1.3rem;
  font-weight: 900;
}

.def {
  font-size: clamp(1.4rem, 3vw, 1.9rem);
  font-weight: 800;
  max-width: 640px;
  line-height: 1.3;
}

.hint {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 800;
  color: var(--muted);
  background: rgba(255, 255, 255, 0.08);
}

.hint-ur {
  font-size: 1.7rem;
  color: var(--amber);
}

.sentence {
  font-size: clamp(1.4rem, 3vw, 1.9rem);
  font-weight: 800;
  max-width: 680px;
  line-height: 1.5;
}

.gap {
  display: inline-block;
  min-width: 90px;
  padding: 0 10px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.1);
  color: var(--sky);
  letter-spacing: 0.1em;
}

.gap.filled {
  letter-spacing: 0;
}

.gap.good {
  background: rgba(52, 211, 153, 0.2);
  color: var(--green);
}

.gap.bad {
  background: rgba(251, 113, 133, 0.2);
  color: var(--coral);
}

.options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  width: min(640px, 100%);
}

.opt {
  position: relative;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 20px;
  border-radius: 18px;
  background: var(--panel-2);
  border: 2px solid var(--line);
  box-shadow: 0 5px 0 rgba(0, 0, 0, 0.35);
  font-size: 1.35rem;
  font-weight: 900;
  text-align: left;
  transition:
    transform 0.08s,
    box-shadow 0.08s,
    background 0.15s,
    border-color 0.15s;
}

.opt:hover:not(:disabled) {
  border-color: var(--violet-2);
  background: #343476;
}

.opt:active:not(:disabled) {
  transform: translateY(4px);
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.35);
}

.opt kbd {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 9px;
  font: inherit;
  font-size: 0.9rem;
  color: var(--muted);
  background: rgba(0, 0, 0, 0.3);
}

.opt .w {
  flex: 1;
}

.opt.correct {
  background: rgba(52, 211, 153, 0.22);
  border-color: var(--green);
  color: var(--green);
  animation: pop 0.4s cubic-bezier(0.2, 0.9, 0.3, 1.3);
}

.opt.wrong {
  background: rgba(251, 113, 133, 0.2);
  border-color: var(--coral);
  color: var(--coral);
  animation: shake 0.4s ease;
}

.opt.dim {
  opacity: 0.4;
}

.spell {
  display: grid;
  gap: 12px;
  justify-items: center;
  width: min(480px, 100%);
}

.spell input {
  width: 100%;
  padding: 18px 20px;
  border-radius: 18px;
  border: 2px solid var(--line);
  background: var(--panel-2);
  font-size: 1.6rem;
  font-weight: 900;
  text-align: center;
  letter-spacing: 0.08em;
  box-shadow: inset 0 3px 8px rgba(0, 0, 0, 0.3);
}

.spell input:focus {
  outline: none;
  border-color: var(--violet-2);
}

.spell input.good {
  border-color: var(--green);
  color: var(--green);
}

.spell input.bad {
  border-color: var(--coral);
  color: var(--coral);
  animation: shake 0.4s ease;
}

.letters {
  font-size: 0.9rem;
}

.verdict {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 18px max(24px, calc((100% - 760px) / 2));
  text-align: left;
  border-top: 3px solid;
}

.verdict.good {
  background: #13331f;
  border-color: var(--green);
  color: var(--green);
}

.verdict.bad {
  background: #3a1722;
  border-color: var(--coral);
  color: var(--coral);
}

.vtext {
  display: grid;
  gap: 2px;
}

.vtext b {
  font-size: 1.3rem;
  font-weight: 900;
}

.answer {
  color: var(--text);
  font-size: 1.1rem;
  font-weight: 800;
}

.answer .ur {
  color: var(--amber);
  margin-inline-start: 8px;
}

.verdict kbd {
  font: inherit;
  opacity: 0.6;
}
</style>
