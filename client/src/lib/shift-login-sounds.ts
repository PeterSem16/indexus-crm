type ShiftLoginSound =
  | "welcome"
  | "mission"
  | "inbound"
  | "backOffice"
  | "setApply"
  | "setCreate"
  | "start";

type AudioGraph = {
  context: AudioContext;
  input: GainNode;
};

let graph: AudioGraph | null = null;

function createImpulse(context: AudioContext, duration = 1.35, decay = 3.2) {
  const length = Math.floor(context.sampleRate * duration);
  const impulse = context.createBuffer(2, length, context.sampleRate);
  for (let channel = 0; channel < impulse.numberOfChannels; channel += 1) {
    const data = impulse.getChannelData(channel);
    for (let index = 0; index < length; index += 1) {
      data[index] = (Math.random() * 2 - 1) * Math.pow(1 - index / length, decay);
    }
  }
  return impulse;
}

function getAudioGraph(): AudioGraph | null {
  if (typeof window === "undefined") return null;
  if (graph) return graph;
  const AudioContextConstructor = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextConstructor) return null;

  const context = new AudioContextConstructor() as AudioContext;
  const input = context.createGain();
  const dry = context.createGain();
  const wet = context.createGain();
  const reverb = context.createConvolver();
  const compressor = context.createDynamicsCompressor();
  const output = context.createGain();

  dry.gain.value = 0.78;
  wet.gain.value = 0.22;
  output.gain.value = 0.72;
  reverb.buffer = createImpulse(context);
  compressor.threshold.value = -22;
  compressor.knee.value = 18;
  compressor.ratio.value = 4;
  compressor.attack.value = 0.004;
  compressor.release.value = 0.18;

  input.connect(dry);
  input.connect(reverb);
  reverb.connect(wet);
  dry.connect(compressor);
  wet.connect(compressor);
  compressor.connect(output);
  output.connect(context.destination);
  graph = { context, input };
  return graph;
}

function ambientVoice(
  audio: AudioGraph,
  frequency: number,
  start: number,
  duration: number,
  volume: number,
  options: { attack?: number; detune?: number; endFrequency?: number; brightness?: number } = {},
) {
  const { context, input } = audio;
  const gain = context.createGain();
  const filter = context.createBiquadFilter();
  const attack = options.attack ?? Math.min(0.055, duration * 0.24);
  const detune = options.detune ?? 6;
  const brightness = options.brightness ?? 2600;

  filter.type = "lowpass";
  filter.Q.value = 0.55;
  filter.frequency.setValueAtTime(700, start);
  filter.frequency.exponentialRampToValueAtTime(brightness, start + attack * 1.4);
  filter.frequency.exponentialRampToValueAtTime(850, start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + attack);
  gain.gain.setValueAtTime(volume, start + Math.max(attack, duration * 0.42));
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  filter.connect(gain);
  gain.connect(input);

  [-detune, detune].forEach((cents, index) => {
    const oscillator = context.createOscillator();
    oscillator.type = index === 0 ? "sine" : "sine";
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.detune.setValueAtTime(cents, start);
    if (options.endFrequency) {
      oscillator.frequency.exponentialRampToValueAtTime(options.endFrequency, start + duration);
    }
    oscillator.connect(filter);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.03);
  });
}

function shimmer(audio: AudioGraph, start: number, duration: number, volume: number, center = 4200) {
  const { context, input } = audio;
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < data.length; index += 1) {
    data[index] = Math.random() * 2 - 1;
  }
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  source.buffer = buffer;
  filter.type = "bandpass";
  filter.frequency.value = center;
  filter.Q.value = 1.1;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + duration * 0.28);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(input);
  source.start(start);
  source.stop(start + duration);
}

function chord(
  audio: AudioGraph,
  frequencies: number[],
  start: number,
  duration: number,
  volume: number,
  stagger = 0.018,
  brightness = 2600,
) {
  frequencies.forEach((frequency, index) => {
    ambientVoice(audio, frequency, start + index * stagger, duration, volume, {
      attack: Math.min(0.06, duration * 0.2),
      detune: 5 + index,
      brightness: brightness + index * 240,
    });
  });
}

export async function playShiftLoginSound(sound: ShiftLoginSound, selected = true): Promise<void> {
  try {
    const audio = getAudioGraph();
    if (!audio) return;
    const { context } = audio;
    if (context.state === "suspended") await context.resume();
    const now = context.currentTime + 0.018;

    if (sound === "welcome") {
      chord(audio, [293.66, 369.99, 440, 554.37], now, 1.12, 0.009, 0.045, 2300);
      ambientVoice(audio, 146.83, now, 1.18, 0.012, { attack: 0.12, endFrequency: 220, brightness: 1100 });
      shimmer(audio, now + 0.08, 0.92, 0.006, 5200);
      return;
    }

    if (sound === "mission") {
      const notes = selected ? [523.25, 659.25, 783.99] : [659.25, 523.25];
      chord(audio, notes, now, selected ? 0.46 : 0.28, selected ? 0.009 : 0.006, 0.02, 3400);
      if (selected) shimmer(audio, now + 0.04, 0.28, 0.0035, 5600);
      return;
    }

    if (sound === "inbound") {
      const notes = selected ? [440, 554.37, 659.25] : [554.37, 440];
      chord(audio, notes, now, selected ? 0.5 : 0.3, selected ? 0.0095 : 0.006, 0.025, 2800);
      if (selected) ambientVoice(audio, 220, now, 0.48, 0.005, { attack: 0.045, endFrequency: 293.66, brightness: 1250 });
      return;
    }

    if (sound === "backOffice") {
      const notes = selected ? [349.23, 440, 523.25] : [440, 349.23];
      chord(audio, notes, now, selected ? 0.56 : 0.32, selected ? 0.009 : 0.0055, 0.03, 2200);
      ambientVoice(audio, selected ? 174.61 : 220, now, 0.52, 0.006, { attack: 0.06, brightness: 950 });
      return;
    }

    if (sound === "setApply") {
      ambientVoice(audio, 220, now, 0.52, 0.007, { attack: 0.08, endFrequency: 329.63, brightness: 1500 });
      chord(audio, [440, 554.37, 659.25], now + 0.08, 0.46, 0.0075, 0.022, 3000);
      shimmer(audio, now + 0.03, 0.4, 0.003, 4800);
      return;
    }

    if (sound === "setCreate") {
      chord(audio, [493.88, 659.25, 783.99, 987.77], now, 0.7, 0.0075, 0.045, 3600);
      shimmer(audio, now + 0.06, 0.58, 0.005, 6200);
      return;
    }

    ambientVoice(audio, 130.81, now, 1.0, 0.014, { attack: 0.1, endFrequency: 261.63, brightness: 1200 });
    chord(audio, [392, 493.88, 587.33, 783.99], now + 0.06, 0.9, 0.01, 0.05, 3000);
    shimmer(audio, now + 0.16, 0.72, 0.006, 5800);
  } catch {
    // Audio feedback is progressive enhancement; shift login must always remain usable.
  }
}