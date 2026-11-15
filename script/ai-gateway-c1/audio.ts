/** Test-only client of the EXISTING 1.6.1 Audio API. No installation, production route or TTS. */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import { API, IDS } from "./transcription-mapping.cjs";
import { replayTranscription } from "./transcription-parser.cjs";

const MAX_AUDIO = 25 * 1024 * 1024, MAX_RESPONSE = 2 * 1024 * 1024;
export class AudioFailure extends Error {
  constructor(readonly code: string, readonly owner: string, readonly httpStatus: number | null = null) { super(code); }
}
const fail = (code: string, owner = "INDEXUS_AUDIO_CONFIGURATION"): never => { throw new AudioFailure(code, owner); };
export function resolveAudioProfile(profile: any, environment: NodeJS.ProcessEnv) {
  if (!profile?.implementationReference || typeof profile.implementationReference !== "string")
    fail("C1_AUDIO_IMPLEMENTATION_REFERENCE_REQUIRED");
  let base: URL;
  try { base = new URL(profile.baseURL); } catch { return fail("C1_AUDIO_BASE_URL_UNCONFIRMED"); }
  if (!["http:", "https:"].includes(base.protocol) || base.hostname !== API.host || base.port !== String(API.port) ||
      base.pathname !== "/" || base.username || base.password || base.search || base.hash)
    fail("C1_AUDIO_TARGET_NOT_CONFIRMED");
  if (!Array.isArray(profile.confirmedCodecs) || !profile.confirmedCodecs.includes("pcm_s16le/16000/mono"))
    fail("C1_AUDIO_FIXTURE_CODEC_NOT_CONFIRMED");
  const auth = profile.authentication;
  let headers: Record<string, string> = {}, secret: string | null = null;
  if (auth?.mode === "confirmedNoAuthentication") {
    if (auth.confirmedFromImplementation !== true) fail("C1_AUDIO_AUTHENTICATION_UNCONFIRMED");
  } else if (auth?.mode === "existingEnvironmentHeader") {
    if (!/^[A-Z][A-Z0-9_]{0,127}$/.test(auth.environmentVariable || "") ||
        !["authorization", "x-api-key"].includes(String(auth.header).toLowerCase()) ||
        !["", "Bearer ", "Basic "].includes(auth.prefix))
      fail("C1_AUDIO_AUTHENTICATION_BINDING_INVALID");
    secret = environment[auth.environmentVariable] || null;
    if (!secret || secret !== secret.trim() || /[\r\n\0]/.test(secret)) fail("C1_AUDIO_EXISTING_AUTHENTICATION_MISSING");
    headers = { [auth.header.toLowerCase()]: auth.prefix + secret };
  } else fail("C1_AUDIO_AUTHENTICATION_UNCONFIRMED");
  return { endpoint: new URL(API.path, base).href, headers, secret,
    publicEvidence: { ...API, baseURL: base.href, authenticationMode: auth.mode,
      confirmedCodecs: profile.confirmedCodecs, implementationReference: profile.implementationReference } };
}
export function validateWav(bytes: Buffer) {
  if (bytes.length < 44 || bytes.length > MAX_AUDIO || bytes.toString("ascii", 0, 4) !== "RIFF" ||
      bytes.toString("ascii", 8, 12) !== "WAVE" || bytes.readUInt32LE(4) !== bytes.length - 8)
    fail("C1_AUDIO_FIXTURE_NOT_VALID_WAV", "INDEXUS_SYNTHETIC_FIXTURE");
  let format = false, data = false;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const tag = bytes.toString("ascii", offset, offset + 4), size = bytes.readUInt32LE(offset + 4);
    if (offset + 8 + size > bytes.length) fail("C1_AUDIO_FIXTURE_TRUNCATED", "INDEXUS_SYNTHETIC_FIXTURE");
    if (tag === "fmt ") {
      if (format || size < 16 || bytes.readUInt16LE(offset + 8) !== 1 ||
          bytes.readUInt16LE(offset + 10) !== 1 || bytes.readUInt32LE(offset + 12) !== 16_000 ||
          bytes.readUInt16LE(offset + 22) !== 16 || bytes.readUInt16LE(offset + 20) !== 2 ||
          bytes.readUInt32LE(offset + 16) !== 32_000)
        fail("C1_AUDIO_FIXTURE_CODEC_NOT_SUPPORTED_BY_RUNNER", "INDEXUS_SYNTHETIC_FIXTURE");
      format = true;
    }
    if (tag === "data") {
      if (data || size < 2 || size % 2) fail("C1_AUDIO_FIXTURE_EMPTY", "INDEXUS_SYNTHETIC_FIXTURE");
      data = true;
    }
    offset += 8 + size + size % 2;
  }
  if (!format || !data) fail("C1_AUDIO_FIXTURE_CHUNKS_MISSING", "INDEXUS_SYNTHETIC_FIXTURE");
}
export function loadFixture(manifestFile: string, id: string) {
  const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
  if (manifest.syntheticOnly !== true || !Array.isArray(manifest.fixtures)) fail("C1_AUDIO_SYNTHETIC_MANIFEST_REQUIRED");
  const matches = manifest.fixtures.filter((f: any) => f.id === id);
  if (matches.length !== 1) fail("C1_AUDIO_FIXTURE_NOT_UNIQUE");
  const fixture = matches[0];
  if (fixture.synthetic !== true || !/^SYN-C1-[A-Z0-9-]+\.wav$/.test(fixture.file || "") ||
      !/^[a-f0-9]{64}$/.test(fixture.sha256 || "") ||
      typeof fixture.expectedTranscript !== "string" || !fixture.expectedTranscript.trim() ||
      fixture.expectedTranscript.length > 4000 || typeof fixture.language !== "string")
    fail("C1_AUDIO_SYNTHETIC_FIXTURE_EVIDENCE_REQUIRED", "INDEXUS_SYNTHETIC_FIXTURE");
  const directory = fs.realpathSync(path.dirname(manifestFile)), file = path.join(directory, fixture.file);
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_AUDIO ||
      !fs.realpathSync(file).startsWith(directory + path.sep)) fail("C1_AUDIO_FIXTURE_PATH_UNSAFE");
  const bytes = fs.readFileSync(file);
  if (createHash("sha256").update(bytes).digest("hex") !== fixture.sha256) fail("C1_AUDIO_FIXTURE_HASH_MISMATCH");
  validateWav(bytes);
  return { bytes, fixture };
}
async function readResponse(response: Response, secret: string | null) {
  const reader = response.body?.getReader(), chunks: Uint8Array[] = [];
  if (!reader) return "";
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      total += value.length;
      if (total > MAX_RESPONSE) fail("C1_AUDIO_RESPONSE_TOO_LARGE", "AUDIO_API_CONTRACT");
      chunks.push(value);
    }
    const raw = Buffer.concat(chunks).toString("utf8");
    if (secret && raw.includes(secret)) fail("C1_SECRET_ECHO", "AUDIO_API_SECURITY");
    return raw;
  } finally { await reader.cancel().catch(() => {}); }
}
export function createAudioExecutor(profile: any, manifestFile: string, environment: NodeJS.ProcessEnv,
  transport: typeof fetch = fetch) {
  // Resolve once before any request; no guessed authorization and no reuse of Gateway credentials.
  const config = resolveAudioProfile(profile, environment);
  return {
    publicEvidence: config.publicEvidence,
    assertSafeEvidence(text: string) {
      if (config.secret && text.includes(config.secret)) fail("C1_SECRET_ECHO", "AUDIO_API_SECURITY");
    },
    async execute(service: any, variant: any, repetition: number, signal?: AbortSignal) {
      const start = performance.now();
      const attempt: any = { variant: variant.id, repetition, originalModel: variant.request?.model,
        targetModel: variant.request?.model, originalRequest: variant.request, request: null,
        testTransport: "EXISTING_AUDIO_API", api: config.publicEvidence, rawGatewayResponse: null,
        rawAudioResponse: null, modelOutput: null, adapterOutput: null, applicationParser: null,
        failure: null, inferenceMs: null, totalMs: null, semanticCheck: null };
      const controller = new AbortController();
      const abort = () => controller.abort();
      signal?.addEventListener("abort", abort, { once: true });
      if (signal?.aborted) abort();
      const timer = setTimeout(abort, 120_000);
      try {
        if (!IDS.includes(service.id) || service.operation !== "transcription" || variant.error)
          fail("C1_AUDIO_SERVICE_NOT_MAPPED");
        const request = variant.request;
        if (!request || Object.keys(request).some(k => !["file", "model", "language", "response_format"].includes(k)) ||
            request.model !== "whisper-1" || request.file?.kind !== "synthetic_audio_fixture" ||
            request.response_format !== undefined && !["text", "json"].includes(request.response_format))
          fail("C1_AUDIO_REQUEST_CONTRACT_CHANGED");
        const { bytes, fixture } = loadFixture(manifestFile, request.file.id);
        if (request.language && request.language !== fixture.language) fail("C1_AUDIO_FIXTURE_LANGUAGE_MISMATCH");
        const form = new FormData();
        form.set("file", new Blob([new Uint8Array(bytes)], { type: "audio/wav" }), fixture.file);
        for (const key of ["model", "language", "response_format"]) if (request[key] !== undefined)
          form.set(key, request[key]);
        attempt.request = { ...request, file: { id: fixture.id, sha256: fixture.sha256,
          bytes: bytes.length, codec: "pcm_s16le/16000/mono" } };
        const requestStart = performance.now();
        let response: Response;
        try {
          response = await transport(config.endpoint, { method: "POST", redirect: "error",
            headers: config.headers, body: form, signal: controller.signal });
        } catch { throw new AudioFailure(controller.signal.aborted ? "C1_ABORT_OR_TIMEOUT" :
          "C1_AUDIO_TRANSPORT_ERROR", "TRANSPORT_OR_AUDIO_API"); }
        const body = await readResponse(response, config.secret);
        attempt.inferenceMs = performance.now() - requestStart;
        attempt.rawAudioResponse = { status: response.status, contentType: response.headers.get("content-type"),
          body, elapsedMs: attempt.inferenceMs };
        if (response.status !== 200) throw new AudioFailure("C1_AUDIO_HTTP_ERROR", "TRANSPORT_OR_AUDIO_API", response.status);
        const format = request.response_format || "json";
        let native: any;
        if (format === "text") {
          if (!response.headers.get("content-type")?.toLowerCase().startsWith("text/plain"))
            fail("C1_AUDIO_TEXT_CONTENT_TYPE_MISMATCH", "AUDIO_API_CONTRACT");
          native = body; attempt.modelOutput = body;
        } else {
          if (!response.headers.get("content-type")?.toLowerCase().includes("application/json"))
            fail("C1_AUDIO_JSON_CONTENT_TYPE_MISMATCH", "AUDIO_API_CONTRACT");
          try { native = JSON.parse(body); } catch { fail("C1_AUDIO_INVALID_JSON", "AUDIO_API_CONTRACT"); }
          if (!native || typeof native !== "object" || Array.isArray(native) || typeof native.text !== "string")
            fail("C1_AUDIO_JSON_TEXT_MISSING", "AUDIO_API_CONTRACT");
          attempt.modelOutput = native.text;
        }
        attempt.adapterOutput = native;
        attempt.applicationParser = replayTranscription(service.id, native, variant);
        if (attempt.applicationParser.state !== "ACCEPTED") throw new AudioFailure(
          attempt.applicationParser.validationError, attempt.applicationParser.state === "REPLAY_ERROR" ?
            "INDEXUS_TEST_HARNESS" : "MODEL_OUTPUT_OR_APPLICATION_CONTRACT");
        attempt.semanticCheck = { reference: fixture.expectedTranscript, rawExactMatch:
          attempt.modelOutput === fixture.expectedTranscript,
          applicationExactMatch: attempt.applicationParser.value === fixture.expectedTranscript,
          policy: "Exact known-answer comparison only; no normalization or automatic compatibility approval." };
        if (!attempt.semanticCheck.rawExactMatch) throw new AudioFailure("C1_TRANSCRIPT_REFERENCE_MISMATCH",
          "MODEL_OUTPUT_OR_AUDIO_PIPELINE");
      } catch (error: any) {
        attempt.failure = error instanceof AudioFailure ? { code: error.code, owner: error.owner,
          httpStatus: error.httpStatus, responsibilityConfirmed: false } :
          controller.signal.aborted ? { code: "C1_ABORT_OR_TIMEOUT", owner: "TRANSPORT_OR_AUDIO_API",
            httpStatus: null, responsibilityConfirmed: false } :
          { code: "C1_AUDIO_LOCAL_FIXTURE_OR_HARNESS_ERROR", owner: "INDEXUS_TEST_HARNESS",
            httpStatus: null, responsibilityConfirmed: true };
      } finally {
        clearTimeout(timer); signal?.removeEventListener("abort", abort);
        attempt.totalMs = performance.now() - start;
      }
      return attempt;
    },
  };
}
