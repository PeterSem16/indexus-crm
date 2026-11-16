"use strict";
const { MAIN, check } = require("./iscbc-new-clients-2026-workbook.cjs");
const { inPeriod } = require("./iscbc-new-clients-2026-scope.cjs");
const contractColumn = MAIN.findIndex(([key]) => key === "contract");
const COLUMNS = [
  ...MAIN.slice(0, contractColumn),
  ["part", "Časť klienta"], ["parts", "Počet častí klienta"],
  ["contracts", "Počet zmlúv"], ["collections", "Počet samostatných odberov"],
  ["billing", "Ročné / viacročné nastavenie"],
  ["years", "Roky fakturačného obdobia"], ["frequency", "Periodicita splátok"],
  ["newClient", "Klient založený v roku 2026"], ["periodCollections", "Počet odberov v roku 2026"],
  ...MAIN.slice(contractColumn), ["inPeriod", "Skutočný odber v roku 2026"],
];
const distinct = values => [...new Set(values.filter(v => v != null && v !== "").map(String))];
function clientOverview(model) {
  const clients = new Map();
  for (const row of model.main) {
    if (!clients.has(row.client)) clients.set(row.client, { base: row, details: [], payments: [] });
    clients.get(row.client).details.push(row);
  }
  for (const row of model.payments) {
    check(clients.has(row.client), "PAYMENT_CLIENT_LINK_MISSING");
    clients.get(row.client).payments.push(row);
  }
  const records = [];
  for (const { base, details, payments } of clients.values()) {
    const summary = {
      contracts: distinct(details.map(r => r.contract)).length,
      collections: distinct(details.map(r => r.collection)).length,
      billing: distinct(payments.filter(r => r.type === "Služba – aktuálne nastavenie").map(r => r.billing)).join("; "),
      years: distinct(payments.map(r => r.years)).join("; "),
      frequency: distinct(payments.map(r => r.frequency)).join("; "),
      newClient: base.created ? inPeriod(base.created) ? "Áno" : "Nie" : "Neurčené",
      periodCollections: distinct(details.filter(r => inPeriod(r.actual)).map(r => r.collection)).length,
    };
    for (let i = 0; i < details.length; i++) {
      records.push({
        ...details[i], ...summary, part: i + 1, parts: details.length,
        inPeriod: details[i].actual ? inPeriod(details[i].actual) ? "Áno" : "Nie – mimo roku 2026" :
          "Bez skutočného dátumu odberu",
      });
    }
  }
  check(records.filter(r => r.part === 1).length === model.stats.clients, "CLIENT_SHEET_COVERAGE");
  check(records.length === model.main.length, "COLLECTION_MULTIPLICATION");
  return { columns: COLUMNS, records };
}
function clientNoteRows(model) {
  const clients = new Map(model.main.map(row => [row.client, row]));
  const records = [], links = new Set();
  for (const row of model.notes) {
    if (row.type !== "Poznámka") { records.push(row); continue; }
    for (const client of row.clientIds) {
      const identity = clients.get(client);
      check(identity, "NOTE_CLIENT_LINK_MISSING");
      records.push({ ...row, client, first: identity.first, last: identity.last });
      links.add(JSON.stringify([client, row.source, row.id, row.field]));
    }
  }
  model.stats.client_note_links = links.size;
  model.stats.client_note_parts = records.filter(row => row.type === "Poznámka").length;
  return records;
}
module.exports = { clientOverview, clientNoteRows, COLUMNS };
