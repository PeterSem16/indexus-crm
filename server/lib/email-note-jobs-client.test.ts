import test from "node:test";
import assert from "node:assert/strict";
import { createEmailNoteJobsClient, parseNoteJob } from "./email-note-jobs-client";
const id = "33333333-3333-4333-8333-333333333333";
const pending = { job_id: id, status: "pending", review_required: true };
const completed = { ...pending, status: "completed", note: "Klient žiada vysvetlenie doručenej faktúry." };
test("client uses the exact async API and server-only bearer, without model/router parameters", async () => {
  const calls: any[] = [];
  const client = createEmailNoteJobsClient({ token: () => "SYNTHETIC",
    fetch: async (url, init) => {
      calls.push({ url, init });
      return Response.json(calls.length === 1 ? pending : completed, { status: calls.length === 1 ? 202 : 200 });
    } });
  assert.equal((await client.submit("Syntetický e-mail")).status, "pending");
  assert.equal((await client.poll(id)).note, completed.note);
  assert.equal(calls[0].url, "https://ai.cordbloodcenter.com/gateway/v1/email-notes/jobs");
  assert.equal(calls[1].url, `https://ai.cordbloodcenter.com/gateway/v1/email-notes/jobs/${id}`);
  assert.deepEqual(JSON.parse(calls[0].init.body), { customer_text: "Syntetický e-mail" });
  assert.equal(calls[0].init.headers.Authorization, "Bearer SYNTHETIC");
  assert.equal(calls[0].init.redirect, "error");
});
test("network failures and deadlines return safe codes, never raw upstream data; no retries", async () => {
  let attempts = 0;
  const fail = createEmailNoteJobsClient({ token: () => "SYNTHETIC", fetch: async () => {
    attempts++; throw Error("PRIVATE CUSTOMER TEXT AND SECRET");
  } });
  await assert.rejects(fail.submit("SYNTHETIC"), { message: "gateway_unavailable" });
  assert.equal(attempts, 1);
  const timeout = createEmailNoteJobsClient({ token: () => "SYNTHETIC", timeoutMs: 5,
    fetch: async (_url, init) => new Promise((_resolve, reject) => {
      init!.signal!.addEventListener("abort", () => reject(Error("PRIVATE")), { once: true });
    }) });
  await assert.rejects(timeout.poll(id), { message: "gateway_timeout" });
});
test("missing token, authentication, oversized/invalid responses and mismatched job identity fail closed", async () => {
  let calls = 0;
  const missing = createEmailNoteJobsClient({ token: () => undefined, fetch: async () => { calls++; return Response.json({}); } });
  await assert.rejects(missing.submit("SYNTHETIC"), { message: "gateway_not_configured" });
  assert.equal(calls, 0);
  for (const status of [401, 403, 429, 500, 503]) {
    const client = createEmailNoteJobsClient({ token: () => "SYNTHETIC",
      fetch: async () => new Response("PRIVATE UPSTREAM ERROR", { status }) });
    await assert.rejects(client.poll(id), { message: [401, 403].includes(status) ?
      "gateway_authentication_failed" : "gateway_unavailable" });
  }
  for (const body of ["not JSON", "x".repeat(128001), JSON.stringify({ ...completed, job_id: "another" })]) {
    const client = createEmailNoteJobsClient({ token: () => "SYNTHETIC",
      fetch: async () => new Response(body) });
    await assert.rejects(client.poll(id), { message: "invalid_gateway_response" });
  }
});
test("parser accepts supported lifecycle states, but never invalid or fallback completed notes", () => {
  for (const status of ["pending", "processing", "failed"]) {
    assert.equal(parseNoteJob({ ...pending, status }, id).status, status);
  }
  assert.equal(parseNoteJob({ ...completed, status: "review_required" }, id).status, "review_required");
  // Even a misconfigured provider cannot authorize its own output.
  assert.equal(parseNoteJob({ ...completed, review_required: false }, id).status, "completed");
  for (const note of [null, "", "Krátka", "x".repeat(20001),
    "Automatické zhrnutie správy nie je dostupné; vyžaduje sa manuálna kontrola."]) {
    assert.throws(() => parseNoteJob({ ...completed, note }, id), /invalid_gateway_note/);
  }
});
