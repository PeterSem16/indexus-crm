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
    description: "Soft piano arpeggios with warm string pads and gentle dynamics",
    style: "classical",
    durationSeconds: 60,
  },
  {
    id: "ambient-calm",
    name: "Ambient Calm",
    description: "Lush evolving ambient textures with slow harmonic movement and soft shimmer",
    style: "ambient",
    durationSeconds: 60,
  },
  {
    id: "corporate-professional",
    name: "Corporate Professional",
    description: "Polished modern corporate soundscape with clean chord progressions and subtle rhythm",
    style: "corporate",
    durationSeconds: 60,
  },
  {
    id: "jazz-lounge",
    name: "Jazz Lounge",
    description: "Smooth jazz with walking bass, soft Rhodes piano chords and mellow melodies",
    style: "jazz",
    durationSeconds: 60,
  },
  {
    id: "elevator-light",
    name: "Bossa Nova Light",
    description: "Light bossa nova inspired easy-listening with gentle guitar-like plucks and soft pads",
    style: "elevator",
    durationSeconds: 60,
  },
  {
    id: "nature-zen",
    name: "Zen Garden",
    description: "Meditative soundscape with singing bowls, soft drones and crystalline bell overtones",
    style: "zen",
    durationSeconds: 60,
  },
];

const SAMPLE_RATE = 44100;

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

function noise(): number {
  return Math.random() * 2 - 1;
}

function lowPassFilter(samples: number[], cutoffHz: number, sampleRate: number): number[] {
  const rc = 1 / (2 * Math.PI * cutoffHz);
  const dt = 1 / sampleRate;
  const alpha = dt / (rc + dt);
  const out = new Float64Array(samples.length);
  out[0] = samples[0];
  for (let i = 1; i < samples.length; i++) {
    out[i] = out[i - 1] + alpha * (samples[i] - out[i - 1]);
  }
  return Array.from(out);
}

function addReverb(samples: number[], decay: number = 0.3, delayMs: number = 80): number[] {
  const delaySamples = Math.floor(SAMPLE_RATE * delayMs / 1000);
  const delays = [delaySamples, Math.floor(delaySamples * 1.37), Math.floor(delaySamples * 1.73), Math.floor(delaySamples * 2.11)];
  const gains = [decay, decay * 0.7, decay * 0.5, decay * 0.35];
  const out = new Float64Array(samples.length + delays[delays.length - 1] + SAMPLE_RATE);
  for (let i = 0; i < samples.length; i++) out[i] = samples[i];
  for (let d = 0; d < delays.length; d++) {
    for (let i = 0; i < samples.length; i++) {
      out[i + delays[d]] += samples[i] * gains[d];
    }
  }
  return Array.from(out).slice(0, samples.length);
}

function fadeInOut(samples: number[], fadeInSec: number, fadeOutSec: number): number[] {
  const fadeInSamples = Math.floor(SAMPLE_RATE * fadeInSec);
  const fadeOutSamples = Math.floor(SAMPLE_RATE * fadeOutSec);
  const out = new Float64Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    let gain = 1;
    if (i < fadeInSamples) gain = i / fadeInSamples;
    if (i > samples.length - fadeOutSamples) gain = (samples.length - i) / fadeOutSamples;
    out[i] = samples[i] * gain;
  }
  return Array.from(out);
}

function pianoTone(freq: number, duration: number, velocity: number = 0.5): number[] {
  const len = Math.floor(SAMPLE_RATE * duration);
  const out = new Float64Array(len);
  const harmonics = [1, 2, 3, 4, 5, 6, 7, 8];
  const hGains = [1, 0.5, 0.3, 0.15, 0.08, 0.04, 0.02, 0.01];
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const attackEnv = 1 - Math.exp(-t * 40);
    const decayEnv = Math.exp(-t * 1.8);
    const env = attackEnv * decayEnv * velocity;
    let sample = 0;
    for (let h = 0; h < harmonics.length; h++) {
      const hFreq = freq * harmonics[h];
      if (hFreq > SAMPLE_RATE / 2) break;
      const hDecay = Math.exp(-t * (1.5 + h * 0.8));
      sample += sine(hFreq, t) * hGains[h] * hDecay;
    }
    out[i] = sample * env;
  }
  return Array.from(out);
}

