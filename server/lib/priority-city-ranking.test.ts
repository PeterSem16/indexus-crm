import assert from "node:assert/strict";
import test from "node:test";
import {
  createPriorityCityRankingService,
  PriorityCityRankingError,
  type PriorityCityLocation,
} from "./priority-city-ranking";
import { normalizeCityLocation } from "@shared/priority-city";

function location(country: string, city: string): PriorityCityLocation {
  const normalized = normalizeCityLocation(country, city);
  assert.ok(normalized);
  return normalized;
}

const bratislava = location("SK", "Bratislava");
const prague = location("CZ", "Praha");
const springfield = location("US", "Springfield");

function payload(locations: PriorityCityLocation[]) {
  return { cities: locations };
}

test("recomputes keys and rejects forged, duplicate, and oversized locations", async () => {
  const service = createPriorityCityRankingService({
    provider: async (locations) => ({
      rankedIds: locations.map((_, index) => String(index)),
      unknownIds: [],
    }),
  });

  await assert.rejects(
    service.rank("agent-1", payload([{ ...bratislava, key: "US:bratislava" }])),
    (error: unknown) => error instanceof PriorityCityRankingError && error.code === "INVALID_INPUT",
  );
  await assert.rejects(
    service.rank("agent-1", payload([bratislava, bratislava])),
    (error: unknown) => error instanceof PriorityCityRankingError && error.code === "INVALID_INPUT",
  );
  await assert.rejects(
    service.rank("agent-1", payload([{
      ...bratislava,
      city: "x".repeat(201),
      key: "SK:" + "x".repeat(201),
    }])),
    (error: unknown) => error instanceof PriorityCityRankingError && error.code === "INVALID_INPUT",
  );
});

test("accepts only a complete AI permutation and separates explicit unknowns", async () => {
  const service = createPriorityCityRankingService({
    provider: async () => ({
      rankedIds: ["2", "0"],
      unknownIds: ["1"],
    }),
  });
  const result = await service.rank(
    "agent-1",
    payload([bratislava, springfield, prague]),
  );
  assert.deepEqual(result, {
    rankedKeys: [prague.key, bratislava.key],
    unknownKeys: [springfield.key],
    source: "ai",
  });
});

test("retries bounded provider failures and caches successful sorted location sets", async () => {
  let calls = 0;
  const service = createPriorityCityRankingService({
    maxAttempts: 2,
    provider: async (locations) => {
      calls += 1;
      if (calls === 1) throw new Error("temporary provider failure");
      return { rankedIds: locations.map((_, index) => String(index)), unknownIds: [] };
    },
  });
  const first = await service.rank("agent-1", payload([bratislava, prague]));
  assert.equal(calls, 2);
  const second = await service.rank("agent-2", payload([prague, bratislava]));
  assert.deepEqual(second, first);
  assert.equal(calls, 2);
});

test("retries malformed AI JSON once before reporting a strict-output failure", async () => {
  let calls = 0;
  const service = createPriorityCityRankingService({
    maxAttempts: 2,
    provider: async (locations) => {
      calls += 1;
      if (calls === 1) return { rankedIds: ["0"], unknownIds: [] };
      return { rankedIds: locations.map((_, index) => String(index)), unknownIds: [] };
    },
  });
  const result = await service.rank("agent-1", payload([bratislava, prague]));
  assert.deepEqual(result.rankedKeys, [bratislava.key, prague.key]);
  assert.equal(calls, 2);
});

test("rejects an injectable truncated response instead of accepting partial IDs", async () => {
  const service = createPriorityCityRankingService({
    maxAttempts: 1,
    provider: async () => ({
      content: { rankedIds: ["0"], unknownIds: ["1"] },
      finishReason: "length",
    }),
  });
  await assert.rejects(
    service.rank("agent-1", payload([bratislava, prague])),
    (error: unknown) => error instanceof PriorityCityRankingError
      && error.code === "AI_INVALID_OUTPUT"
      && error.status === 502,
  );
});

test("returns an explicit failure after timeout and never fabricates AI output", async () => {
  let calls = 0;
  let cancellations = 0;
  const service = createPriorityCityRankingService({
    timeoutMs: 5,
    maxAttempts: 2,
    provider: async (_locations, signal) => {
      calls += 1;
      await new Promise<void>((_resolve, reject) => {
        signal?.addEventListener("abort", () => {
          cancellations += 1;
          reject(new Error("aborted"));
        }, { once: true });
      });
      return { rankedIds: ["0"], unknownIds: [] };
    },
  });

  await assert.rejects(
    service.rank("agent-1", payload([bratislava])),
    (error: unknown) => error instanceof PriorityCityRankingError
      && error.code === "AI_TIMEOUT"
      && error.status === 502,
  );
  assert.equal(calls, 2);
  assert.equal(cancellations, 2);
});

test("accepts the 500-location boundary while the model sees compact IDs", async () => {
  let received: ReadonlyArray<PriorityCityLocation> = [];
  const service = createPriorityCityRankingService({
    provider: async (locations) => {
      received = locations;
      return {
        rankedIds: locations.map((_, index) => String(index)),
        unknownIds: [],
      };
    },
  });
  const locations = Array.from({ length: 500 }, (_, index) => location("SK", `City ${index}`));
  const result = await service.rank("agent-1", payload(locations));
  assert.equal(received.length, 500);
  assert.equal(result.rankedKeys.length, 500);
  assert.equal(result.rankedKeys[499], locations[499]!.key);
  assert.deepEqual(result.unknownKeys, []);
});

test("enforces a per-user rate limit independently of the cache", async () => {
  const service = createPriorityCityRankingService({
    rateLimitMax: 1,
    provider: async (locations) => ({
      rankedIds: locations.map((_, index) => String(index)),
      unknownIds: [],
    }),
  });
  await service.rank("agent-1", payload([bratislava]));
  await assert.rejects(
    service.rank("agent-1", payload([bratislava])),
    (error: unknown) => error instanceof PriorityCityRankingError
      && error.code === "RATE_LIMITED"
      && error.status === 429,
  );
  await service.rank("agent-2", payload([bratislava]));
});
