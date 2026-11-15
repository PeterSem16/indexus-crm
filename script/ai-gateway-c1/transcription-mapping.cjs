// Test-only mapping to the EXISTING Audio API. No production adapter or router import.
const vm = require("node:vm");
const ts = require("typescript");
const { bindingsFor } = require("./synthetic.cjs");
const IDS = Object.freeze(["mobile.voice_note", "mobile.call_transcription", "call_recording.transcription",
  "beratung.transcription", "voicemail.transcription", "training.transcription", "virtual_agent.transcription"]);
const API = Object.freeze({ reportedVersion: "1.6.1", host: "10.9.2.140", port: 8765,
  path: "/v1/audio/transcriptions", method: "POST", encoding: "multipart/form-data",
  provenance: "User-confirmed existing deployment; authentication, codecs and response behavior still require runtime evidence." });
const FIXTURE = Object.freeze({ kind: "synthetic_audio_fixture", id: "SYN-C1-SK-01" });
function materializeTranscription(id, request) {
  if (!IDS.includes(id)) throw Error("C1_TRANSCRIPTION_SERVICE_NOT_ALLOWED");
  if (!request.arguments?.[0]) throw Error("C1_TRANSCRIPTION_SOURCE_MISSING");
  if (Object.keys(request.parameters || {}).some(k => !["file", "model", "language", "response_format"].includes(k)))
    throw Error("C1_TRANSCRIPTION_UNMAPPED_FIELD");
  const seed = bindingsFor(id);
  const context = vm.createContext({
    ...seed, file: FIXTURE, audioFile: FIXTURE, filePath: "SYN-C1-SK-01.wav",
    tmpPath: "SYN-C1-SK-01.wav", req: { file: { path: "SYN-C1-SK-01.wav" } },
    fs: { createReadStream: () => FIXTURE }, fsSync: { createReadStream: () => FIXTURE },
  }, { codeGeneration: { strings: false, wasm: false } });
  // Preserve source language expressions, including training's at->de mapping.
  // The only replaced input is the real file stream, represented by a synthetic fixture descriptor.
  for (const definition of request.definitions || []) {
    const code = ts.transpileModule("var " + definition.code + ";", {
      compilerOptions: { target: ts.ScriptTarget.ES2022 },
    }).outputText;
    vm.runInContext(code, context, { timeout: 100 });
  }
  const code = ts.transpileModule("globalThis.__request = (" + request.arguments[0] + ");", {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInContext(code, context, { timeout: 100 });
  const result = JSON.parse(JSON.stringify(context.__request));
  if (!result.file || result.file.id !== FIXTURE.id || result.model !== "whisper-1" ||
      result.response_format !== undefined && !["text", "json"].includes(result.response_format))
    throw Error("C1_TRANSCRIPTION_CONTRACT_CHANGED");
  return { request: result, bindings: seed, testTransport: "EXISTING_AUDIO_API",
    audioAPI: API, fixtureState: "SPEECH_BYTES_NOT_SUPPLIED" };
}
function fixtureManifestTemplate() {
  return { syntheticOnly: true, fixtures: [{ id: FIXTURE.id, file: "SYN-C1-SK-01.wav",
    sha256: null, language: "sk", synthetic: true,
    expectedTranscript: "Toto je syntetický test Indexus. Prosím potvrďte prijatie správy.",
    note: "Use an existing synthetic test recording or a deliberately recorded test utterance. No new Whisper/TTS installation. Fill SHA-256 from the actual file." }] };
}
function runtimeProfileTemplate() {
  return { baseURL: null, authentication: { mode: "existingEnvironmentHeader",
    environmentVariable: null, header: null, prefix: null },
    confirmedCodecs: [], implementationReference: null,
    note: "Copy protocol, existing authentication binding and accepted codecs from the deployed implementation/configuration. Never put credential values here. Supported runner fixture codec: pcm_s16le/16000/mono." };
}
module.exports = { IDS, API, materializeTranscription, fixtureManifestTemplate, runtimeProfileTemplate };