function rhodesTone(freq: number, duration: number, velocity: number = 0.4): number[] {
  const len = Math.floor(SAMPLE_RATE * duration);
  const out = new Float64Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const attackEnv = 1 - Math.exp(-t * 30);
    const decayEnv = Math.exp(-t * 1.2);
    const env = attackEnv * decayEnv * velocity;
    const modIndex = 3 * Math.exp(-t * 2);
    const modulator = sine(freq * 14, t) * modIndex;
    const carrier = sine(freq + modulator, t);
    const bell = sine(freq * 3, t) * 0.15 * Math.exp(-t * 6);
    out[i] = (carrier + bell) * env;
  }
  return Array.from(out);
}

function stringPad(freq: number, duration: number, volume: number = 0.15): number[] {
  const len = Math.floor(SAMPLE_RATE * duration);
  const out = new Float64Array(len);
  const detune = [0, 0.003, -0.003, 0.006, -0.006];
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const env = Math.min(t / 0.8, 1) * Math.min((duration - t) / 0.8, 1);
    let sample = 0;
    for (const d of detune) {
      const f = freq * (1 + d);
      sample += sine(f, t) + 0.3 * sine(f * 2, t) + 0.1 * sine(f * 3, t);
    }
    const vibrato = 1 + 0.003 * sine(5.2, t);
    out[i] = (sample / detune.length) * env * volume * vibrato;
  }
  return Array.from(out);
}

function pluckTone(freq: number, duration: number, velocity: number = 0.4): number[] {
  const len = Math.floor(SAMPLE_RATE * duration);
  const out = new Float64Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const env = Math.exp(-t * 4) * velocity;
    const bright = Math.exp(-t * 8);
    out[i] = (sine(freq, t) + 0.5 * sine(freq * 2, t) * bright + 0.25 * sine(freq * 3, t) * bright * bright + 0.15 * triangle(freq, t) * bright) * env;
  }
  return Array.from(out);
}

function bassTone(freq: number, duration: number, velocity: number = 0.3): number[] {
  const len = Math.floor(SAMPLE_RATE * duration);
  const out = new Float64Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const env = Math.min(t / 0.02, 1) * Math.exp(-t * 0.8) * velocity;
    out[i] = (sine(freq, t) + 0.6 * sine(freq * 2, t) + 0.2 * softSquare(freq, t)) * env;
  }
  return Array.from(out);
}

function singingBowl(freq: number, duration: number, velocity: number = 0.3): number[] {
  const len = Math.floor(SAMPLE_RATE * duration);
  const out = new Float64Array(len);
  const partials = [1, 2.71, 4.16, 5.43, 7.91];
  const pGains = [1, 0.6, 0.4, 0.25, 0.15];
  const pDecays = [0.3, 0.5, 0.8, 1.2, 1.5];
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const attack = 1 - Math.exp(-t * 8);
    let sample = 0;
    for (let p = 0; p < partials.length; p++) {
      const pFreq = freq * partials[p];
      if (pFreq > SAMPLE_RATE / 2) break;
      const beatFreq = 0.5 + p * 0.3;
      const beating = 1 + 0.1 * sine(beatFreq, t);
      sample += sine(pFreq, t) * pGains[p] * Math.exp(-t * pDecays[p]) * beating;
    }
    out[i] = sample * attack * velocity;
  }
  return Array.from(out);
}

function softHiHat(duration: number = 0.08, velocity: number = 0.05): number[] {
  const len = Math.floor(SAMPLE_RATE * duration);
  const out = new Float64Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    out[i] = noise() * Math.exp(-t * 40) * velocity;
  }
  return lowPassFilter(Array.from(out), 8000, SAMPLE_RATE);
}

function softKick(duration: number = 0.15, velocity: number = 0.12): number[] {
  const len = Math.floor(SAMPLE_RATE * duration);
  const out = new Float64Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const pitchEnv = 80 + 120 * Math.exp(-t * 30);
    out[i] = sine(pitchEnv, t) * Math.exp(-t * 12) * velocity;
  }
  return Array.from(out);
}

function mixInto(target: Float64Array, source: number[], offset: number): void {
  for (let i = 0; i < source.length && offset + i < target.length; i++) {
    target[offset + i] += source[i];
  }
}

function normalize(samples: number[], peak: number = 0.85): number[] {
  const maxAbs = Math.max(...samples.map(Math.abs));
  if (maxAbs === 0) return samples;
  const scale = peak / maxAbs;
  return samples.map(s => s * scale);
}

