import { renderAmbientTestSound } from "../features/nexus-pulse-preflight/ambient-test-sound";

type ShiftLoginSound =
  | "welcome"
  | "mission"
  | "inbound"
  | "backOffice"
  | "setApply"
  | "setCreate"
  | "start"
  | "breakStart"
  | "breakEnd";

type AudioGraph = {
  context: AudioContext;
  input: GainNode;
};

let graph: AudioGraph | null = null;
let activeEnvelope: GainNode | null = null;
let requestId = 0;
let ambientBuffer: AudioBuffer | null = null;

function createImpulse(context: AudioContext, duration = 2.6, decay = 2.8) {
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

  dry.gain.value = 0.7;
  wet.gain.value = 0.35;
  output.gain.value = 0.65;
  reverb.buffer = createImpulse(context);
  compressor.threshold.value = -22;
  compressor.knee.value = 18;
  compressor.ratio.value = 4;
  compressor.attack.value = 0.004;
  compressor.release.value = 0.18;

  input.connect(dry);
  input.connect(reverb);
  // Quiet lateral early reflections put the clear direct sound in a larger
  // space. No feedback loop or phase inversion: the cues remain mono-safe.
  for (const [seconds, pan, level] of [[0.137, -0.9, 0.15], [0.223, 0.9, 0.12], [0.367, -0.55, 0.07]]) {
    const delay = context.createDelay(1);
    const reflection = context.createGain();
    const position = context.createStereoPanner();
    const damping = context.createBiquadFilter();
    delay.delayTime.value = seconds;
    reflection.gain.value = level;
    position.pan.value = pan;
    damping.type = "lowpass";
    damping.frequency.value = 2800;
    input.connect(delay).connect(damping).connect(position).connect(reflection).connect(compressor);
  }
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
  options: { attack?: number; detune?: number; endFrequency?: number; brightness?: number; pan?: number } = {},
) {
  const { context, input } = audio;
  const gain = context.createGain();
  const filter = context.createBiquadFilter();
  const panner = context.createStereoPanner();
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
  gain.connect(panner);
  panner.connect(input);
  const pan = options.pan ?? 0;
  panner.pan.setValueAtTime(pan, start);
  panner.pan.linearRampToValueAtTime(-pan * 0.95, start + duration * 0.65);
  panner.pan.linearRampToValueAtTime(pan * 0.3, start + duration);

  const spectrum = context.createPeriodicWave(
    new Float32Array(6),
    new Float32Array([0, 1, 0.24, 0.09, 0.025, 0.035]),
  );

  [-detune, detune].forEach((cents, index) => {
    const oscillator = context.createOscillator();
    oscillator.setPeriodicWave(spectrum);
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.detune.setValueAtTime(cents, start);
    oscillator.detune.linearRampToValueAtTime(-cents * 0.6, start + duration);
    if (options.endFrequency) {
      oscillator.frequency.exponentialRampToValueAtTime(options.endFrequency, start + duration);
    }
    oscillator.connect(filter);
    oscillator.onended = () => {
      oscillator.disconnect();
      if (index === 1) { filter.disconnect(); gain.disconnect(); panner.disconnect(); }
    };
    oscillator.start(start);
    oscillator.stop(start + duration + 0.03);
  });
}

function shimmer(audio: AudioGraph, start: number, duration: number, volume: number, center = 4200) {
  const fundamental = center >= 5600 ? 659.25 : 587.33;
  [1, 1.5, 2].forEach((ratio, index) => {
    ambientVoice(audio, fundamental * ratio, start + index * 0.025, duration, volume * 0.42, {
      attack: Math.min(0.1, duration * 0.25), detune: 2,
      brightness: 3200, pan: (index - 1) * 0.7,
    });
  });
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
      pan: frequencies.length > 1 ? (index / (frequencies.length - 1) - 0.5) * 1.3 : 0,
    });
  });
}

