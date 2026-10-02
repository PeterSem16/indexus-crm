import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import express from "express";
import session from "express-session";
import { build } from "esbuild";
import { WebSocket, WebSocketServer } from "ws";

const SESSION_SECRET = "synthetic-notification-session-test-secret";
const FIXTURE_USER_A = "notification-fixture-user-A";
const FIXTURE_USER_B = "notification-fixture-user-B";
const FIXTURE_STORAGE_KEY = "__notification_service_session_test_storage__";

interface FixtureNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  priority: string;
}

interface ClientConnection {
  socket: WebSocket;
  messages: Array<Record<string, any> | string>;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitUntil(predicate: () => boolean, label: string, timeoutMs = 2500) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await delay(10);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

function trackSocket(socket: WebSocket, sockets: Set<WebSocket>) {
  sockets.add(socket);
  socket.on("error", () => {
    // Handshake failures are expected in the unauthorized-session cases.
  });
}

function openWebSocket(
  url: string,
  sockets: Set<WebSocket>,
  cookie?: string,
): Promise<ClientConnection> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url, cookie ? { headers: { Cookie: cookie } } : undefined);
    trackSocket(socket, sockets);
    const connection: ClientConnection = { socket, messages: [] };
    socket.on("message", (data) => {
      const text = data.toString();
      try {
        connection.messages.push(JSON.parse(text));
      } catch {
        connection.messages.push(text);
      }
    });

    const timeout = setTimeout(() => {
      socket.terminate();
      reject(new Error("Timed out waiting for WebSocket connection"));
    }, 2500);
    socket.once("open", () => {
      clearTimeout(timeout);
      resolve(connection);
    });
    socket.once("error", () => {
      clearTimeout(timeout);
      reject(new Error("WebSocket connection failed"));
    });
  });
}

function expectUpgradeStatus(
  url: string,
  sockets: Set<WebSocket>,
  cookie?: string,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url, cookie ? { headers: { Cookie: cookie } } : undefined);
    trackSocket(socket, sockets);
    const timeout = setTimeout(() => {
      socket.terminate();
      reject(new Error("Timed out waiting for rejected WebSocket handshake"));
    }, 2500);
    socket.once("unexpected-response", (_request, response) => {
      clearTimeout(timeout);
      const statusCode = response.statusCode ?? 0;
      response.resume();
      socket.terminate();
      resolve(statusCode);
    });
    socket.once("open", () => {
      clearTimeout(timeout);
      socket.terminate();
      reject(new Error("Expected WebSocket handshake to be rejected"));
    });
    socket.once("error", () => {
      clearTimeout(timeout);
      reject(new Error("WebSocket handshake failed without an HTTP response"));
    });
  });
}

async function closeSocket(socket: WebSocket) {
  if (socket.readyState === WebSocket.CLOSED) return;
  const closed = new Promise<void>((resolve) => socket.once("close", () => resolve()));
  if (socket.readyState === WebSocket.OPEN) socket.close(1000, "test cleanup");
  else socket.terminate();
  await Promise.race([closed, delay(300)]);
  if (Number(socket.readyState) !== WebSocket.CLOSED) socket.terminate();
}