const NOTE_FREQS: Record<string, number> = {
  "C2": 65.41, "D2": 73.42, "E2": 82.41, "F2": 87.31, "G2": 98.00, "A2": 110.00, "Bb2": 116.54, "B2": 123.47,
  "C3": 130.81, "D3": 146.83, "Eb3": 155.56, "E3": 164.81, "F3": 174.61, "F#3": 185.00, "G3": 196.00, "Ab3": 207.65, "A3": 220.00, "Bb3": 233.08, "B3": 246.94,
  "C4": 261.63, "C#4": 277.18, "D4": 293.66, "Eb4": 311.13, "E4": 329.63, "F4": 349.23, "F#4": 369.99, "G4": 392.00, "Ab4": 415.30, "A4": 440.00, "Bb4": 466.16, "B4": 493.88,
  "C5": 523.25, "C#5": 554.37, "D5": 587.33, "Eb5": 622.25, "E5": 659.26, "F5": 698.46, "G5": 783.99, "A5": 880.00, "B5": 987.77,
  "C6": 1046.50, "D6": 1174.66, "E6": 1318.51,
};

function n(note: string): number { return NOTE_FREQS[note] || 440; }

function generateClassical(duration: number): number[] {
  const totalSamples = Math.floor(SAMPLE_RATE * duration);
  const out = new Float64Array(totalSamples);

  const arpeggioPatterns = [
    ["C4", "E4", "G4", "C5", "G4", "E4"],
    ["F3", "A4", "C5", "F5", "C5", "A4"],
    ["G3", "B4", "D5", "G5", "D5", "B4"],
    ["A3", "C4", "E4", "A4", "E4", "C4"],
    ["D3", "F4", "A4", "D5", "A4", "F4"],
    ["G3", "B3", "D4", "G4", "D4", "B3"],
    ["C4", "E4", "G4", "C5", "E5", "C5"],
    ["F3", "A3", "C4", "F4", "A4", "F4"],
  ];

  const padChords = [
    ["C3", "E3", "G3"],
    ["F3", "A3", "C4"],
    ["G3", "B3", "D4"],
    ["A3", "C4", "E4"],
    ["D3", "F3", "A3"],
    ["G3", "B3", "D4"],
    ["C3", "E3", "G3"],
    ["F3", "A3", "C4"],
  ];

  const noteDur = 0.35;
  const patternDur = noteDur * 6;
  let patIdx = 0;
  let t = 0;

  while (t < duration) {
    const pattern = arpeggioPatterns[patIdx % arpeggioPatterns.length];
    const chord = padChords[patIdx % padChords.length];

    for (const cn of chord) {
      const pad = stringPad(n(cn), patternDur + 0.5, 0.06);
      mixInto(out, pad, Math.floor(t * SAMPLE_RATE));
    }

    for (let ni = 0; ni < pattern.length; ni++) {
      const noteTime = t + ni * noteDur;
      if (noteTime >= duration) break;
      const vel = 0.2 + 0.08 * Math.sin(ni * 0.8);
      const piano = pianoTone(n(pattern[ni]), noteDur * 2.5, vel);
      mixInto(out, piano, Math.floor(noteTime * SAMPLE_RATE));
    }

    t += patternDur;
    patIdx++;
  }

  let result = Array.from(out);
  result = lowPassFilter(result, 6000, SAMPLE_RATE);
  result = addReverb(result, 0.35, 100);
  result = fadeInOut(result, 2.0, 3.0);
  return normalize(result);
}

