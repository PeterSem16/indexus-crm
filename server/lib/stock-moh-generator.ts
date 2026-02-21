import fs from "fs";
import path from "path";

export interface StockMohOption {
  id: string;
  name: string;
  description: string;
  style: string;
  durationSeconds: number;
}

export const STOCK_MOH_OPTIONS: StockMohOption[] = [
  {
    id: "classical-gentle",
    name: "Classical Gentle",
    description: "Rich piano arpeggios with lush string ensemble, counterpoint melodies, and warm orchestral pads",
    style: "classical",
    durationSeconds: 60,
  },
  {
    id: "ambient-calm",
    name: "Ambient Calm",
    description: "Deep evolving ambient textures with layered drones, granular shimmer, and ethereal vocal pads",
    style: "ambient",
    durationSeconds: 60,
  },
  {
    id: "corporate-professional",
    name: "Corporate Professional",
    description: "Polished modern soundscape with Rhodes chords, fingerstyle bass, layered pads, and subtle percussion",
    style: "corporate",
    durationSeconds: 60,
  },
  {
    id: "jazz-lounge",
    name: "Jazz Lounge",
    description: "Smooth jazz with rich extended chords, walking bass, improvised melody, and brushed drums",
    style: "jazz",
    durationSeconds: 60,
  },
  {
    id: "elevator-light",
    name: "Bossa Nova Light",
    description: "Warm bossa nova with nylon guitar voicings, gentle bass, flute-like melodies, and Latin percussion",
    style: "elevator",
    durationSeconds: 60,
  },
  {
    id: "nature-zen",
    name: "Zen Garden",
    description: "Deep meditative soundscape with singing bowls, koto-like plucks, layered drones, and wind textures",
    style: "zen",
    durationSeconds: 60,
  },
];

const SR = 44100;

function sine(freq: number, t: number): number {
  return Math.sin(2 * Math.PI * freq * t);
}

function triangle(freq: number, t: number): number {
  const p = (freq * t) % 1;
  return 4 * Math.abs(p - 0.5) - 1;
}

function softSquare(freq: number, t: number): number {
  return Math.tanh(2.5 * sine(freq, t));
}

function saw(freq: number, t: number): number {
  const p = (freq * t) % 1;
  return 2 * p - 1;
}

function noise(): number {
  return Math.random() * 2 - 1;
}

function lowPassFilter(samples: number[], cutoffHz: number): number[] {
  const rc = 1 / (2 * Math.PI * cutoffHz);
  const dt = 1 / SR;
  const alpha = dt / (rc + dt);
  const out = new Float64Array(samples.length);
  out[0] = samples[0];
  for (let i = 1; i < samples.length; i++) {
    out[i] = out[i - 1] + alpha * (samples[i] - out[i - 1]);
  }
  return Array.from(out);
}

function highPassFilter(samples: number[], cutoffHz: number): number[] {
  const rc = 1 / (2 * Math.PI * cutoffHz);
  const dt = 1 / SR;
  const alpha = rc / (rc + dt);
  const out = new Float64Array(samples.length);
  out[0] = samples[0];
  for (let i = 1; i < samples.length; i++) {
    out[i] = alpha * (out[i - 1] + samples[i] - samples[i - 1]);
  }
  return Array.from(out);
}

function addReverb(samples: number[], decay: number = 0.3, delayMs: number = 80): number[] {
  const delaySamples = Math.floor(SR * delayMs / 1000);
  const delays = [
    delaySamples,
    Math.floor(delaySamples * 1.37),
    Math.floor(delaySamples * 1.73),
    Math.floor(delaySamples * 2.11),
    Math.floor(delaySamples * 2.67),
    Math.floor(delaySamples * 3.19),
  ];
  const gains = [decay, decay * 0.7, decay * 0.5, decay * 0.35, decay * 0.22, decay * 0.14];
  const out = new Float64Array(samples.length);
  for (let i = 0; i < samples.length; i++) out[i] = samples[i];
  for (let d = 0; d < delays.length; d++) {
    for (let i = 0; i < samples.length; i++) {
      const idx = i + delays[d];
      if (idx < out.length) out[idx] += samples[i] * gains[d];
    }
  }
  return Array.from(out);
}

function fadeInOut(samples: number[], fadeInSec: number, fadeOutSec: number): number[] {
  const fadeInSamples = Math.floor(SR * fadeInSec);
  const fadeOutSamples = Math.floor(SR * fadeOutSec);
  const out = new Float64Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    let gain = 1;
    if (i < fadeInSamples) gain = i / fadeInSamples;
    if (i > samples.length - fadeOutSamples) gain = (samples.length - i) / fadeOutSamples;
    out[i] = samples[i] * gain;
  }
  return Array.from(out);
}

function mixInto(target: Float64Array, source: number[], offset: number): void {
  for (let i = 0; i < source.length && offset + i < target.length; i++) {
    target[offset + i] += source[i];
  }
}

