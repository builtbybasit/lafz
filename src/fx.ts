// Tiny feedback layer: WebAudio blips + confetti, both silent under prefers-reduced-motion.
import confetti from "canvas-confetti";

export const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

let ctx: AudioContext | undefined;
function tone(freq: number, at: number, dur: number, type: OscillatorType = "sine", gain = 0.12) {
  ctx ??= new AudioContext();
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(gain, ctx.currentTime + at);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + dur);
  o.connect(g).connect(ctx.destination);
  o.start(ctx.currentTime + at);
  o.stop(ctx.currentTime + at + dur);
}

export function sfx(kind: "ok" | "bad" | "win" | "tap") {
  try {
    if (kind === "ok") {
      tone(660, 0, 0.12);
      tone(990, 0.1, 0.18);
    } else if (kind === "bad") tone(160, 0, 0.25, "square", 0.08);
    else if (kind === "tap") tone(520, 0, 0.05, "triangle", 0.05);
    else [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.22));
  } catch {
    /* no audio */
  }
}

export function celebrate(big = false) {
  if (reducedMotion()) return;
  const colors = ["#8b5cf6", "#a3e635", "#fbbf24", "#fb7185", "#38bdf8"];
  void confetti({
    particleCount: big ? 160 : 70,
    spread: big ? 100 : 70,
    origin: { y: 0.6 },
    colors,
  });
  if (big) {
    setTimeout(
      () => void confetti({ particleCount: 60, angle: 60, spread: 60, origin: { x: 0 }, colors }),
      250,
    );
    setTimeout(
      () => void confetti({ particleCount: 60, angle: 120, spread: 60, origin: { x: 1 }, colors }),
      400,
    );
  }
}