function generateAmbient(duration: number): number[] {
  const totalSamples = Math.floor(SAMPLE_RATE * duration);
  const out = new Float64Array(totalSamples);

  const droneFreqs = [n("C3"), n("G3")];
  for (let i = 0; i < totalSamples; i++) {
    const t = i / SAMPLE_RATE;
    for (const f of droneFreqs) {
      const lfo1 = 1 + 0.003 * sine(0.07, t);
      const lfo2 = 1 + 0.002 * sine(0.13, t);
      const vol = 0.06 * (1 + 0.4 * sine(0.04, t));
      out[i] += sine(f * lfo1, t) * vol;
      out[i] += sine(f * 2 * lfo2, t) * vol * 0.3;
      out[i] += sine(f * 3 * lfo1 * lfo2, t) * vol * 0.1;
    }
  }

  const shimmerNotes = ["E5", "G5", "C6", "E6", "D6", "B5", "G5", "A5"];
  let shimIdx = 0;
  for (let t = 2; t < duration - 4; t += 3 + Math.sin(shimIdx) * 1.5) {
    const freq = n(shimmerNotes[shimIdx % shimmerNotes.length]);
    const len = Math.floor(SAMPLE_RATE * 4);
    for (let i = 0; i < len && Math.floor(t * SAMPLE_RATE) + i < totalSamples; i++) {
      const tt = i / SAMPLE_RATE;
      const env = Math.sin(Math.PI * tt / 4) * 0.04;
      const vibrato = 1 + 0.005 * sine(3, tt);
      out[Math.floor(t * SAMPLE_RATE) + i] += sine(freq * vibrato, tt) * env;
    }
    shimIdx++;
  }

  const padChords = [
    ["C4", "E4", "G4"],
    ["D4", "F4", "A4"],
    ["E4", "G4", "B4"],
    ["C4", "E4", "A4"],
  ];
  let chordIdx = 0;
  for (let t = 0; t < duration - 8; t += 8) {
    const chord = padChords[chordIdx % padChords.length];
    for (const cn of chord) {
      const pad = stringPad(n(cn), 10, 0.04);
      mixInto(out, pad, Math.floor(t * SAMPLE_RATE));
    }
    chordIdx++;
  }

  let result = Array.from(out);
  result = lowPassFilter(result, 4500, SAMPLE_RATE);
  result = addReverb(result, 0.45, 120);
  result = fadeInOut(result, 4.0, 5.0);
  return normalize(result);
}

function generateCorporate(duration: number): number[] {
  const totalSamples = Math.floor(SAMPLE_RATE * duration);
  const out = new Float64Array(totalSamples);

  const progression = [
    { chord: ["C4", "E4", "G4", "B4"], bass: "C3", dur: 4 },
    { chord: ["D4", "F4", "A4", "C5"], bass: "D3", dur: 4 },
    { chord: ["E4", "G4", "B4", "D5"], bass: "E3", dur: 4 },
    { chord: ["F4", "A4", "C5", "E5"], bass: "F3", dur: 2 },
    { chord: ["G4", "B4", "D5", "F5"], bass: "G3", dur: 2 },
    { chord: ["A3", "C4", "E4", "G4"], bass: "A2", dur: 4 },
    { chord: ["F3", "A3", "C4", "E4"], bass: "F2", dur: 2 },
    { chord: ["G3", "B3", "D4", "F4"], bass: "G2", dur: 2 },
  ];

  let t = 0;
  let progIdx = 0;
  while (t < duration) {
    const p = progression[progIdx % progression.length];
    const chordDur = p.dur;

    for (const cn of p.chord) {
      const rhodes = rhodesTone(n(cn), chordDur + 0.5, 0.15);
      mixInto(out, rhodes, Math.floor(t * SAMPLE_RATE));
    }

    const bass = bassTone(n(p.bass), chordDur, 0.12);
    mixInto(out, bass, Math.floor(t * SAMPLE_RATE));

    const padNotes = p.chord.slice(0, 2);
    for (const cn of padNotes) {
      const pad = stringPad(n(cn), chordDur + 1, 0.04);
      mixInto(out, pad, Math.floor(t * SAMPLE_RATE));
    }

    const beatInterval = 0.5;
    for (let b = 0; b < chordDur; b += beatInterval) {
      const beatTime = t + b;
      if (beatTime >= duration) break;
      const offset = Math.floor(beatTime * SAMPLE_RATE);
      if (Math.floor(b / beatInterval) % 4 === 0) {
        mixInto(out, softKick(0.12, 0.06), offset);
      }
      if (Math.floor(b / beatInterval) % 2 === 1) {
        mixInto(out, softHiHat(0.06, 0.02), offset);
      }
    }

    t += chordDur;
    progIdx++;
  }

  let result = Array.from(out);
  result = lowPassFilter(result, 5500, SAMPLE_RATE);
  result = addReverb(result, 0.25, 70);
  result = fadeInOut(result, 2.0, 3.0);
  return normalize(result);
}