function normalize(samples: number[], peak: number = 0.85): number[] {
  let maxAbs = 0;
  for (let i = 0; i < samples.length; i++) {
    const a = Math.abs(samples[i]);
    if (a > maxAbs) maxAbs = a;
  }
  if (maxAbs === 0) return samples;
  const scale = peak / maxAbs;
  const out = new Float64Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    out[i] = samples[i] * scale;
  }
  return Array.from(out);
}

const NOTE_FREQS: Record<string, number> = {
  "C2": 65.41, "D2": 73.42, "Eb2": 77.78, "E2": 82.41, "F2": 87.31, "F#2": 92.50, "G2": 98.00, "Ab2": 103.83, "A2": 110.00, "Bb2": 116.54, "B2": 123.47,
  "C3": 130.81, "C#3": 138.59, "D3": 146.83, "Eb3": 155.56, "E3": 164.81, "F3": 174.61, "F#3": 185.00, "G3": 196.00, "Ab3": 207.65, "A3": 220.00, "Bb3": 233.08, "B3": 246.94,
  "C4": 261.63, "C#4": 277.18, "D4": 293.66, "Eb4": 311.13, "E4": 329.63, "F4": 349.23, "F#4": 369.99, "G4": 392.00, "Ab4": 415.30, "A4": 440.00, "Bb4": 466.16, "B4": 493.88,
  "C5": 523.25, "C#5": 554.37, "D5": 587.33, "Eb5": 622.25, "E5": 659.26, "F5": 698.46, "F#5": 739.99, "G5": 783.99, "Ab5": 830.61, "A5": 880.00, "Bb5": 932.33, "B5": 987.77,
  "C6": 1046.50, "D6": 1174.66, "E6": 1318.51, "F6": 1396.91, "G6": 1567.98, "A6": 1760.00,
};

function n(note: string): number { return NOTE_FREQS[note] || 440; }

function pianoTone(freq: number, duration: number, velocity: number = 0.5): number[] {
  const len = Math.floor(SR * duration);
  const out = new Float64Array(len);
  const harmonics = [1, 2, 3, 4, 5, 6, 7, 8, 10, 12];
  const hGains = [1, 0.55, 0.35, 0.18, 0.1, 0.06, 0.035, 0.02, 0.008, 0.004];
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const attack = 1 - Math.exp(-t * 50);
    const decay = 0.4 * Math.exp(-t * 1.2) + 0.6 * Math.exp(-t * 4);
    const env = attack * decay * velocity;
    let sample = 0;
    for (let h = 0; h < harmonics.length; h++) {
      const hFreq = freq * harmonics[h];
      if (hFreq > SR / 2) break;
      const hDecay = Math.exp(-t * (1 + h * 0.6));
      const inharmonicity = 1 + 0.0003 * h * h;
      sample += sine(hFreq * inharmonicity, t) * hGains[h] * hDecay;
    }
    const hammer = Math.exp(-t * 80) * 0.15 * noise();
    out[i] = (sample + hammer) * env;
  }
  return Array.from(out);
}

function rhodesTone(freq: number, duration: number, velocity: number = 0.4): number[] {
  const len = Math.floor(SR * duration);
  const out = new Float64Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const attack = 1 - Math.exp(-t * 35);
    const decay = 0.3 * Math.exp(-t * 0.8) + 0.7 * Math.exp(-t * 2.5);
    const env = attack * decay * velocity;
    const modIndex = 4 * Math.exp(-t * 2.5) + 0.5;
    const mod = sine(freq * 14, t) * modIndex;
    const carrier = sine(freq + mod, t);
    const bell = sine(freq * 3, t) * 0.18 * Math.exp(-t * 5);
    const sub = sine(freq * 0.5, t) * 0.12 * Math.exp(-t * 1.5);
    const warmth = sine(freq * 2, t) * 0.08 * Math.exp(-t * 3);
    out[i] = (carrier + bell + sub + warmth) * env;
  }
  return Array.from(out);
}

function warmPad(freq: number, duration: number, volume: number = 0.15): number[] {
  const len = Math.floor(SR * duration);
  const out = new Float64Array(len);
  const voices = [0, 0.004, -0.004, 0.007, -0.007, 0.002, -0.002];
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const env = Math.min(t / 1.2, 1) * Math.min((duration - t) / 1.2, 1);
    let sample = 0;
    for (const d of voices) {
      const f = freq * (1 + d);
      const lfo = 1 + 0.004 * sine(4.8 + d * 100, t);
      sample += sine(f * lfo, t) * 0.4;
      sample += triangle(f * lfo, t) * 0.25;
      sample += sine(f * 2 * lfo, t) * 0.15;
      sample += sine(f * 3 * lfo, t) * 0.05;
    }
    const vibrato = 1 + 0.003 * sine(5.2, t);
    const breathe = 1 + 0.15 * sine(0.08, t);
    out[i] = (sample / voices.length) * env * volume * vibrato * breathe;
  }
  return Array.from(out);
}

