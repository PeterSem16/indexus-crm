import { normalizeCityLocation, type NormalizedCityLocation } from "@shared/priority-city";

export type PriorityCityLocation = NormalizedCityLocation;

export interface PriorityCityRankingResult {
  rankedKeys: string[];
  unknownKeys: string[];
  source: "ai";
}

export interface PriorityCityRankingInput {
  key: string;
  city: string;
  countryCode: string;
}

export interface PriorityCityAiProvider {
  (
    locations: ReadonlyArray<PriorityCityLocation>,
    signal?: AbortSignal,
  ): Promise<unknown>;
}

export interface PriorityCityRankingServiceOptions {
  provider?: PriorityCityAiProvider;
  clock?: () => number;
  timeoutMs?: number;
  maxAttempts?: number;
  rateLimitWindowMs?: number;
  rateLimitMax?: number;
  cacheTtlMs?: number;
  cacheMaxEntries?: number;
}

export const PRIORITY_CITY_MAX_LOCATIONS = 500;
export const PRIORITY_CITY_MAX_CITY_LENGTH = 200;
export const PRIORITY_CITY_MAX_COUNTRY_LENGTH = 64;
export const PRIORITY_CITY_MAX_KEY_LENGTH = 320;
export const PRIORITY_CITY_DEFAULT_TIMEOUT_MS = 8_000;
export const PRIORITY_CITY_DEFAULT_MAX_ATTEMPTS = 2;
export const PRIORITY_CITY_DEFAULT_RATE_WINDOW_MS = 60_000;
export const PRIORITY_CITY_DEFAULT_RATE_MAX = 10;
export const PRIORITY_CITY_DEFAULT_CACHE_TTL_MS = 5 * 60_000;
export const PRIORITY_CITY_DEFAULT_CACHE_MAX_ENTRIES = 100;

type PriorityCityErrorCode =
  | "INVALID_INPUT"
  | "RATE_LIMITED"
  | "AI_UNCONFIGURED"
  | "AI_TIMEOUT"
  | "AI_FAILURE"
  | "AI_INVALID_OUTPUT";

export class PriorityCityRankingError extends Error {
  readonly code: PriorityCityErrorCode;
  readonly status: 400 | 429 | 502 | 503;

  constructor(
    code: PriorityCityErrorCode,
    message: string,
    status: 400 | 429 | 502 | 503,
  ) {
    super(message);
    this.name = "PriorityCityRankingError";
    this.code = code;
    this.status = status;
  }
}

