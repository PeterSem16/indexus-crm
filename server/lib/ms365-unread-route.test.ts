import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { transformSync } from "esbuild";

// Run the real registered route AND its real authentication middleware.
// Mock only storage and Microsoft boundaries; no production authentication bypass.
function fixture(options: { connected?: boolean; refreshed?: boolean; invalidToken?: boolean } = {}) {
  const source = readFileSync(new URL("../routes.ts", import.meta.url), "utf8");
  const authStart = source.indexOf("  const requireAuth = (req:");
  const authEnd = source.indexOf("\n  };", authStart) + "\n  };".length;
  const routeStart = source.indexOf('  app.get("/api/users/:userId/ms365-unread-counts"');
  const routeEnd = source.indexOf("\n  app.", routeStart + 1);
  assert.ok(authStart >= 0 && authEnd > authStart && routeStart >= 0 && routeEnd > routeStart);
  const code = transformSync(`${source.slice(authStart, authEnd)}\n${source.slice(routeStart, routeEnd)}`, {
    loader: "ts", format: "cjs", supported: { "dynamic-import": false },
  }).code;
  let reads = 0, graphCalls = 0, updated = 0;
  const storage = {
    getUserMs365Connection: async (userId: string) => {
      reads++;
      assert.equal(userId, "owner");
      return { isConnected: options.connected !== false, accessToken: "fixture-only", refreshToken: "fixture-only" };
    },
    getUserMs365SharedMailboxes: async () => [
      { email: "shared@example.invalid", isActive: true },
      { email: "disabled@example.invalid", isActive: false },
    ],
    updateUserMs365Connection: async (userId: string) => { assert.equal(userId, "owner"); updated++; },
  };
  const dependencies: Record<string, unknown> = {
    "./lib/token-crypto": { decryptTokenSafe: (value: string) => value, encryptTokenWithMarker: (value: string) => value },
    "./lib/ms365": {
      getValidAccessToken: async () => options.invalidToken ? null : {
        accessToken: "fixture-only", refreshed: !!options.refreshed, expiresOn: new Date(),
      },
      getAllMailboxUnreadCounts: async (_token: string, mailboxes: string[]) => {
        graphCalls++;
        assert.deepEqual(mailboxes, ["shared@example.invalid"]);
        return [
          { mailbox: "personal", unreadCount: 3, accessible: true },
          { mailbox: "shared@example.invalid", unreadCount: 55, accessible: true },
          { mailbox: "denied@example.invalid", unreadCount: 900, accessible: false },
        ];
      },
    },
  };
  let middleware: any, handler: any;
  new Function("app", "storage", "require", code)({
    get: (path: string, auth: any, route: any) => {
      assert.equal(path, "/api/users/:userId/ms365-unread-counts");
      middleware = auth; handler = route;
    },
  }, storage, (id: string) => {
    if (!Object.prototype.hasOwnProperty.call(dependencies, id)) throw new Error(`Unexpected dependency: ${id}`);
    return dependencies[id];
  });
  return {
    stats: () => ({ reads, graphCalls, updated }),
    request: async (session: Record<string, unknown>, userId = "owner") => {
      let status = 200, body: any, authorized = false;
      const res = { status: (value: number) => { status = value; return res; }, json: (value: unknown) => { body = value; return res; } };
      const req = { session, params: { userId } };
      middleware(req, res, () => { authorized = true; });
      if (authorized) await handler(req, res);
      return { status, body };
    },
  };
}

test("actual session.user.id can load personal and accessible shared unread counts", async () => {
  const app = fixture();
  const response = await app.request({ user: { id: "owner" } });
  assert.equal(response.status, 200);
  assert.equal(response.body.connected, true);
  assert.equal(response.body.totalUnread, 58);
  assert.deepEqual(app.stats(), { reads: 1, graphCalls: 1, updated: 0 });
});

test("another user's URL stays forbidden, even with a forged legacy session.userId", async () => {
  const app = fixture();
  assert.equal((await app.request({ user: { id: "other" }, userId: "owner" })).status, 403);
  assert.deepEqual(app.stats(), { reads: 0, graphCalls: 0, updated: 0 });
});

test("missing authenticated user never reads a mailbox", async () => {
  const app = fixture();
  assert.equal((await app.request({})).status, 401);
  assert.equal((await app.request({ userId: "owner" })).status, 401);
  assert.deepEqual(app.stats(), { reads: 0, graphCalls: 0, updated: 0 });
});

test("disconnected and expired connections are explicit, refreshed tokens retain counts", async () => {
  const disconnected = fixture({ connected: false });
  assert.equal((await disconnected.request({ user: { id: "owner" } })).body.connected, false);
  assert.equal(disconnected.stats().graphCalls, 0);
  const expired = fixture({ invalidToken: true });
  assert.equal((await expired.request({ user: { id: "owner" } })).body.requiresReauth, true);
  assert.equal(expired.stats().graphCalls, 0);
  const refreshed = fixture({ refreshed: true });
  assert.equal((await refreshed.request({ user: { id: "owner" } })).body.totalUnread, 58);
  assert.equal(refreshed.stats().updated, 1);
});
