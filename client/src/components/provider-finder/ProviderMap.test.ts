import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { transformSync } from "esbuild";
import { JSDOM } from "jsdom";

// Execute the real marker effect with DOM buttons and controlled SDK failures.
// No Google credentials, customer records or backend fixtures are needed.
function setup(failure: "origin" | "result" | "bounds" | "viewport" | "dispose" | null) {
  const dom = new JSDOM();
  const effects: (() => void | (() => void))[] = [];
  const instances: any[] = [];
  const selected: string[] = [];
  let attempts = 0;
  class Marker {
    content: HTMLElement;
    attached: unknown = null;
    constructor(options: { content: HTMLElement }) {
      attempts++;
      if (failure === "origin" || failure === "result" && attempts === 3)
        throw new TypeError("Cannot read properties of undefined (reading 'keys')");
      this.content = options.content;
      instances.push(this);
    }
    set map(value: unknown) {
      if (failure === "dispose" && value === null) throw new Error("SDK disposal failed");
      this.attached = value;
    }
  }
  class Bounds {
    constructor() { if (failure === "bounds") throw new Error("SDK bounds failed"); }
    extend() {}
  }
  const map = {
    fitBounds() { if (failure === "viewport") throw new Error("SDK viewport failed"); },
    setCenter() {},
  };
  const state: any[] = [{ map, Marker, Bounds }, "", true];
  let stateIndex = 0;
  const react = {
    useEffect(effect: () => void | (() => void)) { effects.push(effect); },
    useRef(current: unknown) { return { current }; },
    useState() {
      const index = stateIndex++;
      return [state[index], (value: unknown) => { state[index] = value; }];
    },
  };
  const module = { exports: {} as any };
  const source = transformSync(
    readFileSync(new URL("./ProviderMap.tsx", import.meta.url), "utf8"),
    { loader: "tsx", format: "cjs", jsx: "automatic" },
  ).code;
  runInNewContext(source, {
    document: dom.window.document, window: dom.window, module, exports: module.exports,
    require(name: string) {
      if (name === "react") return react;
      if (name === "react/jsx-runtime") return { jsx: () => null, jsxs: () => null };
      if (name === "./api" || name === "./google-maps-loader") return {};
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  module.exports.ProviderMap({
    prefix: "/fixture", point: { lat: 48.19, lng: 17.04 },
    results: [
      { id: "one", type: "clinic", name: "First", lat: 48.2, lng: 17.05 },
      { id: "two", type: "hospital", name: "Second", lat: 48.21, lng: 17.06 },
    ],
    onSelect: (id: string) => selected.push(id),
    c: { origin: "Origin", mapUnavailable: "Map unavailable", map: "Map", loading: "Loading" },
  });
  return {
    state, instances, selected, map,
    draw: effects[1],
    close: () => dom.window.close(),
  };
}

test("SDK marker/bounds/viewport failures do not escape the React effect", () => {
  for (const failure of ["origin", "result", "bounds", "viewport"] as const) {
    const s = setup(failure);
    try {
      let cleanup: void | (() => void);
      assert.doesNotThrow(() => { cleanup = s.draw(); }, failure);
      assert.equal(s.state[1], "Map unavailable");
      assert.equal(s.state[2], false);
      for (const marker of s.instances) {
        assert.equal(marker.attached, null, "dispose every successfully created marker");
        marker.content.click();
      }
      assert.deepEqual(s.selected, [], "failed batches leave no active selection listeners");
      assert.doesNotThrow(() => cleanup?.(), "cleanup remains idempotent");
    } finally { s.close(); }
  }
});

test("normal markers preserve selection and clean up listeners and map attachments", () => {
  const s = setup(null);
  try {
    const cleanup = s.draw();
    assert.equal(s.state[1], "");
    assert.equal(s.instances.length, 3);
    assert.ok(s.instances.every(marker => marker.attached === s.map));
    s.instances[1].content.click();
    s.instances[2].content.click();
    assert.deepEqual(s.selected, ["clinic:one", "hospital:two"]);
    cleanup?.();
    s.instances[1].content.click();
    assert.equal(s.selected.length, 2);
    assert.ok(s.instances.every(marker => marker.attached === null));
  } finally { s.close(); }
});

test("SDK disposal errors cannot crash dialog close", () => {
  const s = setup("dispose");
  try {
    const cleanup = s.draw();
    assert.doesNotThrow(() => cleanup?.());
    for (const marker of s.instances) marker.content.click();
    assert.deepEqual(s.selected, []);
  } finally { s.close(); }
});
