import assert from "node:assert/strict";
import test from "node:test";
import {
  CallRecordingsRequestError,
  fetchAutomationCallRecordings,
  filterCallRecordingsForPage,
  isCallRecordingUnavailable,
  type AutomationCallRecording,
} from "./automation-call-recordings";
import { getAutomationCallPageCopy } from "../i18n/automation-call-page-copy";

test("optional recording ID can only narrow to IDs returned for the authorized call", () => {
  const records: AutomationCallRecording[] = [
    { id: "recording-a", callLogId: "call-1" },
    { id: "recording-b", callLogId: "call-1" },
  ];
  assert.deepEqual(filterCallRecordingsForPage(records, null), records);
  assert.deepEqual(filterCallRecordingsForPage(records, "recording-b"), [records[1]]);
  assert.deepEqual(filterCallRecordingsForPage(records, "not-in-this-call"), []);
});

test("recordings are fetched with the authenticated callLogId endpoint", async () => {
  let requestedUrl = "";
  let requestedCredentials: RequestCredentials | undefined;
  const result = await fetchAutomationCallRecordings("call / one", async (input, init) => {
    requestedUrl = String(input);
    requestedCredentials = init?.credentials;
    return new Response(JSON.stringify([{ id: "rec-1" }]), { status: 200 });
  });
  assert.equal(requestedUrl, "/api/call-recordings?callLogId=call+%2F+one");
  assert.equal(requestedCredentials, "include");
  assert.deepEqual(result, [{ id: "rec-1" }]);
});

test("access failures are distinguished from service errors", async () => {
  for (const status of [401, 403, 404]) {
    await assert.rejects(
      fetchAutomationCallRecordings("call-1", async () => new Response(null, { status })),
      (error: unknown) => isCallRecordingUnavailable(error),
    );
  }
  await assert.rejects(
    fetchAutomationCallRecordings("call-1", async () => new Response(null, { status: 503 })),
    (error: unknown) => error instanceof CallRecordingsRequestError && !isCallRecordingUnavailable(error),
  );
});

test("page copy is complete in all supported locales", () => {
  for (const locale of ["en", "sk", "cs", "hu", "ro", "it", "de"] as const) {
    const copy = getAutomationCallPageCopy(locale);
    for (const value of Object.values(copy)) {
      assert.equal(typeof value, "string");
      assert.ok(value.length > 0);
    }
  }
});
