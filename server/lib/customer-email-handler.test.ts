import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import test from "node:test";
import express from "express";
import type { CommunicationMessage, Customer } from "../../shared/schema";
import { createCustomerEmailHandler } from "./customer-email-handler";
import { statusListHistoryFacts } from "./status-list-history";

for (const scenario of ["missing", "blank", "accepted", "rejected", "network"] as const) {
  test(`customer email: ${scenario}`, async () => {
    // Include a legacy row to catch accidental historical rewrites.
    const legacy = { id: "legacy", type: "email", status: "sent", sentAt: new Date(0) };
    const original = structuredClone(legacy);
    const rows: CommunicationMessage[] = [];
    const activities: unknown[][] = [];
    const requests: { url: unknown; init: RequestInit | undefined }[] = [];
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.session = { user: { id: "agent" } } as typeof req.session;
      next();
    });
    app.post("/api/customers/:customerId/messages/email", createCustomerEmailHandler({
      storage: {
        async getCustomer() {
          return { id: "customer", email: "recipient@example.invalid", firstName: "Test", lastName: "Customer" } as Customer;
        },
        async createCommunicationMessage(data) {
          const row = {
            ...data, id: "new", direction: "outbound", sentAt: null,
          } as CommunicationMessage;
          rows.push(row);
          return { ...row };
        },
        async updateCommunicationMessage(id, patch) {
          const row = rows.find(row => row.id === id);
          assert.ok(row, "only the newly created row may be updated");
          Object.assign(row, patch);
          return row;
        },
      },
      config: () => ({
        apiKey: scenario === "missing" ? undefined : scenario === "blank" ? "   " : "fake-test-key",
        fromEmail: "sender@example.invalid",
      }),
      fetch: async (url, init) => {
        requests.push({ url, init });
        if (scenario === "network") throw new Error("sensitive transport details");
        return new Response(scenario === "accepted" ? null : "sensitive provider details", {
          status: scenario === "accepted" ? 202 : 403,
        });
      },
      async logActivity(...args) { activities.push(args); },
    }));
    const server = createServer(app);
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    try {
      const address = server.address();
      assert.ok(address && typeof address !== "string");
      const response = await fetch(`http://127.0.0.1:${address.port}/api/customers/customer/messages/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: "Subject", content: "Body" }),
      });
      const body = await response.json();
      assert.deepEqual(legacy, original);
      assert.equal(body.simulated, undefined);
      const facts = statusListHistoryFacts({
        calls: [],
        messages: rows.map(row => ({ type: row.type, direction: row.direction, status: row.status })),
      });
      assert.equal(facts["history.email_sent"], scenario === "accepted");
      assert.equal(activities.length, scenario === "accepted" ? 1 : 0);
      if (scenario === "missing" || scenario === "blank") {
        assert.equal(response.status, 503);
        assert.equal(body.code, "EMAIL_PROVIDER_NOT_CONFIGURED");
        assert.match(body.error, /not sent/);
        assert.equal(rows.length, 0);
        assert.equal(requests.length, 0);
        assert.equal(facts["history.outreach_attempted"], false);
      } else {
        assert.equal(requests.length, 1);
        assert.equal(requests[0].url, "https://api.sendgrid.com/v3/mail/send");
        assert.equal(requests[0].init?.method, "POST");
        const payload = JSON.parse(requests[0].init!.body as string);
        assert.equal(payload.personalizations[0].to[0].email, "recipient@example.invalid");
        assert.equal(payload.from.email, "sender@example.invalid");
        assert.equal(payload.subject, "Subject");
        assert.deepEqual(payload.content, [{ type: "text/plain", value: "Body" }]);
        assert.equal(rows.length, 1);
        if (scenario === "accepted") {
          assert.equal(response.status, 200);
          assert.equal(body.status, "sent");
          assert.equal(rows[0].status, "sent");
          assert.ok(rows[0].sentAt instanceof Date);
          assert.equal(body.sentAt, rows[0].sentAt.toISOString());
          assert.equal(activities[0][1], "send_email");
        } else {
          assert.equal(response.status, 502);
          assert.equal(body.code, scenario === "network" ? "EMAIL_PROVIDER_NETWORK_ERROR" : "EMAIL_PROVIDER_REJECTED");
          assert.equal(rows[0].status, "failed");
          assert.equal(rows[0].sentAt, null);
          assert.doesNotMatch(JSON.stringify({ body, row: rows[0] }), /sensitive/);
        }
      }
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  });
}

test("production route retains authentication and uses the tested handler", () => {
  const source = readFileSync(new URL("../routes.ts", import.meta.url), "utf8");
  assert.match(source, /app\.post\("\/api\/customers\/:customerId\/messages\/email", requireAuth, createCustomerEmailHandler\(/);
});
