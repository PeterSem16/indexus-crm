import assert from "node:assert/strict";
import test from "node:test";
import { AriClient } from "./ari-client";

test("standing mixed capture targets the mixing bridge and never a bridged channel", async () => {
  const client = new AriClient({
    host: "unused", port: 80, protocol: "http", username: "", password: "",
    appName: "test", wsProtocol: "ws", wsPort: 80,
  });
  let request: { method: string; endpoint: string } | undefined;
  (client as any).ariRequest = async (method: string, endpoint: string) => {
    request = { method, endpoint };
    return { name: "recording" };
  };
  await client.startBridgeRecording("bridge/test", { name: "mobile_test_standing_1", format: "wav", ifExists: "fail" });
  assert.equal(request?.method, "POST");
  assert.ok(request?.endpoint.startsWith("/bridges/bridge%2Ftest/record?"));
  assert.ok(!request?.endpoint.includes("/channels/"));
  const params = new URLSearchParams(request!.endpoint.split("?")[1]);
  assert.equal(params.get("name"), "mobile_test_standing_1");
  assert.equal(params.get("format"), "wav");
  assert.equal(params.get("ifExists"), "fail");
});
