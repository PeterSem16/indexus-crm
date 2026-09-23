/** Short, locally synthesized stereo D-major-nine sound for the output check. */
export const AMBIENT_TEST_DURATION = 4.2;

export function renderAmbientTestSound(sampleRate: number): [Float32Array, Float32Array] {
  const length = Math.ceil(sampleRate * AMBIENT_TEST_DURATION);
  const left = new Float32Array(length);
  const right = new Float32Array(length);
  const chord = [146.832, 220, 293.665, 369.994, 440, 554.365, 659.255];
  const tau = Math.PI * 2;
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const attack = Math.min(1, t / 0.18);
    const release = Math.max(0, Math.min(1, (3.1 - t) / 1.4));
    const envelope = Math.sin(attack * Math.PI / 2) ** 2 * release ** 2;
    for (let voice = 0; voice < chord.length; voice++) {
      const frequency = chord[voice];
      const shimmer = 0.18 * Math.sin(tau * 0.24 * t + voice);
      const pad = (
        Math.sin(tau * frequency * t + shimmer)
        + 0.28 * Math.sin(tau * frequency * 1.002 * t)
        + 0.12 * Math.sin(tau * frequency * 2 * t)
      ) * envelope * (voice < 2 ? 0.042 : 0.028);
      const pan = Math.sin(t * 0.85 + voice * 1.1) * 0.72;
      left[i] += pad * Math.cos((pan + 1) * Math.PI / 4);
      right[i] += pad * Math.sin((pan + 1) * Math.PI / 4);
      // Soft, staggered upper partials: bright enough to hear, never a sharp beep.
      const age = t - (0.12 + voice * 0.15);
      if (age >= 0) {
        const bell = Math.min(1, age / 0.035) ** 2 * Math.exp(-age * 2.7)
          * (Math.sin(tau * frequency * 2 * age)
            + 0.16 * Math.sin(tau * frequency * 4.005 * age)) * 0.027;
        left[i] += bell * (voice % 2 ? 0.35 : 0.85);
        right[i] += bell * (voice % 2 ? 0.85 : 0.35);
      }
    }
  }
  // Unequal cross-channel reflections create space without antiphase widening.
  const dryLeft = left.slice();
  const dryRight = right.slice();
  for (const [seconds, gain] of [[0.113, 0.2], [0.197, 0.15], [0.307, 0.11], [0.431, 0.075], [0.617, 0.045]]) {
    const delay = Math.round(seconds * sampleRate);
    for (let i = delay; i < length; i++) {
      left[i] += dryRight[i - delay] * gain;
      right[i] += dryLeft[i - delay] * gain * 0.91;
    }
  }
  let peak = 0;
  for (let i = 0; i < length; i++) peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
  const gain = peak > 0 ? Math.min(1, 0.22 / peak) : 1;
  for (let i = 0; i < length; i++) {
    const fade = Math.min(1, (length - 1 - i) / (sampleRate * 0.3));
    left[i] *= gain * fade;
    right[i] *= gain * fade;
  }
  return [left, right];
}