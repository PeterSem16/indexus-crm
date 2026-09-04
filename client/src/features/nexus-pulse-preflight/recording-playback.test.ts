import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  beginPulseRecordingPlayback,
  isPulseRecordingPlaybackActive,
} from "./recording-playback";

describe("Pulse recording playback protection", () => {
  const releases: Array<() => void> = [];

  beforeEach(() => {
    vi.stubGlobal("window", { dispatchEvent: vi.fn() });
    vi.stubGlobal("CustomEvent", class {
      type: string;
      detail: unknown;
      constructor(type: string, init?: { detail?: unknown }) {
        this.type = type;
        this.detail = init?.detail;
      }
    });
  });

  afterEach(() => {
    releases.splice(0).forEach((release) => release());
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("remains active until every playback lease is released", () => {
    const dispatchEvent = vi.mocked(window.dispatchEvent);
    const releaseFirst = beginPulseRecordingPlayback();
    const releaseSecond = beginPulseRecordingPlayback();
    releases.push(releaseFirst, releaseSecond);

    expect(isPulseRecordingPlaybackActive()).toBe(true);

    releaseFirst();
    expect(isPulseRecordingPlaybackActive()).toBe(true);

    releaseSecond();
    expect(isPulseRecordingPlaybackActive()).toBe(false);
    expect(dispatchEvent).toHaveBeenLastCalledWith(expect.objectContaining({
      type: "nexus-pulse-recording-playback",
    }));
  });

  it("allows a playback lease to be released more than once safely", () => {
    const release = beginPulseRecordingPlayback();
    releases.push(release);

    release();
    release();

    expect(isPulseRecordingPlaybackActive()).toBe(false);
  });
});