function stringEnsemble(freq: number, duration: number, volume: number = 0.12): number[] {
  const len = Math.floor(SR * duration);
  const out = new Float64Array(len);
  const detunes = [-0.008, -0.005, -0.002, 0, 0.002, 0.005, 0.008];
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const env = Math.min(t / 1.5, 1) * Math.min((duration - t) / 1.0, 1);
    let sample = 0;
    for (let v = 0; v < detunes.length; v++) {
      const f = freq * (1 + detunes[v]);
      const vibRate = 5 + v * 0.3;
      const vib = 1 + 0.004 * sine(vibRate, t + v * 0.1);
      sample += saw(f * vib, t) * 0.15;
      sample += sine(f * vib, t) * 0.25;
    }
    out[i] = (sample / detunes.length) * env * volume;
  }
  const filtered = lowPassFilter(Array.from(out), 3500);
  return filtered;
}

function fluteTone(freq: number, duration: number, velocity: number = 0.3): number[] {
  const len = Math.floor(SR * duration);
  const out = new Float64Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const attack = Math.min(t / 0.12, 1);
    const decay = Math.min((duration - t) / 0.15, 1);
    const env = attack * decay * velocity;
    const vibrato = 1 + 0.006 * sine(5.5, t) * Math.min(t / 0.3, 1);
    const breath = noise() * 0.03 * env;
    const tone = sine(freq * vibrato, t) * 0.7
      + sine(freq * 2 * vibrato, t) * 0.2
      + sine(freq * 3 * vibrato, t) * 0.06
      + triangle(freq * vibrato, t) * 0.1;
    out[i] = (tone + breath) * env;
  }
  return Array.from(out);
}

function celeste(freq: number, duration: number, velocity: number = 0.25): number[] {
  const len = Math.floor(SR * duration);
  const out = new Float64Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const attack = 1 - Math.exp(-t * 60);
    const decay = Math.exp(-t * 2.5);
    const env = attack * decay * velocity;
    const mod = sine(freq * 4, t) * 2 * Math.exp(-t * 3);
    out[i] = (sine(freq + mod, t) + 0.4 * sine(freq * 2, t) * Math.exp(-t * 4)
      + 0.2 * sine(freq * 3, t) * Math.exp(-t * 6)) * env;
  }
  return Array.from(out);
}

function pluckTone(freq: number, duration: number, velocity: number = 0.4): number[] {
  const len = Math.floor(SR * duration);
  const out = new Float64Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const env = Math.exp(-t * 3.5) * velocity;
    const bright = Math.exp(-t * 6);
    out[i] = (sine(freq, t) * 0.5
      + triangle(freq, t) * 0.25 * bright
      + sine(freq * 2, t) * 0.35 * bright
      + sine(freq * 3, t) * 0.15 * bright * bright
      + sine(freq * 4, t) * 0.08 * bright * bright
      + sine(freq * 5, t) * 0.04 * bright * bright * bright
    ) * env;
  }
  return Array.from(out);
}

function bassTone(freq: number, duration: number, velocity: number = 0.3): number[] {
  const len = Math.floor(SR * duration);
  const out = new Float64Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const env = Math.min(t / 0.015, 1) * Math.exp(-t * 0.6) * velocity;
    out[i] = (sine(freq, t) * 0.6 + sine(freq * 2, t) * 0.3 + softSquare(freq, t) * 0.15 + triangle(freq, t) * 0.1) * env;
  }
  return Array.from(out);
}

function uprightBass(freq: number, duration: number, velocity: number = 0.25): number[] {
  const len = Math.floor(SR * duration);
  const out = new Float64Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const attack = 1 - Math.exp(-t * 25);
    const decay = 0.5 * Math.exp(-t * 1.0) + 0.5 * Math.exp(-t * 3);
    const env = attack * decay * velocity;
    const slide = 1 + 0.01 * Math.exp(-t * 15);
    out[i] = (sine(freq * slide, t) * 0.6
      + sine(freq * 2 * slide, t) * 0.25
      + triangle(freq * slide, t) * 0.15
      + noise() * 0.01 * Math.exp(-t * 20)
    ) * env;
  }
  return Array.from(out);
}

function singingBowl(freq: number, duration: number, velocity: number = 0.3): number[] {
  const len = Math.floor(SR * duration);
  const out = new Float64Array(len);
  const partials = [1, 2.71, 4.16, 5.43, 7.91, 10.3];
  const pGains = [1, 0.6, 0.4, 0.25, 0.15, 0.08];
  const pDecays = [0.25, 0.4, 0.7, 1.0, 1.3, 1.8];
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const attack = 1 - Math.exp(-t * 10);
    let sample = 0;
    for (let p = 0; p < partials.length; p++) {
      const pFreq = freq * partials[p];
      if (pFreq > SR / 2) break;
      const beating = 1 + 0.08 * sine(0.5 + p * 0.25, t);
      sample += sine(pFreq, t) * pGains[p] * Math.exp(-t * pDecays[p]) * beating;
    }
    out[i] = sample * attack * velocity;
  }
  return Array.from(out);
}

