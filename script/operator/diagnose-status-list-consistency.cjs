#!/usr/bin/env node
// Read-only incident capture. Never repairs rows or executes application startup.
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const cp = require("node:child_process");
const crypto = require("node:crypto");
const APP = "/var/www/indexus-crm";
const MISSION = "a65e7775-885c-4413-b2be-e63c92decd3d";
const digest = text => crypto.createHash("sha256").update(text).digest("hex");
function reportSnapshot({ mission, contacts, items, states, history }) {
  const catalog = new Map(items.map(i => [i.id, i]));
  const byContact = new Map(contacts.map(c => [c.id, c]));
  const current = new Map(states.map(s => [`${s.campaign_contact_id}:${s.status_list_item_id}`, s]));
  const latest = new Map();
  // SQL orders by precise PostgreSQL timestamps, not JavaScript millisecond dates.
  for (const h of history) {
    if (h.action !== "status_list_confirmation" || typeof h.confirmed !== "boolean" || !h.item_id) continue;
    latest.set(`${h.campaign_contact_id}:${h.item_id}`, h);
  }
  const candidates = [];
  for (const [key, h] of latest) {
    if (byContact.get(h.campaign_contact_id)?.campaign_id !== mission.id) continue;
    const saved = current.has(key);
    if (h.confirmed !== saved) {
      const item = catalog.get(h.item_id);
      const sibling = item?.parent_id && [...latest.values()].find(other =>
        other.campaign_contact_id === h.campaign_contact_id && other.confirmed &&
        other.item_id !== h.item_id && catalog.get(other.item_id)?.parent_id === item.parent_id &&
        catalog.get(item.parent_id)?.question_selection_mode === "single" &&
        other.sequence > h.sequence);
      candidates.push({
        enrollmentId: h.campaign_contact_id, itemId: h.item_id,
        step: item?.step_id ?? null, liveDefinitionExists: Boolean(item),
        historicalLabel: h.item_label ?? null, latestConfirmation: h.confirmed, hasState: saved,
        recordedAt: h.created_at,
        classification: sibling ? "later-single-select-choice" : "requires-audit-review",
      });
    }
  }
  const definitionIssues = states.flatMap(s => {
    const item = catalog.get(s.status_list_item_id);
    const contact = byContact.get(s.campaign_contact_id);
    return !item || item.campaign_id !== contact?.campaign_id
      ? [{ enrollmentId: s.campaign_contact_id, itemId: s.status_list_item_id,
        reason: item ? "item-in-another-mission" : "missing-live-definition" }] : [];
  });
  const groups = new Map();
  for (const s of states) {
    const item = catalog.get(s.status_list_item_id), parent = catalog.get(item?.parent_id);
    if (parent?.question_selection_mode !== "single") continue;
    const key = `${s.campaign_contact_id}:${parent.id}`;
    const group = groups.get(key) ?? { enrollmentId: s.campaign_contact_id, parentId: parent.id, itemIds: [] };
    group.itemIds.push(s.status_list_item_id); groups.set(key, group);
  }
  const duplicates = new Map();
  for (const c of contacts.filter(c => c.campaign_id === mission.id)) {
    const set = duplicates.get(c.clinic_id) ?? []; set.push(c.id); duplicates.set(c.clinic_id, set);
  }
  const targetIds = new Set(contacts.filter(c => /allatura/i.test(c.name)).map(c => c.id));
  const actors = new Map();
  const actor = id => {
    if (!id) return null;
    if (!actors.has(id)) actors.set(id, `actor-${actors.size + 1}`);
    return actors.get(id);
  };
  const targetHistory = history.filter(h => targetIds.has(h.campaign_contact_id));
  return {
    version: "status-list-consistency-v1", capturedAt: new Date().toISOString(),
    readOnly: true, mission: { id: mission.id, name: mission.name },
    interpretation: "History is an event log, not the current state. Candidates are NOT authorization to restore answers. Review later sibling choices, workflow clears, definition changes and enrollment identity first.",
    counts: { enrollments: contacts.filter(c => c.campaign_id === mission.id).length,
      states: states.length, confirmationCandidates: candidates.length,
      unresolvedCandidates: candidates.filter(c => c.classification === "requires-audit-review").length,
      definitionIssues: definitionIssues.length },
    duplicateEnrollments: [...duplicates.values()].filter(ids => ids.length > 1),
    multipleSingleSelectStates: [...groups.values()].filter(g => g.itemIds.length > 1),
    definitionIssues, candidates,
    target: {
      matched: targetIds.size > 0,
      enrollments: contacts.filter(c => targetIds.has(c.id)).map(c => ({
        enrollmentId: c.id, missionId: c.campaign_id, status: c.status, createdAt: c.created_at,
        inRequestedMission: c.campaign_id === mission.id,
      })),
      states: states.filter(s => targetIds.has(s.campaign_contact_id)).map(s => ({
        enrollmentId: s.campaign_contact_id, itemId: s.status_list_item_id,
        step: catalog.get(s.status_list_item_id)?.step_id ?? null,
        confirmedAt: s.confirmed_at, actor: actor(s.confirmed_by_user_id),
      })),
      historyCount: targetHistory.length, historyTruncated: targetHistory.length > 500,
      history: targetHistory.slice(-500).map(h => ({
        enrollmentId: h.campaign_contact_id, action: h.action, recordedAt: h.created_at,
        actor: actor(h.user_id), itemId: h.item_id, confirmed: h.confirmed,
        step: catalog.get(h.item_id)?.step_id ?? null, historicalLabel: h.item_label ?? null,
        workflow: h.workflow?.map(result => ({
          type: result.type, success: result.success,
          target: result.target && { kind: result.target.kind, id: result.target.id },
          booleanValue: typeof result.value === "boolean" ? result.value : undefined,
          cleared: Array.isArray(result.cleared)
            ? result.cleared.map(c => ({ kind: c.kind, id: c.id })) : undefined,
        })),
      })),
    },
    catalog: items.map(i => ({
      id: i.id, missionId: i.campaign_id, parentId: i.parent_id, step: i.step_id,
      label: i.label, itemType: i.item_type, confirmationType: i.confirmation_type,
      selectionMode: i.question_selection_mode, hidden: i.is_hidden,
    })),
    snapshotFingerprint: digest(JSON.stringify({ contacts: contacts.map(c => c.id), items, states, history })),
  };
}
async function capture(client) {
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  try {
    await client.query("SET LOCAL statement_timeout = '25s'");
    await client.query("SET LOCAL lock_timeout = '2s'");
    const { rows: missions } = await client.query("SELECT id,name FROM campaigns WHERE id=$1 AND name=$2",
      [MISSION, "Medical Partner Cooperation"]);
    if (missions.length !== 1) throw Error("Expected Mission not found");
    const { rows: contacts } = await client.query(`SELECT cc.id,cc.campaign_id,cc.clinic_id,
      cc.status,cc.created_at,c.name FROM campaign_contacts cc JOIN clinics c ON c.id=cc.clinic_id
      WHERE cc.contact_type='clinic' AND (cc.campaign_id=$1 OR lower(c.name) LIKE $2)
      ORDER BY cc.id`, [MISSION, "%allatura%"]);
    const ids = contacts.map(c => c.id);
    const { rows: states } = await client.query(`SELECT campaign_contact_id,status_list_item_id,
      confirmed_at,confirmed_by_user_id FROM campaign_contact_status_list_state
      WHERE campaign_contact_id=ANY($1::varchar[]) ORDER BY campaign_contact_id,status_list_item_id`, [ids]);
    const { rows: history } = await client.query(`SELECT id,campaign_contact_id,user_id,action,
      created_at,metadata->>'statusListItemId' AS item_id,metadata->>'itemLabel' AS item_label,
      metadata->'confirmed' AS confirmed,
      CASE WHEN jsonb_typeof(metadata->'results')='array' THEN metadata->'results' ELSE NULL END AS workflow
      FROM campaign_contact_history WHERE campaign_contact_id=ANY($1::varchar[])
      AND action LIKE 'status_list_%'
      ORDER BY created_at,id`, [ids]);
    history.forEach((h, sequence) => { h.sequence = sequence; });
    const missionIds = [...new Set(contacts.map(c => c.campaign_id))];
    const { rows: items } = await client.query(`SELECT id,campaign_id,parent_id,step_id,label,
      item_type,confirmation_type,question_selection_mode,is_hidden
      FROM campaign_status_list_items WHERE campaign_id=ANY($1::varchar[])
      OR id=ANY($2::varchar[]) ORDER BY campaign_id,sort_order,id`,
    [missionIds, states.map(s => s.status_list_item_id)]);
    const report = reportSnapshot({ mission: missions[0], contacts, states, history, items });
    await client.query("ROLLBACK");
    return report;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  }
}
async function main(args) {
  if (args.length !== 1 || args[0] !== "--read-only") throw Error("Use --read-only");
  if (os.hostname().split(".")[0].toUpperCase() !== "CORPCRM01" || process.cwd() !== APP)
    throw Error("Run from /var/www/indexus-crm on CORPCRM01");
  const { createRequire } = require("node:module");
  const localRequire = createRequire(APP + "/package.json");
  const config = localRequire("dotenv").parse(fs.readFileSync(APP + "/.env"));
  if (!config.DATABASE_URL) throw Error("Application database configuration missing");
  const { Client } = localRequire("pg");
  const client = new Client({ connectionString: config.DATABASE_URL, connectionTimeoutMillis: 8000 });
  let report;
  try { await client.connect(); report = await capture(client); }
  finally { await client.end(); }
  const git = args => cp.execFileSync("git", ["-C", APP, ...args], { encoding: "utf8" }).trim();
  report.productionHead = git(["rev-parse", "HEAD"]);
  report.changedTrackedSources = git(["diff", "--name-only", "HEAD", "--", "client/src", "server", "shared"]);
  report.sourceHashes = {};
  for (const name of ["client/src/pages/agent-workspace.tsx", "server/routes.ts",
    "server/lib/status-list-workflow.ts", "dist/index.cjs", "dist/public/index.html"]) {
    const file = path.join(APP, name);
    report.sourceHashes[name] = fs.existsSync(file) ? digest(fs.readFileSync(file)) : null;
  }
  const filename = path.join(os.homedir(), `allatura-status-diagnostika-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(filename, JSON.stringify(report, null, 2), { flag: "wx", mode: 0o600 });
  console.log("READ_ONLY_OK");
  console.log("ALLATURA_ENROLLMENTS=" + report.target.enrollments.length);
  console.log("MISSION_REVIEW_CANDIDATES=" + report.counts.unresolvedCandidates);
  console.log("REPORT=" + filename);
}
if (require.main === module || !module.parent) main(process.argv.slice(2)).catch(error => {
  // Never print database connection strings or raw provider errors.
  console.error("STOP: Read-only capture failed (" + (error.code || "capture_error") + "). No repair was attempted.");
  process.exitCode = 1;
});
module.exports = { reportSnapshot, capture };
