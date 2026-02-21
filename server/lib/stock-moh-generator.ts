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
    description: "Soft classical-style melody with gentle piano-like tones",
    style: "classical",
    durationSeconds: 60,
  },
  {
    id: "ambient-calm",
    name: "Ambient Calm",
    description: "Relaxing ambient soundscape with smooth flowing tones",
    style: "ambient",
    durationSeconds: 60,
  },
  {
    id: "corporate-professional",
    name: "Corporate Professional",
    description: "Clean professional corporate hold music",
    style: "corporate",
    durationSeconds: 60,
  },
  {
    id: "jazz-lounge",
    name: "Jazz Lounge",
    description: "Smooth jazz-inspired mellow background music",
    style: "jazz",
    durationSeconds: 60,
  },
  {
    id: "elevator-light",
    name: "Elevator Light",
    description: "Light easy-listening elevator music style",
    style: "elevator",
    durationSeconds: 60,
  },
  {
    id: "nature-zen",
    name: "Nature Zen",
    description: "Zen-inspired peaceful tones with nature-like ambience",
    style: "zen",
    durationSeconds: 60,
  },
];

const SAMPLE_RATE = 22050;

function generateSineWave(frequency: number, duration: number, volume: number, sampleRate: number): number[] {
  const samples: number[] = [];
  const totalSamples = Math.floor(sampleRate * duration);
  for (let i = 0; i < totalSamples; i++) {
    samples.push(Math.sin(2 * Math.PI * frequency * i / sampleRate) * volume);
  }
  return samples;
}

function applyEnvelope(samples: number[], attackMs: number, releaseMs: number, sampleRate: number): number[] {
  const attackSamples = Math.floor(sampleRate * attackMs / 1000);
  const releaseSamples = Math.floor(sampleRate * releaseMs / 1000);
  return samples.map((s, i) => {
    let env = 1;
    if (i < attackSamples) env = i / attackSamples;
    if (i > samples.length - releaseSamples) env = (samples.length - i) / releaseSamples;
    return s * env;
  });
}

function mixSamples(...tracks: number[][]): number[] {
  const maxLen = Math.max(...tracks.map(t => t.length));
  const result = new Array(maxLen).fill(0);
  for (const track of tracks) {
    for (let i = 0; i < track.length; i++) {
      result[i] += track[i];
    }
  }
  const peak = Math.max(...result.map(Math.abs));
  if (peak > 0.95) {
    const scale = 0.9 / peak;
    for (let i = 0; i < result.length; i++) result[i] *= scale;
  }
  return result;
}

function generateNote(freq: number, dur: number, vol: number): number[] {
  return applyEnvelope(generateSineWave(freq, dur, vol, SAMPLE_RATE), 30, 80, SAMPLE_RATE);
}

function generateChord(freqs: number[], dur: number, vol: number): number[] {
  const tracks = freqs.map(f => generateNote(f, dur, vol / freqs.length));
  return mixSamples(...tracks);
}

function concatSamples(...parts: number[][]): number[] {
  return parts.flat();
}

function generateClassical(duration: number): number[] {
  const notes = [
    261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25,
    493.88, 440.00, 392.00, 349.23, 329.63, 293.66, 261.63, 246.94,
  ];
  const noteDur = 0.5;
  const parts: number[][] = [];
  let totalLen = 0;
  let noteIdx = 0;
  while (totalLen < duration) {
    const freq = notes[noteIdx % notes.length];
    const harmonic = generateNote(freq * 2, noteDur, 0.08);
    const main = generateNote(freq, noteDur, 0.25);
    const bass = generateNote(freq / 2, noteDur, 0.1);
    parts.push(mixSamples(main, harmonic, bass));
    totalLen += noteDur;
    noteIdx++;
  }
  return concatSamples(...parts);
}

function generateAmbient(duration: number): number[] {
  const pads = [
    { freq: 220, vol: 0.15 },
    { freq: 277.18, vol: 0.12 },
    { freq: 329.63, vol: 0.1 },
  ];
  const totalSamples = Math.floor(SAMPLE_RATE * duration);
  const result = new Array(totalSamples).fill(0);
  for (const pad of pads) {
    for (let i = 0; i < totalSamples; i++) {
      const lfo = 1 + 0.3 * Math.sin(2 * Math.PI * 0.05 * i / SAMPLE_RATE);
      const vibrato = pad.freq * (1 + 0.002 * Math.sin(2 * Math.PI * 0.2 * i / SAMPLE_RATE));
      result[i] += Math.sin(2 * Math.PI * vibrato * i / SAMPLE_RATE) * pad.vol * lfo;
    }
  }
  return applyEnvelope(result, 2000, 2000, SAMPLE_RATE);
}