function kotoPluck(freq: number, duration: number, velocity: number = 0.3): number[] {
  const len = Math.floor(SR * duration);
  const out = new Float64Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const env = Math.exp(-t * 2.5) * velocity;
    const bright = Math.exp(-t * 5);
    const bend = 1 + 0.02 * Math.exp(-t * 8);
    out[i] = (sine(freq * bend, t)
      + 0.5 * sine(freq * 2 * bend, t) * bright
      + 0.3 * sine(freq * 3 * bend, t) * bright * bright
      + 0.15 * triangle(freq * bend, t) * bright
      + 0.05 * noise() * Math.exp(-t * 30)
    ) * env;
  }
  return Array.from(out);
}

function softHiHat(duration: number = 0.08, velocity: number = 0.04): number[] {
  const len = Math.floor(SR * duration);
  const out = new Float64Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    out[i] = noise() * Math.exp(-t * 40) * velocity;
  }
  return lowPassFilter(Array.from(out), 8000);
}

function brushSwirl(duration: number = 0.3, velocity: number = 0.03): number[] {
  const len = Math.floor(SR * duration);
  const out = new Float64Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const env = Math.sin(Math.PI * t / duration) * velocity;
    out[i] = noise() * env;
  }
  return lowPassFilter(Array.from(out), 5000);
}

function softKick(duration: number = 0.15, velocity: number = 0.1): number[] {
  const len = Math.floor(SR * duration);
  const out = new Float64Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const pitchEnv = 70 + 100 * Math.exp(-t * 30);
    out[i] = sine(pitchEnv, t) * Math.exp(-t * 12) * velocity;
  }
  return Array.from(out);
}

function rimClick(velocity: number = 0.04): number[] {
  const len = Math.floor(SR * 0.03);
  const out = new Float64Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    out[i] = (noise() * 0.5 + sine(1200, t) * 0.5) * Math.exp(-t * 150) * velocity;
  }
  return Array.from(out);
}

function shaker(duration: number = 0.06, velocity: number = 0.025): number[] {
  const len = Math.floor(SR * duration);
  const out = new Float64Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    out[i] = noise() * Math.exp(-t * 25) * velocity;
  }
  return highPassFilter(lowPassFilter(Array.from(out), 9000), 3000);
}

function generateClassical(duration: number): number[] {
  const total = Math.floor(SR * duration);
  const out = new Float64Array(total);

  const sections = [
    { chords: [["C4","E4","G4","B4"], ["A3","C4","E4","G4"]], bass: ["C3","A2"], arp: ["C5","E5","G5","B5","G5","E5","C5","B4"] },
    { chords: [["F3","A3","C4","E4"], ["D4","F4","A4","C5"]], bass: ["F2","D3"], arp: ["A4","C5","E5","A5","E5","C5","A4","F4"] },
    { chords: [["G3","B3","D4","F4"], ["E3","G3","B3","D4"]], bass: ["G2","E3"], arp: ["B4","D5","F5","G5","F5","D5","B4","G4"] },
    { chords: [["A3","C4","E4","G4"], ["F3","A3","C4","F4"]], bass: ["A2","F2"], arp: ["C5","E5","G5","A5","G5","E5","C5","A4"] },
    { chords: [["D4","F#4","A4","C5"], ["G3","B3","D4","G4"]], bass: ["D3","G2"], arp: ["F#5","A5","C5","D5","A4","F#4","D5","A4"] },
    { chords: [["C4","E4","G4","C5"], ["G3","B3","D4","G4"]], bass: ["C3","G2"], arp: ["E5","G5","C6","G5","E5","C5","G4","E4"] },
  ];

  const sectionDur = 4;
  const noteDur = sectionDur / 8;
  let t = 0;
  let secIdx = 0;

  while (t < duration) {
    const sec = sections[secIdx % sections.length];

    for (let ci = 0; ci < 2; ci++) {
      const chordTime = t + ci * (sectionDur / 2);
      for (const cn of sec.chords[ci]) {
        const pad = stringEnsemble(n(cn), sectionDur / 2 + 0.8, 0.06);
        mixInto(out, pad, Math.floor(chordTime * SR));
      }
      const bass = bassTone(n(sec.bass[ci]), sectionDur / 2, 0.08);
      mixInto(out, bass, Math.floor(chordTime * SR));
    }

    for (let ni = 0; ni < sec.arp.length; ni++) {
      const noteTime = t + ni * noteDur;
      if (noteTime >= duration) break;
      const vel = 0.18 + 0.06 * Math.sin(ni * 0.7 + secIdx * 0.3);
      const piano = pianoTone(n(sec.arp[ni]), noteDur * 3, vel);
      mixInto(out, piano, Math.floor(noteTime * SR));
    }

    const melodyNotes = [sec.arp[0], sec.arp[2], sec.arp[4], sec.arp[6]];
    for (let mi = 0; mi < melodyNotes.length; mi++) {
      const mTime = t + mi * (sectionDur / 4) + noteDur * 0.5;
      if (mTime >= duration) break;
      const cel = celeste(n(melodyNotes[mi]), sectionDur / 4 + 0.5, 0.08);
      mixInto(out, cel, Math.floor(mTime * SR));
    }

    t += sectionDur;
    secIdx++;
  }

  let result = Array.from(out);
  result = lowPassFilter(result, 7000);
  result = addReverb(result, 0.35, 110);
  result = fadeInOut(result, 2.5, 3.5);
  return normalize(result);
}

