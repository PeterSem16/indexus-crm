import { test } from "node:test";
import assert from "node:assert/strict";
import { processMissionEmailSchedule } from "./mission-email-scheduler";
import { missionEmailPeriod } from "../../shared/mission-email-schedule";
export function scheduleFixture(options: { unauthorized?: string; unknown?: boolean; enabled?: boolean; lock?: boolean } = {}) {
  const now = new Date("2026-11-02T07:01:00Z");
  const schedule: any = { id: "schedule", campaign_id: "mission", created_by: "owner",
    report_types: ["mission_insights"], recipient_user_ids: ["recipient"], send_time: "08:00",
    enabled: options.enabled ?? true, next_run_at: new Date("2026-11-02T07:00Z"),
    delivery_options: { frequency: "daily", weekday: 1, monthDay: 1, country: "SK", locale: "sk" } };
  const ledger = new Map<string, string>(), queries: string[] = [], sends: any[] = [];
  if (options.unknown) ledger.set("2026-11-01:2026-11-01:recipient", "sending");
  let builds = 0, released = false, deleted = false;
  const query = async (sql: string, args: any[] = []) => {
    queries.push(sql);
    const result = (rows: any[] = [], rowCount = rows.length) => ({ rows, rowCount });
    if (sql.includes("pg_try_advisory_lock")) return result([{ locked: options.lock ?? true }]);
    if (sql.includes("pg_advisory_unlock")) return result([{}]);
    if (sql.includes("FROM users u CROSS JOIN campaigns")) return args[0] === options.unauthorized ? result() : result([{
      role: "admin", role_id: null, assigned_countries: ["SK"], country_codes: ["SK"],
      assigned: true, module_read: true, module_edit: true, name: "Mission", settings: {},
    }]);
    if (sql.includes("SELECT id,email FROM users")) return result([{ id: args[0], email: "recipient@example.test" }]);
    if (sql.includes("SELECT report_types")) return result([{ report_types: schedule.report_types }]);
    if (sql.includes("SELECT * FROM scheduled_reports")) return deleted || args[0] && args[0] !== "schedule" || args[1] && args[1] !== "mission" ? result() : result([schedule]);
    if (sql.includes("INSERT INTO mission_report_deliveries")) {
      const key = `${args[1]}:${args[2]}`;
      if (ledger.has(key)) return result();
      ledger.set(key, "sending"); return result([{ recipient_id: args[2] }]);
    }
    if (sql.includes("SELECT status FROM mission_report_deliveries")) {
      const status = ledger.get(`${args[1]}:${args[2]}`) ??
        (args[3] === "recipient@example.test" ? ledger.get(`${args[1]}:recipient`) : undefined);
      return result(status ? [{ status }] : []);
    }
    if (sql.includes("SELECT count(*)::int AS count FROM mission_report_deliveries"))
      return result([{ count: [...ledger.keys()].filter(key => key.startsWith("test:")).length }]);
    if (sql.includes("UPDATE mission_report_deliveries")) {
      ledger.set(`${args[1]}:${args[2]}`, sql.includes("status='sent'") ? "sent" : "unknown"); return result();
    }
    if (sql.includes("last_run_at=$2")) {
      schedule.last_run_at = args[1]; schedule.next_run_at = args[2]; schedule.delivery_options.lastStatus = args[3]; return result();
    }
    if (sql.includes("SELECT u.id,COALESCE")) return result([{ id: "recipient", name: "Recipient", email: "recipient@example.test" }]);
    if (sql.includes('AS "recipientUserIds"')) return result([]);
    if (sql.includes("INSERT INTO scheduled_reports")) {
      Object.assign(schedule, { campaign_id: args[0], report_types: [args[1]], recipient_user_ids: args[2],
        send_time: args[3], enabled: args[4], delivery_options: JSON.parse(args[5]), next_run_at: args[6], created_by: args[7], external_emails: args[8] });
      return result([{ id: "schedule" }]);
    }
    if (sql.includes("UPDATE scheduled_reports SET recipient_user_ids")) {
      Object.assign(schedule, { recipient_user_ids: args[2], send_time: args[3], enabled: args[4],
        delivery_options: JSON.parse(args[5]), next_run_at: args[6], created_by: args[7], external_emails: args[8] });
      return result([{ id: "schedule" }]);
    }
    if (sql.includes("DELETE FROM scheduled_reports")) { deleted = true; return result(); }
    return result();
  };
  const database = { query, connect: async () => ({ query, release() { released = true; } }) } as any;
  const dependencies = {
    now: () => now,
    build: async () => { builds++; return { subject: "Report", html: "<p>Report</p>", from: "01.11.2026", to: "01.11.2026",
      period: missionEmailPeriod("daily", now) }; },
    send: async (...args: any[]) => { sends.push(args); },
  };
  return { schedule, ledger, queries, sends, dependencies, database, builds: () => builds, released: () => released };
}
test("external-only schedules deliver individually from country mailbox and suppress replay", async () => {
  const f = scheduleFixture();
  f.schedule.recipient_user_ids = [];
  f.schedule.external_emails = [" External@Example.test ", "external@example.test"];
  await processMissionEmailSchedule("schedule", f.dependencies as any, f.database);
  assert.equal(f.sends.length, 1); assert.equal(f.sends[0][1], "external@example.test");
  f.schedule.next_run_at = new Date("2026-11-02T07:00:00Z");
  await processMissionEmailSchedule("schedule", f.dependencies as any, f.database);
  assert.equal(f.sends.length, 1);
  assert.ok(![...f.ledger.keys()].some(key => key.includes("external@example.test")));
});
test("mixed recipients are deduplicated by address even after switching internal/external selection", async () => {
  const f = scheduleFixture();
  f.schedule.external_emails = ["RECIPIENT@example.test", "other@example.test"];
  await processMissionEmailSchedule("schedule", f.dependencies as any, f.database);
  assert.deepEqual(f.sends.map(args => args[1]).sort(), ["other@example.test", "recipient@example.test"]);
  f.schedule.recipient_user_ids = [];
  f.schedule.next_run_at = new Date("2026-11-02T07:00:00Z");
  await processMissionEmailSchedule("schedule", f.dependencies as any, f.database);
  assert.equal(f.sends.length, 2);
});
test("external recipients do not bypass creator authority or sender-country restrictions", async () => {
  for (const options of [{ unauthorized: "owner" }, {}]) {
    const f = scheduleFixture(options);
    f.schedule.recipient_user_ids = []; f.schedule.external_emails = ["outside@example.test"];
    if (!options.unauthorized) f.schedule.delivery_options.country = "IT";
    await processMissionEmailSchedule("schedule", f.dependencies as any, f.database);
    assert.equal(f.sends.length, 0);
  }
});
test("due schedule sends both reports once and advances the recurring slot", async () => {
  const f = scheduleFixture();
  await processMissionEmailSchedule("schedule", f.dependencies as any, f.database);
  assert.equal(f.builds(), 1); assert.equal(f.sends.length, 1);
  assert.equal(f.schedule.next_run_at.toISOString(), "2026-11-03T07:00:00.000Z");
  assert.equal(f.schedule.delivery_options.lastStatus, "sent"); assert.equal(f.released(), true);
  await processMissionEmailSchedule("schedule", f.dependencies as any, f.database);
  assert.equal(f.sends.length, 1);
});
test("restart cannot repeat an accepted send for the same recipient and period", async () => {
  const f = scheduleFixture();
  await processMissionEmailSchedule("schedule", f.dependencies as any, f.database);
  f.schedule.next_run_at = new Date("2026-11-02T07:00Z");
  await processMissionEmailSchedule("schedule", f.dependencies as any, f.database);
  assert.equal(f.sends.length, 1);
});
test("ambiguous in-flight delivery is not retried after restart", async () => {
  const f = scheduleFixture({ unknown: true });
  await processMissionEmailSchedule("schedule", f.dependencies as any, f.database);
  assert.equal(f.sends.length, 0); assert.equal(f.schedule.delivery_options.lastStatus, "unknown");
});
for (const unauthorized of ["owner", "recipient"]) test(`permission revoked for ${unauthorized} blocks sending`, async () => {
  const f = scheduleFixture({ unauthorized });
  await processMissionEmailSchedule("schedule", f.dependencies as any, f.database);
  assert.equal(f.sends.length, 0); assert.equal(f.schedule.delivery_options.lastStatus, "blocked");
});
for (const options of [{ enabled: false }, { lock: false }]) test(`disabled or locked schedule does not send ${JSON.stringify(options)}`, async () => {
  const f = scheduleFixture(options);
  await processMissionEmailSchedule("schedule", f.dependencies as any, f.database);
  assert.equal(f.sends.length, 0); assert.equal(f.builds(), 0); assert.equal(f.released(), true);
});
test("provider uncertainty is recorded without leaking its error or retrying", async () => {
  const f = scheduleFixture();
  f.dependencies.send = async () => { throw new Error("sensitive vendor text"); };
  await processMissionEmailSchedule("schedule", f.dependencies as any, f.database);
  assert.equal([...f.ledger.values()][0], "unknown");
  assert.equal(f.schedule.delivery_options.lastStatus, "unknown");
  assert.ok(!JSON.stringify(f.schedule).includes("sensitive"));
});
test("two authorized user accounts sharing an email receive one copy", async () => {
  const f = scheduleFixture(); f.schedule.recipient_user_ids = ["recipient", "another"];
  await processMissionEmailSchedule("schedule", f.dependencies as any, f.database);
  assert.equal(f.sends.length, 1);
});
test("a later denied recipient cannot hide an uncertain earlier send", async () => {
  const f = scheduleFixture({ unauthorized: "denied" }); f.schedule.recipient_user_ids = ["recipient", "denied"];
  f.dependencies.send = async () => { throw new Error("uncertain"); };
  await processMissionEmailSchedule("schedule", f.dependencies as any, f.database);
  assert.equal(f.schedule.delivery_options.lastStatus, "unknown");
});
