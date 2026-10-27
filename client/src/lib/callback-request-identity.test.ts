import assert from "node:assert/strict";
import { callbackRequestIdentity, acknowledgeCallbackRequest } from "./callback-request-identity";
const data = new Map<string, string>();
const storage = {
  getItem: (key: string) => data.get(key) ?? null,
  setItem: (key: string, value: string) => { data.set(key, value); },
  removeItem: (key: string) => { data.delete(key); },
};
const url = "/api/campaigns/m/contacts/c/status-list-actions/a/run";
const first = callbackRequestIdentity(url, storage, () => "request-1");
assert.equal(callbackRequestIdentity(url, storage, () => "request-2"), first, "transport error/reload keeps identity");
assert.notEqual(callbackRequestIdentity(url.replace("/c/", "/other/"), storage, () => "other"), first);
acknowledgeCallbackRequest(url, storage);
assert.equal(callbackRequestIdentity(url, storage, () => "request-3"), "request-3");
assert.deepEqual([...data.values()].sort(), ["other", "request-3"]);
console.log("Manual callback request identity survives retry and reload, scopes contacts, and clears only on acknowledgment.");