export interface ValidatedPriorityCityInput {
  locations: PriorityCityLocation[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBoundedString(value: unknown, maxLength: number): value is string {
  return typeof value === "string"
    && value.length <= maxLength
    && !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(value);
}

/**
 * Validates and canonicalizes the route payload.  The key is recomputed from
 * city and country rather than trusting a caller-provided identity.
 */
export function validatePriorityCityInput(body: unknown): ValidatedPriorityCityInput {
  if (!isRecord(body) || !Array.isArray(body.cities)) {
    throw new PriorityCityRankingError("INVALID_INPUT", "cities must be an array", 400);
  }
  if (Object.keys(body).some((key) => key !== "cities")) {
    throw new PriorityCityRankingError("INVALID_INPUT", "request contains unsupported fields", 400);
  }
  if (body.cities.length > PRIORITY_CITY_MAX_LOCATIONS) {
    throw new PriorityCityRankingError(
      "INVALID_INPUT",
      `cities may contain at most ${PRIORITY_CITY_MAX_LOCATIONS} locations`,
      400,
    );
  }

  const locations: PriorityCityLocation[] = [];
  const seenKeys = new Set<string>();
  for (const [index, item] of body.cities.entries()) {
    if (!isRecord(item)
      || !isBoundedString(item.key, PRIORITY_CITY_MAX_KEY_LENGTH)
      || !isBoundedString(item.city, PRIORITY_CITY_MAX_CITY_LENGTH)
      || !isBoundedString(item.countryCode, PRIORITY_CITY_MAX_COUNTRY_LENGTH)) {
      throw new PriorityCityRankingError(
        "INVALID_INPUT",
        `cities[${index}] must contain bounded key, city, and countryCode strings`,
        400,
      );
    }
    if (Object.keys(item).some((key) => !["key", "city", "countryCode"].includes(key))) {
      throw new PriorityCityRankingError(
        "INVALID_INPUT",
        `cities[${index}] contains unsupported fields`,
        400,
      );
    }

    const normalized = normalizeCityLocation(item.countryCode, item.city);
    if (!normalized || normalized.key !== item.key) {
      throw new PriorityCityRankingError(
        "INVALID_INPUT",
        `cities[${index}] has a key that does not match its city and country`,
        400,
      );
    }
    if (seenKeys.has(normalized.key)) {
      throw new PriorityCityRankingError("INVALID_INPUT", "cities must contain unique locations", 400);
    }
    seenKeys.add(normalized.key);
    locations.push(normalized);
  }

  return { locations };
}

interface CacheEntry {
  result: PriorityCityRankingResult;
  expiresAt: number;
  createdAt: number;
}

interface RateEntry {
  startedAt: number;
  count: number;
}

let injectedProvider: PriorityCityAiProvider | undefined;

function parseModelId(value: unknown): string | null {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
    return String(value);
  }
  if (typeof value === "string" && /^\d+$/u.test(value)) {
    return value.replace(/^0+(?=\d)/u, "");
  }
  return null;
}

function parseProviderResult(
  raw: unknown,
  locations: ReadonlyArray<PriorityCityLocation>,
): Pick<PriorityCityRankingResult, "rankedKeys" | "unknownKeys"> {
  let parsed: unknown = raw;
  const parseJson = (value: string): unknown => {
    try {
      return JSON.parse(value);
    } catch {
      throw new PriorityCityRankingError("AI_INVALID_OUTPUT", "AI returned invalid JSON", 502);
    }
  };
  if (typeof parsed === "string") parsed = parseJson(parsed);
  if (isRecord(parsed) && "content" in parsed
    && ("finishReason" in parsed || "finish_reason" in parsed)) {
    const finishReason = parsed.finishReason ?? parsed.finish_reason;
    if (finishReason !== "stop") {
      throw new PriorityCityRankingError(
        "AI_INVALID_OUTPUT",
        "AI response was truncated or incomplete",
        502,
      );
    }
    parsed = parsed.content;
  }
  if (typeof parsed === "string") parsed = parseJson(parsed);
  if (!isRecord(parsed)
    || !Array.isArray(parsed.rankedIds)
    || !Array.isArray(parsed.unknownIds)) {
    throw new PriorityCityRankingError("AI_INVALID_OUTPUT", "AI returned an invalid ranking shape", 502);
  }
  if (Object.keys(parsed).some((key) => key !== "rankedIds" && key !== "unknownIds")) {
    throw new PriorityCityRankingError("AI_INVALID_OUTPUT", "AI returned extra fields", 502);
  }

  const rankedIds = parsed.rankedIds.map(parseModelId);
  const unknownIds = parsed.unknownIds.map(parseModelId);
  if ([...rankedIds, ...unknownIds].some((id) => id === null)) {
    throw new PriorityCityRankingError("AI_INVALID_OUTPUT", "AI returned invalid location IDs", 502);
  }

  const acceptedIds = new Set(locations.map((_, index) => String(index)));
  const rankedIdList = rankedIds as string[];
  const unknownIdList = unknownIds as string[];
  const rankedSet = new Set(rankedIdList);
  const unknownSet = new Set(unknownIdList);
  if (rankedSet.size !== rankedIdList.length || unknownSet.size !== unknownIdList.length) {
    throw new PriorityCityRankingError("AI_INVALID_OUTPUT", "AI returned duplicate location IDs", 502);
  }
  if (rankedIdList.some((id) => unknownSet.has(id))) {
    throw new PriorityCityRankingError("AI_INVALID_OUTPUT", "AI returned overlapping location IDs", 502);
  }
  if (![...rankedSet, ...unknownSet].every((id) => acceptedIds.has(id))) {
    throw new PriorityCityRankingError("AI_INVALID_OUTPUT", "AI returned an unknown location ID", 502);
  }
  if (rankedSet.size + unknownSet.size !== acceptedIds.size) {
    throw new PriorityCityRankingError("AI_INVALID_OUTPUT", "AI omitted a location ID", 502);
  }

  return {
    rankedKeys: rankedIdList.map((id) => locations[Number(id)]!.key),
    unknownKeys: unknownIdList.map((id) => locations[Number(id)]!.key),
  };
}

function timeoutError(): PriorityCityRankingError {
  return new PriorityCityRankingError("AI_TIMEOUT", "AI ranking timed out", 502);
}

function failureError(): PriorityCityRankingError {
  return new PriorityCityRankingError("AI_FAILURE", "AI ranking provider failed", 502);
}

async function withTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation(controller.signal),
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(timeoutError());
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
    // This also cancels a provider that rejected before the timeout, so a
    // retry never leaves the previous attempt running in the background.
    controller.abort();
  }
}

