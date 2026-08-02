/* =============================================================
 * Sonido sintetizado con Web Audio API (sin archivos externos).
 * Blips cortos y originales. Respeta la preferencia de sonido.
 * Si Web Audio no está disponible, no hace nada (no bloquea).
 * ============================================================= */
import { loadSettings } from './settings';

export type SoundName =
  | 'deal'
  | 'play'
  | 'trick'
  | 'truco'
  | 'envido'
  | 'flor'
  | 'win'
  | 'lose';

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  return ctx;
}

interface Tone {
  freq: number;
  dur: number;
  type?: OscillatorType;
  delay?: number;
}

const RECIPES: Record<SoundName, Tone[]> = {
  deal: [{ freq: 320, dur: 0.06, type: 'triangle' }],
  play: [{ freq: 440, dur: 0.07, type: 'triangle' }],
  trick: [{ freq: 520, dur: 0.08 }, { freq: 660, dur: 0.09, delay: 0.07 }],
  truco: [{ freq: 300, dur: 0.12, type: 'sawtooth' }, { freq: 400, dur: 0.14, delay: 0.1, type: 'sawtooth' }],
  envido: [{ freq: 500, dur: 0.1 }, { freq: 620, dur: 0.1, delay: 0.09 }],
  flor: [{ freq: 560, dur: 0.09 }, { freq: 700, dur: 0.09, delay: 0.08 }, { freq: 840, dur: 0.11, delay: 0.16 }],
  win: [{ freq: 523, dur: 0.12 }, { freq: 659, dur: 0.12, delay: 0.12 }, { freq: 784, dur: 0.18, delay: 0.24 }],
  lose: [{ freq: 400, dur: 0.16, type: 'sawtooth' }, { freq: 300, dur: 0.22, delay: 0.14, type: 'sawtooth' }],
};

export function playSound(name: SoundName): void {
  if (!loadSettings().sound) return;
  const audio = getCtx();
  if (!audio) return;
  if (audio.state === 'suspended') void audio.resume();

  const now = audio.currentTime;
  for (const tone of RECIPES[name]) {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    const start = now + (tone.delay ?? 0);
    osc.type = tone.type ?? 'sine';
    osc.frequency.value = tone.freq;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.16, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + tone.dur);
    osc.connect(gain).connect(audio.destination);
    osc.start(start);
    osc.stop(start + tone.dur + 0.02);
  }
}
