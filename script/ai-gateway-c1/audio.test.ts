// ALL audio bytes and provider responses here are mocked. No speech quality was measured.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { prepare } from "./prepare.cjs";
import { IDS, materializeTranscription, fixtureManifestTemplate } from "./transcription-mapping.cjs";
import { replayTranscription } from "./transcription-parser.cjs";
import { createAudioExecutor, resolveAudioProfile, validateWav, loadFixture } from "./audio";
import { parseArguments, executeSuite, initialReport, captureTransport } from "./run";

const catalogPath = "generated-artifacts/ai-service-inventory/INDEXUS-65-AI-sluzieb.json";
const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const plan = prepare(catalog);
const profile = { baseURL: "http://10.9.2.140:8765/", implementationReference: "mocked-implementation-only",
  confirmedCodecs: ["pcm_s16le/16000/mono"], authentication: { mode: "existingEnvironmentHeader",
    environmentVariable: "MOCKED_EXISTING_AUDIO_HEADER", header: "Authorization", prefix: "Bearer " } };
const env = { MOCKED_EXISTING_AUDIO_HEADER: "unit-test-only-secret" };
function wav() {
  const b = Buffer.alloc(44 + 320);
  b.write("RIFF", 0); b.writeUInt32LE(b.length - 8, 4); b.write("WAVE", 8); b.write("fmt ", 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(16000, 24); b.writeUInt32LE(32000, 28); b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(320, 40); return b;
}
function fixtures() {
  const root = fs.mkdtempSync(path.resolve("generated-artifacts/c1-audio-test-"));
  const bytes = wav(), manifest = fixtureManifestTemplate();
  manifest.fixtures[0].sha256 = createHash("sha256").update(bytes).digest("hex");
  fs.writeFileSync(path.join(root, manifest.fixtures[0].file), bytes);
  const file = path.join(root, "fixtures.json");
  fs.writeFileSync(file, JSON.stringify(manifest));
  return { root, file, manifest, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}

test("seven existing transcription services preserve eight native source requests", () => {
  const services = plan.services.filter((s: any) => s.operation === "transcription");
  assert.deepEqual(services.map((s: any) => s.id).sort(), [...IDS].sort());
  assert.equal(services.flatMap((s: any) => s.variants).length, 8);
  for (const s of services) for (const v of s.variants) {
    assert.equal(v.testTransport, "EXISTING_AUDIO_API");
    assert.equal(v.request.model, "whisper-1");
    assert.equal(v.audioAPI.path, "/v1/audio/transcriptions");
    assert.equal(v.request.file.kind, "synthetic_audio_fixture");
    assert.deepEqual(Object.keys(v.request).sort(),
      Object.keys(catalog.services.find((x: any) => x.id === s.id).requests[s.variants.indexOf(v)].parameters).sort());
  }
  const training = services.find((s: any) => s.id === "training.transcription");
  assert.equal(training.variants[0].request.response_format, undefined);
});
test("unmapped source fields fail, rather than silently dropping original parameters", () => {
  const request = catalog.services.find((s: any) => s.id === "training.transcription").requests[0];
  assert.throws(() => materializeTranscription("training.transcription", {
    ...request, parameters: { ...request.parameters, prompt: '"new unexpected parameter"' },
  }), /C1_TRANSCRIPTION_UNMAPPED_FIELD/);
});
test("existing authentication, actual codec and exact Audio API target must be confirmed", () => {
  assert.throws(() => resolveAudioProfile({}, {}), /REFERENCE_REQUIRED/);
  for (const url of ["http://10.9.2.140:8780/", "http://10.9.2.140:8766/", "http://127.0.0.1:8765/",
    "http://10.9.2.140:8765/other", "http://name:password@10.9.2.140:8765/"]) {
    assert.throws(() => resolveAudioProfile({ ...profile, baseURL: url }, env), /TARGET_NOT_CONFIRMED/);
  }
  assert.throws(() => resolveAudioProfile({ ...profile, confirmedCodecs: [] }, env), /CODEC_NOT_CONFIRMED/);
  assert.throws(() => resolveAudioProfile(profile, {}), /EXISTING_AUTHENTICATION_MISSING/);
  assert.throws(() => resolveAudioProfile({ ...profile, authentication: { mode: "none" } }, env), /UNCONFIRMED/);
  const resolved = resolveAudioProfile(profile, env);
  assert.ok(!JSON.stringify(resolved.publicEvidence).includes(env.MOCKED_EXISTING_AUDIO_HEADER));
  assert.equal(resolved.endpoint, "http://10.9.2.140:8765/v1/audio/transcriptions");
});
test("all eight native calls use multipart and replay original application extraction/guards", async () => {
  const f = fixtures();
  try {
    for (const s of plan.services.filter((s: any) => s.operation === "transcription")) for (const v of s.variants) {
      let calls = 0;
      const execute = createAudioExecutor(profile, f.file, env, (async (url: any, init: any) => {
        calls++;
        assert.equal(String(url), "http://10.9.2.140:8765/v1/audio/transcriptions");
        assert.equal(init.redirect, "error");
        assert.equal(init.headers.authorization, "Bearer unit-test-only-secret");
        assert.ok(init.body instanceof FormData);
        const keys = [...init.body.keys()].sort();
        assert.deepEqual(keys, Object.keys(v.request).sort());
        assert.equal(init.body.get("model"), "whisper-1");
        assert.equal(init.body.get("language"), v.request.language || null);
        assert.equal(init.body.get("response_format"), v.request.response_format || null);
        return v.request.response_format === "text"
          ? new Response(f.manifest.fixtures[0].expectedTranscript, { headers: { "content-type": "text/plain" } })
          : Response.json({ text: f.manifest.fixtures[0].expectedTranscript });
      }) as typeof fetch);
      const a = await execute.execute(s, v, 1);
      assert.equal(calls, 1);
      assert.equal(a.failure, null, s.id + " " + JSON.stringify(a.failure));
      assert.equal(a.applicationParser.state, "ACCEPTED");
      assert.equal(a.semanticCheck.rawExactMatch, true);
      assert.equal(a.rawGatewayResponse, null);
      assert.ok(a.rawAudioResponse.body);
      assert.ok(!JSON.stringify(a).includes(env.MOCKED_EXISTING_AUDIO_HEADER));
    }
  } finally { f.cleanup(); }
});
test("original training hallucination filter and virtual-agent trim remain separate from raw output", () => {
  const training = plan.services.find((s: any) => s.id === "training.transcription").variants[0];
  const a = replayTranscription("training.transcription", { text: "ďakujem" }, training);
  assert.equal(a.state, "REJECTED");
  const v = plan.services.find((s: any) => s.id === "virtual_agent.transcription").variants[0];
  const b = replayTranscription("virtual_agent.transcription", "   TEST C1   ", v);
  assert.equal(b.value, "TEST C1");
  assert.equal(replayTranscription("virtual_agent.transcription", "x", v).state, "REJECTED");
});
test("response-format mismatch is an API contract failure, not automatic model blame", async () => {
  const f = fixtures();
  try {
    const s = plan.services.find((s: any) => s.id === "training.transcription"), v = s.variants[0];
    const a = await createAudioExecutor(profile, f.file, env,
      (async () => new Response("plain text", { headers: { "content-type": "text/plain" } })) as typeof fetch).execute(s, v, 1);
    assert.equal(a.failure.code, "C1_AUDIO_JSON_CONTENT_TYPE_MISMATCH");
    assert.equal(a.failure.owner, "AUDIO_API_CONTRACT");
    assert.equal(a.rawAudioResponse.body, "plain text");
    assert.equal(a.adapterOutput, null);
  } finally { f.cleanup(); }
});
test("invalid or swapped audio files fail before transport", () => {
  const f = fixtures();
  try {
    validateWav(wav());
    assert.throws(() => validateWav(Buffer.from("not wav")), /NOT_VALID_WAV/);
    const file = path.join(f.root, f.manifest.fixtures[0].file);
    fs.appendFileSync(file, "changed");
    assert.throws(() => loadFixture(f.file, "SYN-C1-SK-01"), /HASH_MISMATCH/);
  } finally { f.cleanup(); }
});
test("selection rejects unknown or duplicate services and does not require audio for text", () => {
  assert.deepEqual(parseArguments(["--run-c1", "plan.json", "--services", "sms.sentiment"]).services, ["sms.sentiment"]);
  assert.throws(() => parseArguments(["--run-c1", "plan.json", "--services", "unknown.service"]), /SELECTION_INVALID/);
  assert.throws(() => parseArguments(["--run-c1", "plan.json", "--services", "sms.sentiment,sms.sentiment"]), /SELECTION_INVALID/);
  assert.throws(() => parseArguments(["--run-c1", "plan.json", "--audio-profile", "a.json"]), /FIXTURES_REQUIRED/);
});
test("an audio authentication failure does not block the independently selected text service", async () => {
  const report = initialReport(plan);
  let audioCalls = 0, textCalls = 0;
  const audioExecutor = { publicEvidence: {}, assertSafeEvidence() {},
    execute: async () => { audioCalls++; return { variant: "mobile.voice_note:1", repetition: 1,
      adapterOutput: null, modelOutput: null, inferenceMs: null, applicationParser: null,
      failure: { code: "C1_AUDIO_HTTP_ERROR", owner: "TRANSPORT_OR_AUDIO_API", httpStatus: 403 } }; } };
  const capture = captureTransport("", (async () => { throw Error("not called"); }) as typeof fetch);
  const client = { chat: { completions: { create: async () => {
    textCalls++; return { choices: [{ message: { content: '{"sk":"Test","en":"Test"}' } }] };
  } } } };
  const snap = () => ({ gatewayEnabled: false, openai: 65, internal: 0, modelOverrides: 0,
    version: 1, routesSha256: "mock", gatewayParametersSha256: "mock", fullConfigurationSha256: "mock" });
  await executeSuite(plan, report, { client, capture, audioExecutor,
    selectedServices: ["mobile.voice_note", "status_list.translation"],
    persist: async () => {}, readSnapshot: async () => snap() });
  assert.equal(audioCalls, 1); assert.equal(textCalls, 3);
  assert.equal(report.finalVerified, true);
  assert.equal(report.error, "C1_AUDIO_HTTP_ERROR");
});
test("standalone launcher refuses Replit before reading credentials or touching production paths", () => {
  const r = spawnSync(process.execPath, ["script/ai-gateway-c1/launch.cjs"], {
    encoding: "utf8", env: { ...process.env, REPL_ID: "offline-test" },
  });
  assert.notEqual(r.status, 0); assert.match(r.stderr, /C1_CORPCRM01_ONLY/);
});
