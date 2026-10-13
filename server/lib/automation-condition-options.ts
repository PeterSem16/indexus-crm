import { and, eq, ilike, sql, or } from "drizzle-orm";
import { db } from "../db";
import { collectionStatuses, inboundQueues } from "../../shared/schema";
import { conditionChoiceSource } from "../../shared/automation-condition-catalog";
import { fieldsForEvent } from "./automation-capabilities";
import { updateRecordOwner, searchUpdateRecords, scopePredicate, updateRecordTables, readUpdateRecord, publicUpdateRecord } from "./automation-update-record";

export function registerConditionOptionsRoute(app: any, requireDesigner: any) {
  app.get("/api/automation/condition-options", requireDesigner, async (req: any, res: any) => {
    try {
      const module = String(req.query.module || ""), field = String(req.query.field || "");
      const event = String(req.query.eventType || "");
      const catalogField = fieldsForEvent(module, event).find(item => item.value === field ||
        item.value === field.replace(/^oldValues\./, "newValues."));
      if (!catalogField) return res.status(400).json({ error: "Unsupported condition field" });
      const source = conditionChoiceSource(module, field);
      if (!source) return res.status(400).json({ error: "Field has no known choices" });
      const owner = await updateRecordOwner(req.session.user.id);
      const countries = typeof req.query.countryCodes === "string" ? req.query.countryCodes.split(",").filter(Boolean) : null;
      const q = String(req.query.q || "").trim().slice(0, 100);
      if (source.kind === "queue") {
        const rows = await db.select({ value: inboundQueues.id, label: inboundQueues.name }).from(inboundQueues)
          .where(and(scopePredicate("call", inboundQueues, owner, countries),
            q ? ilike(inboundQueues.name, `%${q.replace(/[\\%_]/g, "\\$&")}%`) : undefined))
          .orderBy(inboundQueues.name).limit(21);
        return res.json({ options: rows.slice(0, 20), truncated: rows.length > 20 });
      }
      if (source.kind === "record") {
        if (/^[a-f0-9-]{36}$/i.test(q)) {
          const options = [];
          for (const type of source.entityTypes) {
            try {
              const row = await readUpdateRecord(type, q, owner, countries);
              options.push({ value: row.id, label: publicUpdateRecord(type, row).record.label });
            } catch { /* Unavailable identities remain explicitly saved values, never broaden scope. */ }
          }
          return res.json({ options, truncated: false });
        }
        const lists = await Promise.all(source.entityTypes.map(type => searchUpdateRecords(type, q, owner, countries, true)));
        const rows = lists.flatMap(list => list.records);
        return res.json({ options: rows.slice(0, 20).map(row => ({ value: row.id,
          label: `${row.label}${row.country ? ` · ${row.country}` : ""}${row.secondary ? ` · ${row.secondary}` : ""}` })),
          truncated: rows.length > 20 || lists.some(list => list.truncated) });
      }
      if (source.kind === "collection_status") {
        const rows = await db.select({ value: collectionStatuses.id, label: collectionStatuses.name }).from(collectionStatuses)
          .where(q ? ilike(collectionStatuses.name, `%${q.replace(/[\\%_]/g, "\\$&")}%`) : undefined)
          .orderBy(collectionStatuses.sortOrder).limit(21);
        return res.json({ options: rows.slice(0, 20).map(row => ({ ...row, value: String(row.value) })), truncated: rows.length > 20 });
      }
      const table = updateRecordTables[source.entityType], column = table?.[source.key];
      if (!column) throw new Error("Unavailable");
      const value = sql<string>`${column}::text`;
      const rows = await db.selectDistinct({ value }).from(table).where(and(
        scopePredicate(source.entityType, table, owner, countries),
        sql`${column} IS NOT NULL AND ${value} <> ''`,
        q ? ilike(value, `%${q.replace(/[\\%_]/g, "\\$&")}%`) : undefined)).orderBy(value).limit(21);
      res.json({ options: rows.slice(0, 20).map(row => ({ value: row.value, label: row.value })), truncated: rows.length > 20 });
    } catch { res.status(400).json({ error: "Condition choices unavailable" }); }
  });
}