function generateAmbient(duration: number): number[] {
  const total = Math.floor(SR * duration);
  const out = new Float64Array(total);

  const droneChords = [
    [n("C3"), n("G3"), n("C4")],
    [n("Eb3"), n("Bb3"), n("Eb4")],
    [n("Ab3"), n("Eb4"), n("Ab4")],
    [n("F3"), n("C4"), n("F4")],
  ];
  const chordDur = duration / droneChords.length;

  for (let ci = 0; ci < droneChords.length; ci++) {
    const chord = droneChords[ci];
    const nextChord = droneChords[(ci + 1) % droneChords.length];
    const startSample = Math.floor(ci * chordDur * SR);

    for (let i = 0; i < Math.floor(chordDur * SR) && startSample + i < total; i++) {
      const t = i / SR;
      const crossfade = Math.min(t / 3, 1) * Math.min((chordDur - t) / 3, 1);
      const morphPos = t / chordDur;

      for (let fi = 0; fi < chord.length; fi++) {
        const f = chord[fi] * (1 - morphPos * 0.1) + nextChord[fi % nextChord.length] * morphPos * 0.1;
        const lfo1 = 1 + 0.003 * sine(0.07 + fi * 0.02, t);
        const lfo2 = 1 + 0.002 * sine(0.13 + fi * 0.03, t);
        const vol = 0.045 * crossfade * (1 + 0.3 * sine(0.04 + fi * 0.01, t));
        out[startSample + i] += sine(f * lfo1, t) * vol;
        out[startSample + i] += sine(f * 2 * lfo2, t) * vol * 0.2;
        out[startSample + i] += triangle(f * 0.5, t) * vol * 0.15;
      }
    }
  }

  const shimmerNotes = ["E5","G5","C6","E6","D6","B5","G5","A5","F5","Ab5","Bb5","D5"];
  let shimIdx = 0;
  for (let t = 2; t < duration - 5; t += 2.5 + Math.sin(shimIdx * 1.3) * 1.5) {
    const freq = n(shimmerNotes[shimIdx % shimmerNotes.length]);
    const len = Math.floor(SR * 5);
    for (let i = 0; i < len && Math.floor(t * SR) + i < total; i++) {
      const tt = i / SR;
      const env = Math.sin(Math.PI * tt / 5) * 0.035;
      const vibrato = 1 + 0.008 * sine(2 + shimIdx * 0.3, tt);
      const detune = 1 + 0.003 * sine(0.5, tt);
      out[Math.floor(t * SR) + i] += sine(freq * vibrato, tt) * env;
      out[Math.floor(t * SR) + i] += sine(freq * detune * 2, tt) * env * 0.15;
    }
    shimIdx++;
  }

  const padChords = [
    ["C4","E4","G4","B4"],
    ["D4","F4","Ab4","C5"],
    ["Eb4","G4","Bb4","D5"],
    ["C4","E4","Ab4","B4"],
  ];
  let chordIdx = 0;
  for (let t = 0; t < duration - 10; t += 10) {
    const ch = padChords[chordIdx % padChords.length];
    for (const cn of ch) {
      const pad = warmPad(n(cn), 12, 0.03);
      mixInto(out, pad, Math.floor(t * SR));
    }
    chordIdx++;
  }

  const grainInterval = 0.4;
  for (let t = 5; t < duration - 2; t += grainInterval + Math.sin(t * 0.7) * 0.2) {
    const grainLen = Math.floor(SR * 0.15);
    const offset = Math.floor(t * SR);
    const grainFreq = 2000 + Math.sin(t * 0.3) * 1000;
    for (let i = 0; i < grainLen && offset + i < total; i++) {
      const tt = i / SR;
      const env = Math.sin(Math.PI * tt / 0.15) * 0.008;
      out[offset + i] += sine(grainFreq, tt) * env;
    }
  }

  let result = Array.from(out);
  result = lowPassFilter(result, 5000);
  result = addReverb(result, 0.5, 140);
  result = fadeInOut(result, 4.0, 5.0);
  return normalize(result);
}

