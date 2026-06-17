/**
 * Lightweight, framework-free tests for the Back Office new-task alert.
 *
 * Run with:  npx tsx client/src/lib/back-office-alert.test.ts
 *
 * These guard the dedup contract that keeps an agent from hearing the chime
 * twice (or seeing the toast twice) for a single task when `useNotifications()`
 * is mounted in two places at once (the bell + the notifications page), each
 * with its own WebSocket delivering the same notification.
 *
 * No test runner / jsdom is needed: `dispatchBackOfficeAlert` is pure, and the
 * chime helpers only touch `window` / `localStorage` / `AudioContext`, which we
 * stub on the global object below before importing them.
 */

import assert from "node:assert/strict";

// ---------------------------------------------------------------------------
// Minimal browser-global stubs (installed before importing the chime module).
// ---------------------------------------------------------------------------

let oscillatorsCreated = 0;
let lastCtxState: "running" | "suspended" = "running";

class FakeParam {
  setValueAtTime() {}
  exponentialRampToValueAtTime() {}
}
class FakeOscillator {
  type = "";
  frequency = new FakeParam();
  connect() {}
  start() {}
  stop() {}
}
class FakeGain {
  gain = new FakeParam();
  connect() {}
}
class FakeAudioContext {
  state = lastCtxState;
  currentTime = 0;
  destination = {};
  constructor() {
    this.state = lastCtxState;
  }
  createOscillator() {
    oscillatorsCreated++;
    return new FakeOscillator();
  }
  createGain() {
    return new FakeGain();
  }
  resume() {
    return Promise.resolve();
  }
}

const localStorageStore = new Map<string, string>();
const fakeLocalStorage = {
  getItem: (k: string) => (localStorageStore.has(k) ? localStorageStore.get(k)! : null),
  setItem: (k: string, v: string) => void localStorageStore.set(k, String(v)),
  removeItem: (k: string) => void localStorageStore.delete(k),
  clear: () => localStorageStore.clear(),
};

(globalThis as any).window = globalThis;
(globalThis as any).AudioContext = FakeAudioContext;
(globalThis as any).localStorage = fakeLocalStorage;

// Import AFTER the globals are in place so getCtx()/isBackOfficeSoundMuted() see them.
const { dispatchBackOfficeAlert, __resetBackOfficeAlertDedup } = await import("./back-office-alert");
const { playBackOfficeChime, setBackOfficeSoundMuted } = await import("./back-office-chime");

// ---------------------------------------------------------------------------
// Tiny test harness.
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;
const failures: string[] = [];

function test(name: string, fn: () => void) {
  __resetBackOfficeAlertDedup();
  oscillatorsCreated = 0;
  localStorageStore.clear();
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    failures.push(name);
    console.log(`  ✗ ${name}`);
    console.log(`    ${(err as Error).message.split("\n").join("\n    ")}`);
  }
}

function makeNotif(id: string, opts: { isBackOffice?: boolean } = {}) {
  return {
    id,
    title: `Task ${id}`,
    metadata: { isBackOffice: opts.isBackOffice ?? true, taskTitle: `BO ${id}` },
  };
}

function spy() {
  const fn = ((...args: any[]) => {
    fn.calls.push(args);
  }) as ((...args: any[]) => void) & { calls: any[][] };
  fn.calls = [];
  return fn;
}

// ---------------------------------------------------------------------------
// Dedup across two concurrent mounts.
// ---------------------------------------------------------------------------

console.log("dispatchBackOfficeAlert");

test("two concurrent mounts fire the chime + toast exactly once", () => {
  const playChime = spy();
  const showToast = spy();
  const notif = makeNotif("n1");

  // Simulate two live useNotifications() mounts (bell + page), each receiving
  // the same notification over its own WebSocket.
  const firedMountA = dispatchBackOfficeAlert(notif, { playChime, showToast });
  const firedMountB = dispatchBackOfficeAlert(notif, { playChime, showToast });

  assert.equal(firedMountA, true, "first mount should fire");
  assert.equal(firedMountB, false, "second mount must be deduped");
  assert.equal(playChime.calls.length, 1, "chime should play exactly once");
  assert.equal(showToast.calls.length, 1, "toast should show exactly once");
});

test("a different task still fires its own alert", () => {
  const playChime = spy();
  const showToast = spy();

  dispatchBackOfficeAlert(makeNotif("a"), { playChime, showToast });
  dispatchBackOfficeAlert(makeNotif("a"), { playChime, showToast });
  dispatchBackOfficeAlert(makeNotif("b"), { playChime, showToast });

  assert.equal(playChime.calls.length, 2, "two distinct tasks → two chimes");
  assert.equal(showToast.calls.length, 2, "two distinct tasks → two toasts");
});

test("non-Back-Office notifications never fire the alert", () => {
  const playChime = spy();
  const showToast = spy();

  assert.equal(
    dispatchBackOfficeAlert(makeNotif("x", { isBackOffice: false }), { playChime, showToast }),
    false,
  );
  assert.equal(dispatchBackOfficeAlert(null, { playChime, showToast }), false);
  assert.equal(dispatchBackOfficeAlert(undefined, { playChime, showToast }), false);
  assert.equal(playChime.calls.length, 0);
  assert.equal(showToast.calls.length, 0);
});

// ---------------------------------------------------------------------------
// Mute path: no chime, toast still shown.
// ---------------------------------------------------------------------------

test("muted: no chime is produced, but the toast still shows", () => {
  setBackOfficeSoundMuted(true);
  const showToast = spy();

  // Use the REAL chime so the mute check inside playBackOfficeChime is exercised.
  const fired = dispatchBackOfficeAlert(makeNotif("muted-1"), {
    playChime: playBackOfficeChime,
    showToast,
  });

  assert.equal(fired, true);
  assert.equal(oscillatorsCreated, 0, "muted → no audio tones scheduled");
  assert.equal(showToast.calls.length, 1, "toast must still show while muted");
});

test("not muted: the real chime schedules audio tones", () => {
  setBackOfficeSoundMuted(false);
  lastCtxState = "running";
  const showToast = spy();

  dispatchBackOfficeAlert(makeNotif("audible-1"), {
    playChime: playBackOfficeChime,
    showToast,
  });

  assert.ok(oscillatorsCreated > 0, "unmuted → chime schedules tones");
  assert.equal(showToast.calls.length, 1);
});

// ---------------------------------------------------------------------------
// Autoplay-blocked path: chime fails, toast still shown.
// ---------------------------------------------------------------------------

test("autoplay blocked (chime throws): the toast is still shown", () => {
  const showToast = spy();
  const throwingChime = () => {
    throw new Error("NotAllowedError: autoplay blocked");
  };

  const fired = dispatchBackOfficeAlert(makeNotif("blocked-1"), {
    playChime: throwingChime,
    showToast,
  });

  assert.equal(fired, true);
  assert.equal(showToast.calls.length, 1, "a blocked chime must not suppress the toast");
});

test("real chime never throws when no AudioContext is available", () => {
  const saved = (globalThis as any).AudioContext;
  (globalThis as any).AudioContext = undefined;
  try {
    assert.doesNotThrow(() => playBackOfficeChime());
  } finally {
    (globalThis as any).AudioContext = saved;
  }
});

// ---------------------------------------------------------------------------
// Summary.
// ---------------------------------------------------------------------------

console.log("");
console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log(`Failed: ${failures.join(", ")}`);
  process.exit(1);
}