async function defaultPriorityCityAiProvider(
  locations: ReadonlyArray<PriorityCityLocation>,
  signal?: AbortSignal,
): Promise<unknown> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new PriorityCityRankingError(
      "AI_UNCONFIGURED",
      "AI ranking is not configured",
      503,
    );
  }

  // Keep construction lazy: a missing key must not prevent the server from
  // booting, and no secret is read until an authenticated ranking is requested.
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({
    apiKey,
    maxRetries: 0,
    timeout: PRIORITY_CITY_DEFAULT_TIMEOUT_MS,
  });
  const requestLocations = locations.map(({ city, countryCode }, index) => ({
    id: String(index),
    city,
    country: countryCode,
  }));
  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: [
          "Rank the supplied city locations by broad population importance, descending.",
          "This is an ordinal ordering only: do not estimate or return exact populations, scores, or confidence numbers.",
          "Use only the supplied city and country values. Do not invent keys.",
          "The id is an opaque positional identifier; never return city names or keys.",
          "If a location cannot be identified reliably, put its supplied id in unknownIds instead of guessing its rank.",
          'Return only strict JSON with exactly this shape: {"rankedIds":["..."],"unknownIds":["..."]}.',
          "rankedIds and unknownIds together must contain every supplied id exactly once.",
        ].join(" "),
      },
      {
        role: "user",
        content: JSON.stringify({ locations: requestLocations }),
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0,
    max_tokens: Math.min(8_000, Math.max(200, locations.length * 8)),
  }, { signal });
  const choice = response.choices[0];
  if (!choice || choice.finish_reason !== "stop") {
    throw new PriorityCityRankingError(
      "AI_INVALID_OUTPUT",
      "AI response was truncated or incomplete",
      502,
    );
  }
  return {
    content: choice.message?.content ?? null,
    finishReason: choice.finish_reason,
  };
}

export class PriorityCityRankingService {
  private readonly provider?: PriorityCityAiProvider;
  private readonly clock: () => number;
  private readonly timeoutMs: number;
  private readonly maxAttempts: number;
  private readonly rateLimitWindowMs: number;
  private readonly rateLimitMax: number;
  private readonly cacheTtlMs: number;
  private readonly cacheMaxEntries: number;
  private readonly cache = new Map<string, CacheEntry>();
  private readonly rates = new Map<string, RateEntry>();

  constructor(options: PriorityCityRankingServiceOptions = {}) {
    this.provider = options.provider;
    this.clock = options.clock ?? (() => Date.now());
    this.timeoutMs = Math.max(1, Math.min(options.timeoutMs ?? PRIORITY_CITY_DEFAULT_TIMEOUT_MS, 60_000));
    this.maxAttempts = Math.max(
      1,
      Math.min(Math.floor(options.maxAttempts ?? PRIORITY_CITY_DEFAULT_MAX_ATTEMPTS), 3),
    );
    this.rateLimitWindowMs = Math.max(1, options.rateLimitWindowMs ?? PRIORITY_CITY_DEFAULT_RATE_WINDOW_MS);
    this.rateLimitMax = Math.max(1, Math.floor(options.rateLimitMax ?? PRIORITY_CITY_DEFAULT_RATE_MAX));
    this.cacheTtlMs = Math.max(1, options.cacheTtlMs ?? PRIORITY_CITY_DEFAULT_CACHE_TTL_MS);
    this.cacheMaxEntries = Math.max(1, Math.floor(options.cacheMaxEntries ?? PRIORITY_CITY_DEFAULT_CACHE_MAX_ENTRIES));
  }

  clearState(): void {
    this.cache.clear();
    this.rates.clear();
  }

