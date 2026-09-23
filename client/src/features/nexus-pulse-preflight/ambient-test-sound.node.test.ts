import assert from "node:assert/strict";
import test from "node:test";
import { AMBIENT_TEST_DURATION, renderAmbientTestSound } from "./ambient-test-sound";

for (const sampleRate of [44100, 48000]) {
  test(`ambient test at ${sampleRate} Hz is bounded, stereo, mono-compatible and fades out`, () => {
    const [left, right] = renderAmbientTestSound(sampleRate);
    assert.equal(left.length, Math.ceil(sampleRate * AMBIENT_TEST_DURATION));
    let peak = 0, energy = 0, monoEnergy = 0, stereoDifference = 0;
    for (let i = 0; i < left.length; i++) {
      assert.ok(Number.isFinite(left[i]) && Number.isFinite(right[i]));
      peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
      energy += (left[i] ** 2 + right[i] ** 2) / 2;
      monoEnergy += ((left[i] + right[i]) / 2) ** 2;
      stereoDifference += (left[i] - right[i]) ** 2;
    }
    assert.ok(peak > 0.1 && peak <= 0.220001);
    assert.ok(stereoDifference > 1);
    assert.ok(monoEnergy / energy > 0.6);
    assert.equal(left[0], 0);
    assert.equal(right[0], 0);
    assert.ok(Math.abs(left[left.length - 1]) === 0);
    assert.ok(Math.abs(right[right.length - 1]) === 0);
  });
}