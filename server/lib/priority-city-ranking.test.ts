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

function realisticLocations(count: number): PriorityCityLocation[] {
  return Array.from({ length: count }, (_, index) => location(
    index % 2 === 0 ? "SK" : "CZ",
    `City ${index}`,
  ));
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

test("repairs a realistic 225-location omission without filling from input order", async () => {
  const locations = realisticLocations(225);
  let calls = 0;
  let repairIds: ReadonlyArray<string> | undefined;
  const service = createPriorityCityRankingService({
    maxAttempts: 2,
    provider: async (received, _signal, repair) => {
      calls += 1;
      if (!repair) {
        return {
          rankedIds: received.map((_, index) => String(index)).filter((id) => id !== "113"),
          unknownIds: [],
        };
      }
      repairIds = repair.missingIds;
      return {
        rankedIds: received.map((_, index) => String(received.length - index - 1)),
        unknownIds: [],
      };
    },
  });

  const result = await service.rank("agent-1", payload(locations));
  assert.equal(calls, 2);
  assert.deepEqual(repairIds, ["113"]);
  assert.equal(result.rankedKeys.length, 225);
  assert.equal(result.rankedKeys[0], locations[224]!.key);
  assert.deepEqual(result.unknownKeys, []);
});

test("repairs duplicate and unknown IDs, but never accepts either as a rank", async () => {
  const locations = realisticLocations(225);
  let calls = 0;
  const service = createPriorityCityRankingService({
    maxAttempts: 2,
    provider: async (received, _signal, repair) => {
      calls += 1;
      if (!repair) {
        return {
          rankedIds: ["0", "0", "999"],
          unknownIds: [],
        };
      }
      return {
        rankedIds: received.map((_, index) => String(index)),
        unknownIds: [],
      };
    },
  });

  const result = await service.rank("agent-1", payload(locations));
  assert.equal(calls, 2);
  assert.equal(result.rankedKeys.length, locations.length);
  assert.equal(new Set(result.rankedKeys).size, locations.length);
});

test("rejects an injectable truncated response instead of accepting partial IDs", async () => {
  const locations = realisticLocations(225);
  const service = createPriorityCityRankingService({
    maxAttempts: 1,
    provider: async () => ({
      content: { rankedIds: Array.from({ length: 224 }, (_, index) => String(index)), unknownIds: [] },
      finishReason: "length",
    }),
  });
  await assert.rejects(
    service.rank("agent-1", payload(locations)),
    (error: unknown) => error instanceof PriorityCityRankingError
      && error.code === "AI_INVALID_OUTPUT"
      && error.status === 502,
  );
});

test("reports bounded failure after repeated incomplete 225-location outputs", async () => {
  const locations = realisticLocations(225);
  let calls = 0;
  const service = createPriorityCityRankingService({
    maxAttempts: 2,
    provider: async (received) => {
      calls += 1;
      return {
        rankedIds: received.map((_, index) => String(index)).slice(0, -1),
        unknownIds: [],
      };
    },
  });

  await assert.rejects(
    service.rank("agent-1", payload(locations)),
    (error: unknown) => error instanceof PriorityCityRankingError
      && error.code === "AI_INVALID_OUTPUT"
      && error.status === 502,
  );
  assert.equal(calls, 2);
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

test("allows concurrent different users to rank the same city set independently", async () => {
  const locations = realisticLocations(225);
  let calls = 0;
  const service = createPriorityCityRankingService({
    rateLimitMax: 1,
    provider: async (received) => {
      calls += 1;
      await new Promise((resolve) => setImmediate(resolve));
      return {
        rankedIds: received.map((_, index) => String(index)),
        unknownIds: [],
      };
    },
  });

  const [first, second] = await Promise.all([
    service.rank("agent-1", payload(locations)),
    service.rank("agent-2", payload(locations)),
  ]);
  assert.deepEqual(first.rankedKeys, second.rankedKeys);
  assert.equal(first.rankedKeys.length, 225);
  assert.equal(calls, 2);
});