function generateJazz(duration: number): number[] {
  const totalSamples = Math.floor(SAMPLE_RATE * duration);
  const out = new Float64Array(totalSamples);

  const changes = [
    { chord: ["C4", "E4", "G4", "Bb4"], bass: ["C3", "E3", "G3", "Bb2"], dur: 4 },
    { chord: ["F4", "A4", "C5", "Eb5"], bass: ["F2", "A2", "C3", "Eb3"], dur: 4 },
    { chord: ["Bb3", "D4", "F4", "A4"], bass: ["Bb2", "D3", "F3", "A2"], dur: 4 },
    { chord: ["Eb4", "G4", "Bb4", "D5"], bass: ["Eb3", "G3", "Bb3", "D3"], dur: 4 },
    { chord: ["A3", "C#4", "E4", "G4"], bass: ["A2", "C3", "E3", "G2"], dur: 2 },
    { chord: ["D4", "F#4", "A4", "C5"], bass: ["D3", "F#3", "A3", "C3"], dur: 2 },
    { chord: ["G3", "B3", "D4", "F4"], bass: ["G2", "B2", "D3", "F2"], dur: 2 },
    { chord: ["C4", "E4", "G4", "B4"], bass: ["C3", "E3", "G3", "B2"], dur: 2 },
  ];

  const melodyNotes = ["G5", "A5", "Bb4", "C5", "D5", "Eb5", "F5", "G5", "E5", "D5", "C5", "Bb4", "A4", "G4", "F4", "E4"];

  let t = 0;
  let changeIdx = 0;
  let melIdx = 0;
  while (t < duration) {
    const ch = changes[changeIdx % changes.length];

    for (const cn of ch.chord) {
      const rhodes = rhodesTone(n(cn), ch.dur + 0.8, 0.12);
      mixInto(out, rhodes, Math.floor(t * SAMPLE_RATE));
    }

    const bassNoteDur = ch.dur / ch.bass.length;
    for (let bi = 0; bi < ch.bass.length; bi++) {
      const bassTime = t + bi * bassNoteDur;
      if (bassTime >= duration) break;
      const bass = bassTone(n(ch.bass[bi]), bassNoteDur * 0.9, 0.15);
      mixInto(out, bass, Math.floor(bassTime * SAMPLE_RATE));
    }

    const swingBeat = ch.dur / 4;
    for (let b = 0; b < 4; b++) {
      const beatTime = t + b * swingBeat;
      if (beatTime >= duration) break;
      const offset = Math.floor(beatTime * SAMPLE_RATE);
      mixInto(out, softHiHat(0.05, 0.015), offset);
      const swingOffset = Math.floor((beatTime + swingBeat * 0.66) * SAMPLE_RATE);
      if (swingOffset < totalSamples) {
        mixInto(out, softHiHat(0.04, 0.01), swingOffset);
      }
    }

    const melNoteDur = ch.dur / 3;
    for (let mi = 0; mi < 3; mi++) {
      const melTime = t + mi * melNoteDur + 0.1;
      if (melTime >= duration) break;
      if (Math.random() > 0.3) {
        const freq = n(melodyNotes[melIdx % melodyNotes.length]);
        const piano = rhodesTone(freq, melNoteDur * 1.5, 0.08 + Math.random() * 0.04);
        mixInto(out, piano, Math.floor(melTime * SAMPLE_RATE));
      }
      melIdx++;
    }

    t += ch.dur;
    changeIdx++;
  }

  let result = Array.from(out);
  result = lowPassFilter(result, 5000, SAMPLE_RATE);
  result = addReverb(result, 0.3, 90);
  result = fadeInOut(result, 2.0, 3.0);
  return normalize(result);
}

function generateElevator(duration: number): number[] {
  const totalSamples = Math.floor(SAMPLE_RATE * duration);
  const out = new Float64Array(totalSamples);

  const progression = [
    { chord: ["C4", "E4", "G4"], bass: "C3", melody: ["E5", "G5", "C5", "E5"] },
    { chord: ["A3", "C4", "E4"], bass: "A2", melody: ["C5", "E5", "A4", "C5"] },
    { chord: ["F3", "A3", "C4"], bass: "F2", melody: ["A4", "C5", "F5", "A4"] },
    { chord: ["G3", "B3", "D4"], bass: "G2", melody: ["B4", "D5", "G5", "B4"] },
    { chord: ["D4", "F4", "A4"], bass: "D3", melody: ["F5", "A5", "D5", "F5"] },
    { chord: ["E4", "G4", "B4"], bass: "E3", melody: ["G5", "B5", "E5", "G5"] },
    { chord: ["F4", "A4", "C5"], bass: "F3", melody: ["A5", "C5", "F5", "A4"] },
    { chord: ["G3", "B3", "D4"], bass: "G2", melody: ["D5", "B4", "G4", "D5"] },
  ];

  const chordDur = 3;
  let t = 0;
  let progIdx = 0;
  while (t < duration) {
    const p = progression[progIdx % progression.length];

    for (const cn of p.chord) {
      const pad = stringPad(n(cn), chordDur + 1, 0.06);
      mixInto(out, pad, Math.floor(t * SAMPLE_RATE));
    }

    const bass = bassTone(n(p.bass), chordDur, 0.08);
    mixInto(out, bass, Math.floor(t * SAMPLE_RATE));

    const noteDur = chordDur / p.melody.length;
    for (let mi = 0; mi < p.melody.length; mi++) {
      const noteTime = t + mi * noteDur;
      if (noteTime >= duration) break;
      const pluck = pluckTone(n(p.melody[mi]), noteDur * 2, 0.18);
      mixInto(out, pluck, Math.floor(noteTime * SAMPLE_RATE));
    }

    const brushInterval = chordDur / 6;
    for (let b = 0; b < 6; b++) {
      const bTime = t + b * brushInterval;
      if (bTime >= duration) break;
      mixInto(out, softHiHat(0.04, 0.008), Math.floor(bTime * SAMPLE_RATE));
    }

    t += chordDur;
    progIdx++;
  }

  let result = Array.from(out);
  result = lowPassFilter(result, 5500, SAMPLE_RATE);
  result = addReverb(result, 0.3, 85);
  result = fadeInOut(result, 2.0, 3.0);
  return normalize(result);
}