function generateCorporate(duration: number): number[] {
  const total = Math.floor(SR * duration);
  const out = new Float64Array(total);

  const progression = [
    { chord: ["C4","E4","G4","B4"], bass: "C3", melody: ["E5","G5","B5"], dur: 4 },
    { chord: ["D4","F#4","A4","C5"], bass: "D3", melody: ["F#5","A5","D5"], dur: 4 },
    { chord: ["E4","G4","B4","D5"], bass: "E3", melody: ["G5","B5","E5"], dur: 4 },
    { chord: ["F4","A4","C5","E5"], bass: "F3", melody: ["A5","C5","F5"], dur: 2 },
    { chord: ["G4","B4","D5","F5"], bass: "G3", melody: ["B5","D5","G5"], dur: 2 },
    { chord: ["A3","C4","E4","G4"], bass: "A2", melody: ["C5","E5","A5"], dur: 4 },
    { chord: ["F3","A3","C4","E4"], bass: "F2", melody: ["A4","C5","E5"], dur: 4 },
    { chord: ["G3","B3","D4","F4"], bass: "G2", melody: ["B4","D5","F5"], dur: 4 },
  ];

  let t = 0;
  let progIdx = 0;
  let melIdx = 0;
  while (t < duration) {
    const p = progression[progIdx % progression.length];

    for (const cn of p.chord) {
      const rhodes = rhodesTone(n(cn), p.dur + 0.5, 0.12);
      mixInto(out, rhodes, Math.floor(t * SR));
    }

    const bass = uprightBass(n(p.bass), p.dur, 0.1);
    mixInto(out, bass, Math.floor(t * SR));

    for (const cn of p.chord.slice(0, 3)) {
      const pad = warmPad(n(cn), p.dur + 1, 0.03);
      mixInto(out, pad, Math.floor(t * SR));
    }

    const melNoteDur = p.dur / p.melody.length;
    for (let mi = 0; mi < p.melody.length; mi++) {
      const mTime = t + mi * melNoteDur;
      if (mTime >= duration) break;
      const freq = n(p.melody[mi]);
      const fl = fluteTone(freq, melNoteDur * 1.8, 0.06);
      mixInto(out, fl, Math.floor(mTime * SR));
      melIdx++;
    }

    const beatInterval = 0.5;
    for (let b = 0; b < p.dur; b += beatInterval) {
      const beatTime = t + b;
      if (beatTime >= duration) break;
      const offset = Math.floor(beatTime * SR);
      const beatNum = Math.floor(b / beatInterval);
      if (beatNum % 4 === 0) {
        mixInto(out, softKick(0.12, 0.05), offset);
      }
      if (beatNum % 2 === 1) {
        mixInto(out, softHiHat(0.06, 0.015), offset);
      }
      if (beatNum % 4 === 2) {
        mixInto(out, shaker(0.04, 0.015), offset);
      }
    }

    t += p.dur;
    progIdx++;
  }

  let result = Array.from(out);
  result = lowPassFilter(result, 6000);
  result = addReverb(result, 0.25, 75);
  result = fadeInOut(result, 2.0, 3.0);
  return normalize(result);
}

function generateJazz(duration: number): number[] {
  const total = Math.floor(SR * duration);
  const out = new Float64Array(total);

  const changes = [
    { chord: ["C4","E4","G4","Bb4","D5"], bass: ["C3","E3","G3","Bb2"], dur: 4 },
    { chord: ["F4","A4","C5","Eb5","G5"], bass: ["F2","A2","C3","Eb3"], dur: 4 },
    { chord: ["Bb3","D4","F4","A4","C5"], bass: ["Bb2","D3","F3","A2"], dur: 4 },
    { chord: ["Eb4","G4","Bb4","D5","F5"], bass: ["Eb3","G3","Bb3","D3"], dur: 4 },
    { chord: ["A3","C#4","E4","G4","B4"], bass: ["A2","C3","E3","G2"], dur: 2 },
    { chord: ["D4","F#4","A4","C5","E5"], bass: ["D3","F#3","A3","C3"], dur: 2 },
    { chord: ["G3","B3","D4","F4","A4"], bass: ["G2","B2","D3","F2"], dur: 2 },
    { chord: ["C4","E4","G4","B4","D5"], bass: ["C3","E3","G3","B2"], dur: 2 },
  ];

  const melodyScale = ["G4","A4","Bb4","C5","D5","Eb5","F5","G5","A5","Bb5","C5","E5","F#5","Ab5"];

  let t = 0;
  let changeIdx = 0;
  let melIdx = 0;
  const seed = 42;
  let rng = seed;
  const pseudoRandom = () => {
    rng = (rng * 1664525 + 1013904223) & 0x7fffffff;
    return rng / 0x7fffffff;
  };

  while (t < duration) {
    const ch = changes[changeIdx % changes.length];

    for (const cn of ch.chord) {
      const rhodes = rhodesTone(n(cn), ch.dur + 1, 0.1);
      mixInto(out, rhodes, Math.floor(t * SR));
    }

    const bassNoteDur = ch.dur / ch.bass.length;
    for (let bi = 0; bi < ch.bass.length; bi++) {
      const bassTime = t + bi * bassNoteDur;
      if (bassTime >= duration) break;
      const bass = uprightBass(n(ch.bass[bi]), bassNoteDur * 0.9, 0.13);
      mixInto(out, bass, Math.floor(bassTime * SR));
    }

    const swingBeat = ch.dur / 4;
    for (let b = 0; b < 4; b++) {
      const beatTime = t + b * swingBeat;
      if (beatTime >= duration) break;
      const offset = Math.floor(beatTime * SR);
      mixInto(out, brushSwirl(0.15, 0.02), offset);
      const swingOffset = Math.floor((beatTime + swingBeat * 0.66) * SR);
      if (swingOffset < total) {
        mixInto(out, softHiHat(0.05, 0.012), swingOffset);
      }
      if (b === 1 || b === 3) {
        mixInto(out, rimClick(0.025), offset);
      }
    }

    const melNoteDur = ch.dur / 5;
    for (let mi = 0; mi < 5; mi++) {
      const mTime = t + mi * melNoteDur + melNoteDur * 0.15;
      if (mTime >= duration) break;
      if (pseudoRandom() > 0.25) {
        const noteIdx = Math.floor(pseudoRandom() * melodyScale.length);
        const freq = n(melodyScale[noteIdx]);
        const notLen = melNoteDur * (0.8 + pseudoRandom() * 0.8);
        const vel = 0.06 + pseudoRandom() * 0.04;
        const tone = rhodesTone(freq, notLen, vel);
        mixInto(out, tone, Math.floor(mTime * SR));
      }
      melIdx++;
    }

    const padNotes = ch.chord.slice(0, 3);
    for (const cn of padNotes) {
      const pad = warmPad(n(cn), ch.dur + 0.5, 0.02);
      mixInto(out, pad, Math.floor(t * SR));
    }

    t += ch.dur;
    changeIdx++;
  }

  let result = Array.from(out);
  result = lowPassFilter(result, 5500);
  result = addReverb(result, 0.3, 95);
  result = fadeInOut(result, 2.0, 3.0);
  return normalize(result);
}

