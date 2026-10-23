import { ref, watch } from "vue";
import { useLocalStorage } from "@vueuse/core";

export type Accent = "us" | "uk";
export const accent = useLocalStorage<Accent>("lafz:accent", "us");

const speaking = ref(false);
const ok = typeof window !== "undefined" && "speechSynthesis" in window;
let voice: SpeechSynthesisVoice | undefined;

function pickVoice() {
  const vs = speechSynthesis.getVoices();
  const lang = accent.value === "us" ? "en-us" : "en-gb";
  const match = vs.filter((v) => v.lang.replace("_", "-").toLowerCase() === lang);
  voice =
    match.find((v) => /google|samantha|daniel|libby|sonia/i.test(v.name)) ??
    match[0] ??
    vs.find((v) => v.lang.toLowerCase().startsWith("en"));
}

if (ok) {
  pickVoice();
  speechSynthesis.addEventListener("voiceschanged", pickVoice);
  watch(accent, pickVoice);
}

const audio = typeof Audio !== "undefined" ? new Audio() : undefined;
if (audio) {
  audio.onplaying = () => (speaking.value = true);
  audio.onended = audio.onpause = () => (speaking.value = false);
}

/** Browser TTS, slowed a little so a beginner can hear every sound. */
function speak(text: string, rate = 0.85) {
  if (!ok || !text) return;
  audio?.pause();
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  if (voice) u.voice = voice;
  u.lang = voice?.lang ?? (accent.value === "us" ? "en-US" : "en-GB");
  u.rate = rate;
  u.onstart = () => (speaking.value = true);
  u.onend = u.onerror = () => (speaking.value = false);
  speechSynthesis.speak(u);
}

/** A real Cambridge recording in the chosen accent; browser TTS when there isn't one. */
function playWord(w: { id: number; word: string }) {
  if (!audio) return speak(w.word);
  if (ok) speechSynthesis.cancel();
  audio.src = `/api/audio/${w.id}/${accent.value}`;
  // AbortError just means a newer play() replaced this one
  audio.play().catch((e: DOMException) => e.name !== "AbortError" && speak(w.word));
}

export function useSpeech() {
  const stop = () => {
    audio?.pause();
    if (ok) speechSynthesis.cancel();
  };
  return { speak, playWord, stop, speaking };
}