test(
  "notification WebSocket authenticates the shared Express session and preserves user routing",
  { timeout: 15_000 },
  async (t) => {
    const fixtureStorage = {
      notifications: [] as FixtureNotification[],
      unreadLookups: [] as string[],
      async createNotification(notification: Omit<FixtureNotification, "id">) {
        const created = {
          ...notification,
          id: `fixture-notification-${this.notifications.length + 1}`,
        };
        this.notifications.push(created);
        return created;
      },
      async getUnreadNotificationsCount(userId: string) {
        this.unreadLookups.push(userId);
        return 0;
      },
    };
    const globalWithFixture = globalThis as typeof globalThis & Record<string, any>;
    const fixtureDirectory = await mkdtemp(
      path.join(path.dirname(fileURLToPath(import.meta.url)), ".notification-session-bundle-"),
    );
    const bundlePath = path.join(fixtureDirectory, "notification-service.mjs");
    const trackedSockets = new Set<WebSocket>();
    const fixtureSymbol = Symbol.for(FIXTURE_STORAGE_KEY);
    globalWithFixture[fixtureSymbol as any] = fixtureStorage;

    let server: ReturnType<typeof createServer> | undefined;
    let routingWss: WebSocketServer | undefined;

    try {
      const servicePath = path.join(path.dirname(fileURLToPath(import.meta.url)), "notification-service.ts");
      const storageStub = `
        const fixture = globalThis[Symbol.for(${JSON.stringify(FIXTURE_STORAGE_KEY)})];
        if (!fixture) throw new Error("Notification fixture storage was not installed");
        const unexpectedStorageAccess = (method) => {
          throw new Error("Unexpected notification fixture storage access: " + method);
        };
        export const storage = {
          createNotification: (...args) => fixture.createNotification(...args),
          getUnreadNotificationsCount: (...args) => fixture.getUnreadNotificationsCount(...args),
          getActiveNotificationRulesByTrigger: () => unexpectedStorageAccess("getActiveNotificationRulesByTrigger"),
          getAllUsers: () => unexpectedStorageAccess("getAllUsers"),
          markNotificationRead: () => unexpectedStorageAccess("markNotificationRead"),
          markAllNotificationsRead: () => unexpectedStorageAccess("markAllNotificationsRead")
        };
      `;

      await build({
        entryPoints: [servicePath],
        outfile: bundlePath,
        bundle: true,
        platform: "node",
        format: "esm",
        packages: "external",
        logLevel: "silent",
        plugins: [
          {
            name: "notification-session-fixture-storage",
            setup(builder) {
              builder.onResolve({ filter: /^\.\.\/storage$/ }, () => ({
                path: "fixture-storage",
                namespace: "notification-session-fixture",
              }));
              builder.onLoad(
                { filter: /.*/, namespace: "notification-session-fixture" },
                () => ({ contents: storageStub, loader: "js" }),
              );
            },
          },
        ],
      });

      const { notificationService } = await import(pathToFileURL(bundlePath).href);
      const app = express();
      const memoryStore = new session.MemoryStore();
      const sharedSessionMiddleware = session({
        secret: SESSION_SECRET,
        store: memoryStore,
        resave: false,
        saveUninitialized: false,
        cookie: { httpOnly: true, secure: false, sameSite: "lax" },
      });
      app.use(sharedSessionMiddleware);
      app.get("/__fixture/init/:userId", (req, res) => {
        const userId = req.params.userId;
        if (userId !== FIXTURE_USER_A && userId !== FIXTURE_USER_B) {
          res.status(404).end();
          return;
        }
        (req as any).session.user = { id: userId };
        (req as any).session.save((error?: Error) => {
          if (error) {
            res.status(500).end();
            return;
          }
          res.status(200).json({ initialized: true });
        });
      });

      server = createServer(app);
      notificationService.initialize(server, sharedSessionMiddleware);

      // Isolated path-gated handler proves the notification listener leaves unrelated
      // upgrades alone. It does not connect to, simulate, or touch an Asterisk server.
      routingWss = new WebSocketServer({ noServer: true, perMessageDeflate: false });
      routingWss.on("connection", (socket) => socket.send("unrelated-route-ok"));
      server.on("upgrade", (req, socket, head) => {
        if (req.url?.split("?")[0] !== "/__notification-routing-smoke") return;
        routingWss!.handleUpgrade(req, socket, head, (webSocket) => {
          routingWss!.emit("connection", webSocket, req);
        });
      });

      await new Promise<void>((resolve, reject) => {
        server!.once("error", reject);
        server!.listen(0, "127.0.0.1", resolve);
      });
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Local HTTP server did not bind a TCP port");
      const baseUrl = `http://127.0.0.1:${address.port}`;
      const wsBaseUrl = `ws://127.0.0.1:${address.port}`;

      const initializeFixtureSession = async (userId: string) => {
        const response = await fetch(`${baseUrl}/__fixture/init/${encodeURIComponent(userId)}`);
        if (response.status !== 200) throw new Error("Fixture session initialization failed");
        const setCookie = response.headers.get("set-cookie");
        if (!setCookie) throw new Error("Fixture endpoint did not issue a session cookie");
        return setCookie.split(";", 1)[0];
      };

      await t.test("rejects an unauthenticated upgrade", async () => {
        assert.equal(
          await expectUpgradeStatus(`${wsBaseUrl}/ws/notifications`, trackedSockets),
          401,
        );
      });

      await t.test("never treats a query-only userId as an identity", async () => {
        assert.equal(
          await expectUpgradeStatus(
            `${wsBaseUrl}/ws/notifications?userId=${encodeURIComponent(FIXTURE_USER_A)}`,
            trackedSockets,
          ),
          401,
        );
      });

      await t.test("rejects an invalid signed-session cookie", async () => {
        assert.equal(
          await expectUpgradeStatus(
            `${wsBaseUrl}/ws/notifications`,
            trackedSockets,
            "connect.sid=not-a-valid-signed-session-cookie",
          ),
          401,
        );
      });

      await t.test("uses the signed session identity and delivers only to its user", async () => {
        const cookie = await initializeFixtureSession(FIXTURE_USER_A);
        const connection = await openWebSocket(
          `${wsBaseUrl}/ws/notifications?userId=${encodeURIComponent(FIXTURE_USER_B)}`,
          trackedSockets,
          cookie,
        );
        try {
          await waitUntil(
            () => connection.messages.some((message) => typeof message === "object" && message.type === "connected"),
            "authenticated connected frame",
          );
          await waitUntil(
            () => connection.messages.some((message) => typeof message === "object" && message.type === "unreadCount"),
            "initial unread count",
          );
          assert.equal(notificationService.isUserConnected(FIXTURE_USER_A), true);
          assert.equal(notificationService.isUserConnected(FIXTURE_USER_B), false);
          assert.ok(fixtureStorage.unreadLookups.includes(FIXTURE_USER_A));
          assert.ok(!fixtureStorage.unreadLookups.includes(FIXTURE_USER_B));

          await notificationService.sendNotificationToUsers([FIXTURE_USER_B], {
            type: "session-integration",
            title: "Only for B",
            message: "Must not be delivered to A",
            priority: "normal",
          });
          await delay(40);
          assert.equal(
            connection.messages.filter(
              (message) =>
                typeof message === "object" &&
                message.type === "notification" &&
                message.notification?.title === "Only for B",
            ).length,
            0,
          );

          await notificationService.sendNotificationToUsers([FIXTURE_USER_A], {
            type: "session-integration",
            title: "For A",
            message: "Delivered exactly once",
            priority: "normal",
          });
          await waitUntil(
            () =>
              connection.messages.filter(
                (message) =>
                  typeof message === "object" &&
                  message.type === "notification" &&
                  message.notification?.title === "For A",
              ).length === 1,
            "the notification for the session user",
          );
          await delay(40);
          assert.equal(
            connection.messages.filter(
              (message) =>
                typeof message === "object" &&
                message.type === "notification" &&
                message.notification?.title === "For A",
            ).length,
            1,
          );
        } finally {
          await closeSocket(connection.socket);
        }
      });

      await t.test("leaves an unrelated path-gated WebSocket route available", async () => {
        const connection = await openWebSocket(
          `${wsBaseUrl}/__notification-routing-smoke`,
          trackedSockets,
        );
        try {
          await waitUntil(
            () => connection.messages.includes("unrelated-route-ok"),
            "unrelated route response",
          );
          assert.equal(connection.messages.includes("unrelated-route-ok"), true);
        } finally {
          await closeSocket(connection.socket);
        }
      });

      await t.test("records offline notification persistence through fixture storage", async () => {
        const offlineUserId = "notification-fixture-offline-user";
        const previousCount = fixtureStorage.notifications.length;
        assert.equal(notificationService.isUserConnected(offlineUserId), false);
        await notificationService.sendNotificationToUsers([offlineUserId], {
          type: "session-integration-offline",
          title: "Persist while offline",
          message: "Fixture storage records this without a database",
          priority: "normal",
        });
        const persisted = fixtureStorage.notifications.slice(previousCount);
        assert.equal(persisted.length, 1);
        assert.equal(persisted[0]?.userId, offlineUserId);
        assert.equal(persisted[0]?.title, "Persist while offline");
      });
    } finally {
      await Promise.all([...trackedSockets].map((socket) => closeSocket(socket)));
      if (routingWss) {
        await new Promise<void>((resolve) => routingWss!.close(() => resolve()));
      }
      if (server?.listening) {
        await new Promise<void>((resolve, reject) => {
          server!.close((error) => (error ? reject(error) : resolve()));
        });
      }
      delete globalWithFixture[fixtureSymbol as any];
      await rm(fixtureDirectory, { recursive: true, force: true });
    }
  },
);