function generateElevator(duration: number): number[] {
  const total = Math.floor(SR * duration);
  const out = new Float64Array(total);

  const progression = [
    { chord: ["C4","E4","G4","B4"], bass: "C3", melody: ["E5","G5","C5","E5","G5","B5"], dur: 3 },
    { chord: ["A3","C4","E4","G4"], bass: "A2", melody: ["C5","E5","A4","C5","E5","G4"], dur: 3 },
    { chord: ["F3","A3","C4","E4"], bass: "F2", melody: ["A4","C5","F5","A4","E5","C5"], dur: 3 },
    { chord: ["G3","B3","D4","F4"], bass: "G2", melody: ["B4","D5","G5","B4","F5","D5"], dur: 3 },
    { chord: ["D4","F4","A4","C5"], bass: "D3", melody: ["F5","A5","D5","F5","C5","A4"], dur: 3 },
    { chord: ["E4","G4","B4","D5"], bass: "E3", melody: ["G5","B5","E5","G5","D5","B4"], dur: 3 },
    { chord: ["F4","A4","C5","E5"], bass: "F3", melody: ["A5","C5","F5","A4","E5","C5"], dur: 3 },
    { chord: ["G3","B3","D4","G4"], bass: "G2", melody: ["D5","B4","G4","D5","G5","B4"], dur: 3 },
  ];

  let t = 0;
  let progIdx = 0;
  while (t < duration) {
    const p = progression[progIdx % progression.length];

    for (const cn of p.chord) {
      const pad = warmPad(n(cn), p.dur + 1, 0.04);
      mixInto(out, pad, Math.floor(t * SR));
    }

    const bass = bassTone(n(p.bass), p.dur, 0.07);
    mixInto(out, bass, Math.floor(t * SR));

    const noteDur = p.dur / p.melody.length;
    for (let mi = 0; mi < p.melody.length; mi++) {
      const noteTime = t + mi * noteDur;
      if (noteTime >= duration) break;
      const pluck = pluckTone(n(p.melody[mi]), noteDur * 2.5, 0.15);
      mixInto(out, pluck, Math.floor(noteTime * SR));
    }

    const counterNotes = [p.melody[2], p.melody[0], p.melody[4], p.melody[2]];
    const counterDur = p.dur / counterNotes.length;
    for (let ci = 0; ci < counterNotes.length; ci++) {
      const cTime = t + ci * counterDur + counterDur * 0.25;
      if (cTime >= duration || !counterNotes[ci]) break;
      const fl = fluteTone(n(counterNotes[ci]), counterDur * 1.5, 0.04);
      mixInto(out, fl, Math.floor(cTime * SR));
    }

    const brushInterval = p.dur / 6;
    for (let b = 0; b < 6; b++) {
      const bTime = t + b * brushInterval;
      if (bTime >= duration) break;
      mixInto(out, softHiHat(0.04, 0.008), Math.floor(bTime * SR));
      if (b % 3 === 0) {
        mixInto(out, shaker(0.05, 0.012), Math.floor(bTime * SR));
      }
    }

    t += p.dur;
    progIdx++;
  }

  let result = Array.from(out);
  result = lowPassFilter(result, 6000);
  result = addReverb(result, 0.3, 85);
  result = fadeInOut(result, 2.0, 3.0);
  return normalize(result);
}

