import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const inboundRoutes = readFileSync("server/inbound-routes.ts", "utf8");
const workspace = readFileSync("client/src/pages/agent-workspace.tsx", "utf8");
const queueEditor = readFileSync("client/src/components/campaigns/InboundQueuesTab.tsx", "utf8");

test("missed-call list is keyed and requested by selected Mission", () => {
  assert.match(
    workspace,
    /queryKey:\s*\["\/api\/agent\/abandoned-calls",\s*selectedCampaignId\s*\|\|\s*null\]/,
  );
  assert.match(
    workspace,
    /\/api\/agent\/abandoned-calls\?campaignId=\$\{encodeURIComponent\(selectedCampaignId\)\}/,
  );
});

test("every called-back client request carries Mission context", () => {
  const requestUrls = [...workspace.matchAll(/`(\/api\/agent\/abandoned-calls\/\$\{[^`]+called-back[^`]*)`/g)]
    .map(match => match[1]);
  assert.ok(requestUrls.length >= 3);
  assert.ok(requestUrls.every(url => url.includes("campaign")));
});

test("server scopes calls by authoritative per-call Mission with legacy queue fallback", () => {
  assert.match(inboundRoutes, /NULLIF\(\$\{inboundCallLogs\.metadata\}->>'campaignId',\s*''\)/);
  assert.match(inboundRoutes, /Mission is not active in this shift/);
  assert.match(inboundRoutes, /Mission is not assigned/);
  assert.match(inboundRoutes, /Call is not available in this Mission/);
});

test("queue editor requires an explicit Mission association", () => {
  assert.match(queueEditor, /campaignId:\s*string/);
  assert.match(queueEditor, /data-testid="select-queue-campaign"/);
  assert.match(inboundRoutes, /if\s*\(!data\.campaignId\)\s*return res\.status\(400\)/);
});