export async function playShiftLoginSound(sound: ShiftLoginSound, selected = true): Promise<void> {
  const request = ++requestId;
  try {
    const shared = getAudioGraph();
    if (!shared) return;
    const { context } = shared;
    if (context.state === "suspended") await context.resume();
    if (request !== requestId) return;
    // Rapid selections gently replace the preceding cue rather than piling up.
    if (activeEnvelope) {
      activeEnvelope.gain.cancelScheduledValues(context.currentTime);
      activeEnvelope.gain.setValueAtTime(activeEnvelope.gain.value, context.currentTime);
      activeEnvelope.gain.linearRampToValueAtTime(0, context.currentTime + 0.035);
    }
    const envelope = context.createGain();
    envelope.connect(shared.input);
    activeEnvelope = envelope;
    const audio = { context, input: envelope };
    window.setTimeout(() => {
      envelope.disconnect();
      if (activeEnvelope === envelope) activeEnvelope = null;
    }, 8000);
    const now = context.currentTime + 0.018;

    if (sound === "welcome" || sound === "start") {
      if (!ambientBuffer) {
        const channels = renderAmbientTestSound(context.sampleRate);
        ambientBuffer = context.createBuffer(2, channels[0].length, context.sampleRate);
        ambientBuffer.getChannelData(0).set(channels[0]);
        ambientBuffer.getChannelData(1).set(channels[1]);
      }
      const source = context.createBufferSource();
      source.buffer = ambientBuffer;
      source.playbackRate.value = sound === "start" ? 1.12246 : 1;
      envelope.gain.value = sound === "start" ? 0.5 : 0.42;
      source.connect(envelope);
      source.onended = () => source.disconnect();
      source.start(context.currentTime + 0.018);
      // Floating octave/fifth partials travel independently above the pad.
      // These are deliberately much quieter than the original sound.
      for (const [ratio, pan, offset, level] of [[2, -0.85, 0.14, 0.11], [3, 0.85, 0.34, 0.055]]) {
        const overtone = context.createBufferSource();
        const glow = context.createGain();
        const position = context.createStereoPanner();
        const filter = context.createBiquadFilter();
        overtone.buffer = ambientBuffer;
        overtone.playbackRate.value = source.playbackRate.value * ratio;
        const begin = context.currentTime + offset;
        const end = begin + ambientBuffer.duration / overtone.playbackRate.value;
        glow.gain.setValueAtTime(0, begin);
        glow.gain.linearRampToValueAtTime(level, begin + 0.28);
        glow.gain.linearRampToValueAtTime(0, end);
        position.pan.setValueAtTime(pan, begin);
        position.pan.linearRampToValueAtTime(-pan, end);
        filter.type = "lowpass";
        filter.frequency.value = 3600;
        overtone.connect(filter).connect(glow).connect(position).connect(envelope);
        overtone.onended = () => {
          overtone.disconnect(); filter.disconnect(); glow.disconnect(); position.disconnect();
        };
        overtone.start(begin);
      }
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

    if (sound === "breakStart") {
      // Settle gently from the workday into a soft, descending spectral pad.
      ambientVoice(audio, 392, now, 0.62, 0.005, {
        attack: 0.07, endFrequency: 293.66, brightness: 1900, pan: -0.45,
      });
      chord(audio, [349.23, 293.66, 220], now + 0.075, 0.75, 0.006, 0.085, 2000);
      shimmer(audio, now + 0.12, 0.28, 0.0016, 4800);
      return;
    }

    if (sound === "breakEnd") {
      // A distinct, lightly ascending cue for returning to the shift.
      ambientVoice(audio, 220, now, 0.55, 0.005, {
        attack: 0.06, endFrequency: 329.63, brightness: 2300, pan: 0.4,
      });
      chord(audio, [329.63, 440, 554.37, 659.25], now + 0.07, 0.62, 0.0065, 0.065, 3200);
      shimmer(audio, now + 0.12, 0.38, 0.0028, 5600);
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

  } catch {
    // Audio feedback is progressive enhancement; shift login must always remain usable.
  }
}