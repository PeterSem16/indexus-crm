import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { JSDOM } from "jsdom";
import { queryClient } from "../../lib/queryClient";
import { useContactLoads } from "./use-contact-loads";
import type { ContactLoadsController } from "./use-contact-loads";
import { contactLoadTranslations } from "./contact-load-translations";

test("preview races, invalid loads, same-batch transport retry and protected undo", async () => {
  const dom = new JSDOM("<div id='root'></div>", { url: "http://localhost" });
  const saved = { window: globalThis.window, document: globalThis.document, fetch: globalThis.fetch };
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
  const root = createRoot(document.getElementById("root")!);
  let controller: ContactLoadsController;
  const calls: { url: string; init?: RequestInit }[] = [];
  let response: (url: string) => Response | Promise<Response> = () => json({ batches: [] });
  const json = (data: unknown) => new Response(JSON.stringify(data), { status: 200, headers: { "Content-Type": "application/json" } });
  const batch = (id: string, invalid = 0) => ({
    id, status: "preview", source: "crm", createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    counts: { new: 0, existing: 11, invalid }, items: [],
  });
  globalThis.fetch = async (input, init) => {
    const url = String(input); calls.push({ url, init });
    if (init?.method === "GET") return json({ batches: [] });
    return response(url);
  };
  function Harness({ mission, filters, file }: { mission: string; filters: string; file: File | null }) {
    controller = useContactLoads(mission, filters, file, contactLoadTranslations.en);
    return null;
  }
  async function render(mission: string, filters = "a", file: File | null = null) {
    await act(async () => { root.render(createElement(QueryClientProvider, { client: queryClient }, createElement(Harness, { mission, filters, file }))); });
  }
  const originalInvalidate = queryClient.invalidateQueries.bind(queryClient);
  const invalidated: unknown[] = [];
  queryClient.invalidateQueries = ((args: { queryKey: unknown }) => {
    invalidated.push(args.queryKey); return Promise.resolve();
  }) as typeof queryClient.invalidateQueries;
  try {
    await render("mission-a");
    let finish!: (response: Response) => void;
    response = () => new Promise(resolve => { finish = resolve; });
    let pending!: Promise<boolean>;
    await act(async () => { pending = controller!.createPreview({ source: "crm" }); });
    await render("mission-b");
    await act(async () => { finish(json(batch("old-mission-batch"))); await pending; });
    assert.equal(controller!.preview, null, "late responses from another Mission are ignored");
    assert.equal(controller!.busy, false);

    response = () => json(batch("filter-preview"));
    await act(async () => { await controller!.createPreview({ source: "crm" }); });
    assert.equal(controller!.preview?.id, "filter-preview");
    await render("mission-b", "changed-filters");
    assert.equal(controller!.preview, null, "filter changes discard previous preview");
    const file = new dom.window.File(["name;country"], "contacts.csv") as unknown as File;
    await render("mission-b", "changed-filters", file);
    response = () => json(batch("file-preview"));
    const form = new FormData();
    form.append("source", "file");
    form.append("contactType", "customer");
    form.append("file", new Blob(["name;country"]), "contacts.csv");
    await act(async () => { await controller!.createPreview(form); });
    const upload = calls.at(-1)!;
    assert.equal(upload.init?.body, form, "file previews use multipart rather than JSON");
    assert.equal(upload.init?.headers, undefined, "browser supplies multipart boundary");
    await render("mission-b", "changed-filters", new dom.window.File(["other"], "other.csv") as unknown as File);
    assert.equal(controller!.preview, null, "changing files invalidates the review");

    response = () => json(batch("invalid", 1));
    await act(async () => { await controller!.createPreview({ source: "crm" }); });
    const beforeInvalidApply = calls.length;
    await act(async () => { await controller!.apply(); });
    assert.equal(calls.length, beforeInvalidApply, "invalid rows block POST apply");

    response = () => json(batch("retry-this-batch"));
    await act(async () => { await controller!.createPreview({ source: "crm" }); });
    response = () => { throw new TypeError("Network connection dropped"); };
    await act(async () => { await controller!.apply(); });
    assert.equal(controller!.ambiguous, true);
    assert.equal(controller!.preview?.id, "retry-this-batch");
    await act(async () => { controller!.closeReview(); });
    assert.equal(controller!.reviewOpen, true, "unconfirmed apply retains the review");
    response = () => json({ id: "retry-this-batch", status: "applied", added: 0, existing: 11 });
    await act(async () => { await controller!.apply(); });
    const applyCalls = calls.filter(call => call.url.endsWith("/apply"));
    assert.equal(applyCalls.length, 2);
    assert.equal(applyCalls[0].url, applyCalls[1].url, "transport retries reuse the exact batch");
    assert.equal(controller!.preview, null);
    assert.equal(controller!.ambiguous, false);
    assert.equal(controller!.historyOpen, true);
    assert.ok(controller!.notice?.includes("0"));
    for (const name of ["contacts", "stats", "contact-loads"]) {
      assert.ok(invalidated.some(key => Array.isArray(key) && key.at(-1) === name));
    }
    assert.ok(invalidated.some(key => Array.isArray(key) && key[0] === "/api/campaigns/contact-counts"));

    response = () => json({ removable: 7, protected: 4, missing: 1 });
    await act(async () => { await controller!.reviewUndo("applied-batch"); });
    assert.deepEqual(controller!.undoReview?.counts, { removable: 7, protected: 4, missing: 1 });
    // The UI uses final counts, not the potentially stale undo-preview counts.
    response = () => json({ removed: 5, protected: 6, missing: 1, status: "undone" });
    await act(async () => { await controller!.undo(); });
    assert.equal(controller!.undoReview, null);
    assert.ok(controller!.notice?.includes("Protected: 6"));
    assert.ok(calls.some(call => call.url.endsWith("/applied-batch/undo-preview")));
    assert.ok(calls.some(call => call.url.endsWith("/applied-batch/undo") && call.init?.body === "{}"));
  } finally {
    await act(async () => { root.unmount(); });
    queryClient.invalidateQueries = originalInvalidate;
    queryClient.clear();
    Object.assign(globalThis, saved);
    dom.window.close();
  }
});