function generateZen(duration: number): number[] {
  const total = Math.floor(SR * duration);
  const out = new Float64Array(total);

  const droneNotes = [n("C3"), n("G3"), n("C4"), n("G2")];
  for (let i = 0; i < total; i++) {
    const t = i / SR;
    for (let di = 0; di < droneNotes.length; di++) {
      const f = droneNotes[di];
      const lfo = 1 + 0.003 * sine(0.05 + di * 0.013, t);
      const vol = 0.03 * (1 + 0.3 * sine(0.02 + di * 0.008, t));
      out[i] += sine(f * lfo, t) * vol;
      out[i] += sine(f * 2 * lfo, t) * vol * 0.12;
      out[i] += triangle(f * 0.5, t) * vol * 0.08;
    }
  }

  const bowlNotes = ["C4","E4","G4","C5","E5","G5","A4","D5","F5","B4"];
  let bowlIdx = 0;
  for (let t = 1; t < duration - 8; t += 4 + Math.sin(bowlIdx * 1.7) * 2) {
    const bowl = singingBowl(n(bowlNotes[bowlIdx % bowlNotes.length]), 10, 0.1);
    mixInto(out, bowl, Math.floor(t * SR));
    bowlIdx++;
  }

  const kotoScale = ["C5","D5","F5","G5","A5","C6","D6","F6"];
  let kotoIdx = 0;
  for (let t = 3; t < duration - 3; t += 5 + Math.sin(kotoIdx * 2.1) * 2.5) {
    const noteCount = 3 + Math.floor(Math.sin(kotoIdx * 1.3) + 1.5);
    for (let ki = 0; ki < noteCount; ki++) {
      const kTime = t + ki * 0.6;
      if (kTime >= duration) break;
      const kNote = kotoScale[(kotoIdx + ki) % kotoScale.length];
      const k = kotoPluck(n(kNote), 3, 0.07);
      mixInto(out, k, Math.floor(kTime * SR));
    }
    kotoIdx++;
  }

  const bellNotes = ["E6","G5","C6","D6","A5","F6"];
  let bellIdx = 0;
  for (let t = 5; t < duration - 3; t += 7 + Math.sin(bellIdx * 2.3) * 3) {
    const freq = n(bellNotes[bellIdx % bellNotes.length]);
    const bellLen = Math.floor(SR * 4);
    for (let i = 0; i < bellLen && Math.floor(t * SR) + i < total; i++) {
      const tt = i / SR;
      const env = Math.exp(-tt * 1.2) * 0.05;
      out[Math.floor(t * SR) + i] += sine(freq, tt) * env
        + sine(freq * 2.76, tt) * env * 0.3
        + sine(freq * 5.4, tt) * env * 0.1
        + sine(freq * 0.5, tt) * env * 0.15;
    }
    bellIdx++;
  }

  const breathLen = Math.floor(SR * 0.8);
  for (let t = 4; t < duration - 2; t += 10 + Math.sin(t * 0.2) * 3) {
    for (let i = 0; i < breathLen && Math.floor(t * SR) + i < total; i++) {
      const tt = i / SR;
      const env = Math.sin(Math.PI * tt / 0.8) * 0.008;
      out[Math.floor(t * SR) + i] += noise() * env;
    }
  }

  const padNotes = [["C4","E4","G4"], ["D4","F4","A4"], ["C4","Eb4","Ab4"], ["C4","F4","G4"]];
  let padIdx = 0;
  for (let t = 0; t < duration - 15; t += 15) {
    const ch = padNotes[padIdx % padNotes.length];
    for (const cn of ch) {
      const pad = warmPad(n(cn), 16, 0.02);
      mixInto(out, pad, Math.floor(t * SR));
    }
    padIdx++;
  }

  let result = Array.from(out);
  result = lowPassFilter(result, 4000);
  result = addReverb(result, 0.5, 160);
  result = fadeInOut(result, 4.0, 5.0);
  return normalize(result);
}

function generateByStyle(style: string, duration: number): number[] {
  switch (style) {
    case "classical": return generateClassical(duration);
    case "ambient": return generateAmbient(duration);
    case "corporate": return generateCorporate(duration);
    case "jazz": return generateJazz(duration);
    case "elevator": return generateElevator(duration);
    case "zen": return generateZen(duration);
    default: return generateAmbient(duration);
  }
}

function samplesToWav(samples: number[], sampleRate: number): Buffer {
  const bitsPerSample = 16;
  const numChannels = 1;
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * numChannels * bitsPerSample / 8, 28);
  buffer.writeUInt16LE(numChannels * bitsPerSample / 8, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    const val = Math.floor(clamped * 32767);
    buffer.writeInt16LE(val, 44 + i * 2);
  }

  return buffer;
}

export async function generateStockMoh(stockId: string, outputDir: string, overrideDuration?: number): Promise<{
  filePath: string;
  duration: number;
  fileSize: number;
}> {
  const option = STOCK_MOH_OPTIONS.find(o => o.id === stockId);
  if (!option) {
    throw new Error(`Unknown stock MOH: ${stockId}`);
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const duration = overrideDuration || option.durationSeconds;
  const samples = generateByStyle(option.style, duration);
  const wavBuffer = samplesToWav(samples, SR);

  const fileName = `stock-moh-${stockId}-${Date.now()}.wav`;
  const filePath = path.join(outputDir, fileName);

  fs.writeFileSync(filePath, wavBuffer);

  return {
    filePath,
    duration: option.durationSeconds,
    fileSize: wavBuffer.length,
  };
}
