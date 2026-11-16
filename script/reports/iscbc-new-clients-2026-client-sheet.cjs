"use strict";
const { MAIN, PAYMENT, NOTE, splitText, excelDate, check } =
  require("./iscbc-new-clients-2026-workbook.cjs");

const identity = new Set(["client", "first", "middle", "last", "created", "country", "company", "deleted"]);
const COLUMNS = [
  ["type", "Typ riadku"], ...MAIN.filter(([key]) => identity.has(key)),
  ["part", "Časť klienta"], ["parts", "Počet častí klienta"],
  ["contracts", "Počet zmlúv"], ["collections", "Počet samostatných odberov"],
  ["billing", "Ročné / viacročné nastavenie"],
  ["years", "Roky fakturačného obdobia"], ["frequency", "Periodicita splátok"],
  ["details", "Všetky zmluvy a odbery – dátumy, stavy a väzby"],
  ["paymentDetails", "Všetky platobné podmienky, histórie, plány a predpisy"],
  ["noteDetails", "Všetky dostupné neodstránené poznámky – zdroj, väzba, dátum a autor"],
];
function valueText(value, kind) {
  if (kind !== "date" || !value) return String(value);
  excelDate(value); // Validate first; never guess or shift a source timestamp.
  return String(value).replace(/^(\d{4})-(\d\d)-(\d\d)[ T]/, "$3.$2.$1 ");
}
function describe(record, columns) {
  return columns.filter(([key]) => record[key] != null && record[key] !== "")
    .map(([key, label, kind]) => `${label}: ${valueText(record[key], kind)}`).join("\n");
}
const distinct = values => [...new Set(values.filter(v => v != null && v !== "").map(String))];
const numbered = blocks => blocks.map((text, i) => `[${i + 1}]\n${text}`).join("\n\n");

function clientSheet(model) {
  const clients = new Map();
  for (const row of model.main) {
    if (!clients.has(row.client)) clients.set(row.client, { base: row, details: [], payments: [], notes: [] });
    clients.get(row.client).details.push(row);
  }
  for (const row of model.payments) {
    check(clients.has(row.client), "PAYMENT_CLIENT_LINK_MISSING");
    clients.get(row.client).payments.push(row);
  }
  // Reassemble source chunks before making client-level continuations so the
  // full original note remains contiguous and no metadata interrupts its text.
  const notes = new Map();
  for (const row of model.notes.filter(r => r.type === "Poznámka")) {
    const key = JSON.stringify([row.source, row.id, row.field]);
    if (!notes.has(key)) notes.set(key, []);
    notes.get(key).push(row);
  }
  let clientNoteLinks = 0;
  for (const parts of notes.values()) {
    parts.sort((a, b) => a.part - b.part);
    const first = parts[0];
    check(parts.length === first.parts && parts.every((r, i) => r.part === i + 1 &&
      r.parts === first.parts && JSON.stringify(r.clientIds) === JSON.stringify(first.clientIds)),
    "NOTE_PARTS_MISMATCH");
    const block = describe({ ...first, text: parts.map(r => r.text).join("") },
      NOTE.filter(([key]) => !["part", "parts", "expected", "exported", "excluded", "type"].includes(key)));
    for (const id of first.clientIds) {
      check(clients.has(id), "NOTE_CLIENT_LINK_MISSING");
      clients.get(id).notes.push(block);
      clientNoteLinks++;
    }
  }
  const records = [];
  for (const { base, details, payments, notes: clientNotes } of clients.values()) {
    const sections = {
      details: splitText(numbered(details.map(r => describe(r, MAIN.filter(([key]) => !identity.has(key)))))),
      paymentDetails: splitText(payments.length ?
        numbered(payments.map(r => describe(r, PAYMENT.filter(([key]) => key !== "client")))) :
        "Bez evidovaných služieb a platobných nastavení."),
      noteDetails: splitText(clientNotes.length ? numbered(clientNotes) :
        "Bez dostupných neodstránených poznámok."),
    };
    const count = Math.max(...Object.values(sections).map(parts => parts.length));
    const summary = {
      contracts: distinct(details.map(r => r.contract)).length,
      collections: distinct(details.map(r => r.collection)).length,
      billing: distinct(payments.filter(r => r.type === "Služba – aktuálne nastavenie").map(r => r.billing)).join("; "),
      years: distinct(payments.map(r => r.years)).join("; "),
      frequency: distinct(payments.map(r => r.frequency)).join("; "),
    };
    for (let i = 0; i < count; i++) {
      records.push({
        ...Object.fromEntries([...identity].map(key => [key, base[key]])),
        type: i ? "Pokračovanie klienta" : "Klient", part: i + 1, parts: count,
        ...(i ? {} : summary),
        ...Object.fromEntries(Object.entries(sections).map(([key, parts]) => [key, parts[i] ?? null])),
      });
    }
  }
  check(records.filter(r => r.type === "Klient").length === model.stats.clients, "CLIENT_SHEET_COVERAGE");
  model.stats.client_note_links = clientNoteLinks;
  model.stats.sheet_client_rows = records.length;
  for (const control of model.controls) records.push({
    type: "Kontrola zdroja", noteDetails: describe(control, NOTE),
  });
  model.stats.sheet_rows = records.length;
  return { columns: COLUMNS, records };
}
module.exports = { clientSheet, COLUMNS, describe };