  private enforceRateLimit(userId: string, now: number): void {
    const prior = this.rates.get(userId);
    if (!prior || now - prior.startedAt >= this.rateLimitWindowMs) {
      this.rates.set(userId, { startedAt: now, count: 1 });
    } else {
      prior.count += 1;
      if (prior.count > this.rateLimitMax) {
        throw new PriorityCityRankingError(
          "RATE_LIMITED",
          "Too many city-ranking requests; try again shortly",
          429,
        );
      }
    }

    for (const [key, entry] of this.rates) {
      if (now - entry.startedAt >= this.rateLimitWindowMs) this.rates.delete(key);
    }
  }

  private getCached(cacheKey: string, now: number): PriorityCityRankingResult | null {
    const entry = this.cache.get(cacheKey);
    if (!entry) return null;
    if (entry.expiresAt <= now) {
      this.cache.delete(cacheKey);
      return null;
    }
    return {
      rankedKeys: [...entry.result.rankedKeys],
      unknownKeys: [...entry.result.unknownKeys],
      source: "ai",
    };
  }

  private setCached(cacheKey: string, result: PriorityCityRankingResult, now: number): void {
    while (this.cache.size >= this.cacheMaxEntries) {
      const oldest = [...this.cache.entries()]
        .sort(([, left], [, right]) => left.createdAt - right.createdAt)[0]?.[0];
      if (!oldest) break;
      this.cache.delete(oldest);
    }
    this.cache.set(cacheKey, {
      result: {
        rankedKeys: [...result.rankedKeys],
        unknownKeys: [...result.unknownKeys],
        source: "ai",
      },
      expiresAt: now + this.cacheTtlMs,
      createdAt: now,
    });
  }

  private async callProvider(
    locations: ReadonlyArray<PriorityCityLocation>,
  ): Promise<Pick<PriorityCityRankingResult, "rankedKeys" | "unknownKeys">> {
    const provider = this.provider ?? injectedProvider ?? defaultPriorityCityAiProvider;
    let lastError: unknown;
    for (let attempt = 0; attempt < this.maxAttempts; attempt += 1) {
      try {
        const raw = await withTimeout(
          (signal) => Promise.resolve(provider(locations, signal)),
          this.timeoutMs,
        );
        return parseProviderResult(raw, locations);
      } catch (error) {
        lastError = error;
        if (attempt + 1 >= this.maxAttempts) break;
      }
    }

    if (lastError instanceof PriorityCityRankingError) throw lastError;
    throw failureError();
  }

  async rank(userId: string, input: unknown): Promise<PriorityCityRankingResult> {
    if (typeof userId !== "string" || !userId.trim()) {
      throw new PriorityCityRankingError("INVALID_INPUT", "Authenticated user is required", 400);
    }
    const { locations } = validatePriorityCityInput(input);
    const now = this.clock();
    this.enforceRateLimit(userId, now);

    const cacheKey = locations.map((location) => location.key).sort().join("\n");
    const cached = this.getCached(cacheKey, now);
    if (cached) return cached;

    let parsed: Pick<PriorityCityRankingResult, "rankedKeys" | "unknownKeys">;
    try {
      parsed = await this.callProvider(locations);
    } catch (error) {
      if (error instanceof PriorityCityRankingError) throw error;
      throw failureError();
    }

    const result: PriorityCityRankingResult = { ...parsed, source: "ai" };
    this.setCached(cacheKey, result, now);
    return result;
  }
}

export function createPriorityCityRankingService(
  options: PriorityCityRankingServiceOptions = {},
): PriorityCityRankingService {
  return new PriorityCityRankingService(options);
}

const defaultService = new PriorityCityRankingService();

/**
 * Route-friendly singleton API. Tests can inject a provider without touching
 * process environment or constructing an OpenAI client.
 */
export function setPriorityCityAiProvider(provider: PriorityCityAiProvider | null | undefined): void {
  injectedProvider = provider ?? undefined;
  defaultService.clearState();
}

export function resetPriorityCityRankingState(): void {
  injectedProvider = undefined;
  defaultService.clearState();
}

export function rankPriorityCities(
  userId: string,
  input: unknown,
): Promise<PriorityCityRankingResult> {
  return defaultService.rank(userId, input);
}