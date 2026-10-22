import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { transformSync } from "esbuild";

function sandbox() {
  const timers = new Map<number, () => void>();
  const scripts: any[] = [];
  let serial = 0;
  const previous = () => {};
  const window: any = {
    gm_authFailure: previous,
    customElements: { whenDefined: async () => {} },
    setTimeout(fn: () => void) { timers.set(++serial, fn); return serial; },
    clearTimeout(id: number) { timers.delete(id); },
  };
  const module = { exports: {} as any };
  const source = transformSync(readFileSync(new URL("./google-maps-loader.ts", import.meta.url), "utf8"), { loader: "ts", format: "cjs" }).code;
  runInNewContext(source, { window, URLSearchParams, module, exports: module.exports, document: {
    createElement: () => ({ removed: false, remove() { this.removed = true; } }),
    head: { appendChild(script: any) { scripts.push(script); } },
  } });
  return { api: module.exports, window, previous, scripts, timers };
}
test("shared Google loader uses callback/async loading, resolves only when ready, and restores global auth handler", async () => {
  const s = sandbox();
  const a = s.api.loadGoogleMaps("synthetic-browser-test-only");
  const b = s.api.loadGoogleMaps("synthetic-browser-test-only");
  assert.equal(a, b);
  assert.equal(s.scripts.length, 1);
  const url = new URL(s.scripts[0].src);
  assert.equal(url.searchParams.get("loading"), "async");
  assert.ok(url.searchParams.get("callback"));
  assert.equal(s.scripts[0].onload, undefined, "script load alone is not Google API readiness");
  s.window.google = { maps: { importLibrary: async () => ({}) } };
  s.window[url.searchParams.get("callback")!]();
  assert.equal(await a, s.window.google.maps);
  assert.equal(s.timers.size, 0);
  assert.equal(s.window.gm_authFailure, s.previous);
  assert.equal(await s.api.loadGoogleMaps("synthetic-browser-test-only"), s.window.google.maps);
  assert.equal(s.scripts.length, 1);
});
test("script errors/timeouts remove callbacks and auth listeners; a subsequent attempt may retry", async () => {
  for (const cause of ["error", "timeout"]) {
    const s = sandbox();
    const pending = s.api.loadGoogleMaps("synthetic-browser-test-only");
    const rejection = assert.rejects(pending, { message: "maps_unavailable" });
    const oldReady = s.window.__indexusProviderMapsReady;
    if (cause === "error") s.scripts[0].onerror();
    else for (const timer of [...s.timers.values()]) timer();
    await rejection;
    assert.equal(s.scripts[0].removed, true);
    assert.equal(s.window.__indexusProviderMapsReady, undefined);
    assert.equal(s.window.gm_authFailure, s.previous);
    oldReady(); // A captured late callback cannot settle a newer attempt.
    const retry = s.api.loadGoogleMaps("synthetic-browser-test-only");
    const retried = assert.rejects(retry, { message: "maps_unavailable" });
    assert.equal(s.scripts.length, 2);
    s.scripts[1].onerror();
    await retried;
  }
});
test("Google authorization rejection is distinct and cleanup is idempotent", async () => {
  const s = sandbox();
  const pending = s.api.loadGoogleMaps("synthetic-browser-test-only");
  const rejected = assert.rejects(pending, { message: "maps_auth" });
  s.window.gm_authFailure();
  await rejected;
  assert.equal(s.window.gm_authFailure, s.previous);
  assert.equal(s.timers.size, 0);
});
test("library imports have bounded timeout and restore auth listeners on every outcome", async () => {
  const success = sandbox();
  const libraries = await success.api.importGoogleMapsLibraries({ importLibrary: async (name: string) => name });
  assert.deepEqual(Array.from(libraries), ["maps", "marker", "core"]);
  assert.equal(success.timers.size, 0);
  assert.equal(success.window.gm_authFailure, success.previous);
  for (const cause of ["timeout", "auth"]) {
    const s = sandbox();
    const pending = s.api.importGoogleMapsLibraries({ importLibrary: () => new Promise(() => {}) });
    const rejected = assert.rejects(pending, { message: cause === "auth" ? "maps_auth" : "maps_unavailable" });
    if (cause === "auth") s.window.gm_authFailure();
    else for (const timer of [...s.timers.values()]) timer();
    await rejected;
    assert.equal(s.timers.size, 0);
    assert.equal(s.window.gm_authFailure, s.previous);
  }
});
test("library readiness waits for advanced-marker registration and bounds that wait", async () => {
  const s = sandbox();
  let registered!: () => void;
  s.window.customElements.whenDefined = (name: string) => {
    assert.equal(name, "gmp-advanced-marker");
    return new Promise<void>(resolve => { registered = resolve; });
  };
  let ready = false;
  const pending = s.api.importGoogleMapsLibraries({ importLibrary: async (name: string) => name })
    .then((libraries: unknown) => { ready = true; return libraries; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(ready, false, "imported classes alone do not mean the custom element is initialized");
  assert.equal(s.timers.size, 1);
  registered();
  assert.deepEqual(Array.from(await pending), ["maps", "marker", "core"]);
  assert.equal(s.timers.size, 0);

  const stalled = sandbox();
  stalled.window.customElements.whenDefined = () => new Promise(() => {});
  const waiting = stalled.api.importGoogleMapsLibraries({ importLibrary: async () => ({}) });
  const rejected = assert.rejects(waiting, { message: "maps_unavailable" });
  for (const timer of [...stalled.timers.values()]) timer();
  await rejected;
  assert.equal(stalled.timers.size, 0);
  assert.equal(stalled.window.gm_authFailure, stalled.previous);
});