function generateCorporate(duration: number): number[] {
  const progression = [
    [261.63, 329.63, 392.00],
    [293.66, 349.23, 440.00],
    [329.63, 392.00, 493.88],
    [261.63, 329.63, 392.00],
    [220.00, 277.18, 329.63],
    [246.94, 311.13, 369.99],
    [261.63, 329.63, 392.00],
    [293.66, 349.23, 440.00],
  ];
  const chordDur = 1.5;
  const parts: number[][] = [];
  let totalLen = 0;
  let idx = 0;
  while (totalLen < duration) {
    const chord = progression[idx % progression.length];
    parts.push(applyEnvelope(
      generateChord(chord, chordDur, 0.2),
      200, 300, SAMPLE_RATE
    ));
    totalLen += chordDur;
    idx++;
  }
  return concatSamples(...parts);
}

function generateJazz(duration: number): number[] {
  const chords = [
    [261.63, 329.63, 392.00, 466.16],
    [293.66, 369.99, 440.00, 523.25],
    [349.23, 440.00, 523.25, 622.25],
    [329.63, 415.30, 493.88, 587.33],
    [261.63, 329.63, 392.00, 466.16],
  ];
  const melodyNotes = [523.25, 587.33, 622.25, 523.25, 466.16, 440.00, 392.00, 349.23, 329.63, 293.66];
  const chordDur = 2.0;
  const parts: number[][] = [];
  let totalLen = 0;
  let chordIdx = 0;
  let melodyIdx = 0;
  while (totalLen < duration) {
    const chord = chords[chordIdx % chords.length];
    const bg = generateChord(chord, chordDur, 0.12);
    const notesInChord = 4;
    const melParts: number[][] = [];
    for (let n = 0; n < notesInChord; n++) {
      const freq = melodyNotes[melodyIdx % melodyNotes.length];
      const nd = chordDur / notesInChord;
      const silence = new Array(Math.floor(SAMPLE_RATE * nd * n)).fill(0);
      melParts.push(concatSamples(silence, generateNote(freq, nd * 0.8, 0.15)));
      melodyIdx++;
    }
    const melody = mixSamples(...melParts);
    const combined = mixSamples(bg, melody.concat(new Array(Math.max(0, bg.length - melody.length)).fill(0)));
    parts.push(combined);
    totalLen += chordDur;
    chordIdx++;
  }
  return concatSamples(...parts);
}

function generateElevator(duration: number): number[] {
  const melody = [
    392.00, 440.00, 493.88, 523.25, 493.88, 440.00, 392.00, 349.23,
    329.63, 349.23, 392.00, 440.00, 523.25, 493.88, 440.00, 392.00,
  ];
  const noteDur = 0.4;
  const parts: number[][] = [];
  let totalLen = 0;
  let idx = 0;
  while (totalLen < duration) {
    const freq = melody[idx % melody.length];
    const main = generateNote(freq, noteDur, 0.2);
    const pad = generateNote(freq / 2, noteDur, 0.08);
    parts.push(mixSamples(main, pad));
    totalLen += noteDur;
    idx++;
  }
  return concatSamples(...parts);
}

function generateZen(duration: number): number[] {
  const totalSamples = Math.floor(SAMPLE_RATE * duration);
  const result = new Array(totalSamples).fill(0);
  const baseFreqs = [174.61, 196.00, 220.00, 261.63];
  for (let i = 0; i < totalSamples; i++) {
    const t = i / SAMPLE_RATE;
    for (const freq of baseFreqs) {
      const mod = 1 + 0.5 * Math.sin(2 * Math.PI * 0.03 * t);
      result[i] += Math.sin(2 * Math.PI * freq * t) * 0.06 * mod;
    }
    const bell = Math.sin(2 * Math.PI * 880 * t) * 0.08 *
      Math.exp(-((t % 8) - 0) * 3) * (t % 8 < 1 ? 1 : 0);
    result[i] += bell;
  }
  return applyEnvelope(result, 3000, 3000, SAMPLE_RATE);
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