function generateZen(duration: number): number[] {
  const totalSamples = Math.floor(SAMPLE_RATE * duration);
  const out = new Float64Array(totalSamples);

  for (let i = 0; i < totalSamples; i++) {
    const t = i / SAMPLE_RATE;
    const drone1 = sine(n("C3"), t) * 0.04 * (1 + 0.3 * sine(0.02, t));
    const drone2 = sine(n("G3"), t) * 0.03 * (1 + 0.2 * sine(0.03, t));
    const drone3 = sine(n("C4"), t) * 0.02 * (1 + 0.25 * sine(0.015, t));
    out[i] += drone1 + drone2 + drone3;
  }

  const bowlNotes = ["C4", "E4", "G4", "C5", "E5", "G5", "A4", "D5"];
  let bowlIdx = 0;
  for (let t = 1; t < duration - 6; t += 5 + Math.sin(bowlIdx * 1.7) * 2) {
    const bowl = singingBowl(n(bowlNotes[bowlIdx % bowlNotes.length]), 8, 0.12);
    mixInto(out, bowl, Math.floor(t * SAMPLE_RATE));
    bowlIdx++;
  }

  const bellNotes = ["E6", "G5", "C6", "D6", "A5"];
  let bellIdx = 0;
  for (let t = 3; t < duration - 2; t += 7 + Math.sin(bellIdx * 2.3) * 3) {
    const freq = n(bellNotes[bellIdx % bellNotes.length]);
    const bellLen = Math.floor(SAMPLE_RATE * 3);
    for (let i = 0; i < bellLen && Math.floor(t * SAMPLE_RATE) + i < totalSamples; i++) {
      const tt = i / SAMPLE_RATE;
      const env = Math.exp(-tt * 1.5) * 0.06;
      out[Math.floor(t * SAMPLE_RATE) + i] += sine(freq, tt) * env
        + sine(freq * 2.76, tt) * env * 0.3
        + sine(freq * 5.4, tt) * env * 0.1;
    }
    bellIdx++;
  }

  const breathLen = Math.floor(SAMPLE_RATE * 0.5);
  for (let t = 4; t < duration - 2; t += 12) {
    for (let i = 0; i < breathLen && Math.floor(t * SAMPLE_RATE) + i < totalSamples; i++) {
      const tt = i / SAMPLE_RATE;
      const env = Math.sin(Math.PI * tt / 0.5) * 0.01;
      out[Math.floor(t * SAMPLE_RATE) + i] += noise() * env;
    }
  }

  let result = Array.from(out);
  result = lowPassFilter(result, 3500, SAMPLE_RATE);
  result = addReverb(result, 0.5, 150);
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

export async function generateStockMoh(stockId: string, outputDir: string): Promise<{
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

  const samples = generateByStyle(option.style, option.durationSeconds);
  const wavBuffer = samplesToWav(samples, SAMPLE_RATE);

  const fileName = `stock-moh-${stockId}-${Date.now()}.wav`;
  const filePath = path.join(outputDir, fileName);

  fs.writeFileSync(filePath, wavBuffer);

  return {
    filePath,
    duration: option.durationSeconds,
    fileSize: wavBuffer.length,
  };
}
