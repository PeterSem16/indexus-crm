"use strict";
const { hasNote, digest } = require("./iscbc-new-clients-2026-source.cjs");
const { inPeriod, reportDefinition } = require("./iscbc-new-clients-2026-scope.cjs");

function check(condition, code) {
  if (!condition) throw Object.assign(new Error(code), { code });
}
function index(rows, key) {
  const map = new Map();
  for (const row of rows) {
    check(row[key] != null && !map.has(String(row[key])), "DUPLICATE_OR_MISSING_ID");
    map.set(String(row[key]), row);
  }
  return map;
}
function grouped(rows, key) {
  const map = new Map();
  for (const row of rows) {
    const id = String(row[key]);
    if (!map.has(id)) map.set(id, []);
    map.get(id).push(row);
  }
  return map;
}
const list = values => [...new Set(values.filter(v => v != null && v !== "").map(String))].sort().join("; ");
const flag = value => value === true || value === 1;
function splitText(text, limit = 30000) {
  const value = String(text), result = [];
  for (let start = 0; start < value.length;) {
    let end = Math.min(start + limit, value.length);
    if (end < value.length && /[\ud800-\udbff]/.test(value[end - 1])) end--;
    check(end > start, "TEXT_SPLIT_LIMIT");
    result.push(value.slice(start, end));
    start = end;
  }
  if (!result.length) result.push("");
  check(result.join("") === value, "TEXT_SPLIT_LOSS");
  return result;
}
function excelDate(value) {
  if (value == null || value === "") return null;
  const match = String(value).match(/^(\d{4})-(\d\d)-(\d\d)[ T](\d\d):(\d\d):(\d\d)(?:\.(\d{1,3}))?$/);
  check(match, "INVALID_SOURCE_DATE");
  const [y, mo, d, h, mi, s] = match.slice(1, 7).map(Number);
  const ms = Number((match[7] || "").padEnd(3, "0"));
  const timestamp = Date.UTC(y, mo - 1, d, h, mi, s, ms);
  check(new Date(timestamp).toISOString().slice(0, 19) ===
    `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}`, "INVALID_SOURCE_DATE");
  // Preserve old/sentinel source values as text instead of unreadable negative
  // dates or Excel's fictitious 1900 leap-day conversion.
  if (timestamp < Date.UTC(1900, 2, 1)) return { t: "s", v: String(value) };
  return { t: "n", v: timestamp / 86400000 + 25569, z: "dd.mm.yyyy hh:mm:ss" };
}

// Verified native views StorageCampaingSelectionSK/RO use period > 1 as
// ma_viacrocne for storage services. Do NOT infer payment receipt or classify
// transport/collection services as annual just because their default is 1.
function billing(service, references) {
  const rows = references.filter(row => row.sii_invoicing_period != null);
  const periods = [...new Set(rows.map(row => Number(row.sii_invoicing_period)))];
  const raw = list(rows.map(row => row.sii_invoicing_period));
  const companies = list(rows.map(row => row.com_name || row.com_id));
  if (service.ser_is_storable == null) return { label: "Neurčené", years: null, raw, companies };
  if (!flag(service.ser_is_storable)) return { label: "Nevzťahuje sa na skladné", years: null, raw, companies };
  if (periods.length !== 1 || !Number.isInteger(periods[0]) || periods[0] < 1) {
    return { label: "Neurčené", years: null, raw, companies };
  }
  return {
    label: periods[0] === 1 ? "Ročná fakturácia" : "Viacročná fakturácia",
    years: periods[0], raw, companies,
  };
}
function paymentFrequency(name, installments) {
  const text = String(name || "").toLowerCase();
  if (Number(installments) === 1) return "Jedna predpísaná platba";
  if (/(monthly|mesač|mesa[cč]|lunare|lunari)/u.test(text)) return "Mesačné splátky";
  if (/(quarter|quartal)/u.test(text)) return "Štvrťročné splátky";
  return "Neurčená periodicita splátok";
}
function collectionStatus(row) {
  if (!row) return "Neurčený – bez záznamu odberu";
  if (row.csu_code === "REG_CSU_CANCELLED") return "Zrušený";
  if (row.csu_code === "REG_CSU_ORDERED") return "Objednaný";
  if (row.sco_collection_made) return "Realizovaný – evidovaný dátum odberu";
  return "Neurčený";
}

const MAIN = [
  ["client", "ID klienta"], ["first", "Meno"], ["middle", "Prostredné meno"],
  ["last", "Priezvisko"], ["created", "Založenie klienta", "date"], ["country", "Krajina klienta"],
  ["company", "Spoločnosť klienta"], ["deleted", "Klient označený ako odstránený"],
  ["contract", "ID zmluvy"], ["number", "Číslo zmluvy"], ["contractStatus", "Stav zmluvy – zdroj"],
  ["contractCreated", "Založenie zmluvy", "date"], ["contractCancelled", "Zrušenie zmluvy", "date"],
  ["collection", "ID odberu"], ["status", "Rozlíšenie odberu"], ["sourceStatus", "Stav odberu – zdroj"],
  ["actual", "Skutočný dátum odberu", "date"], ["planned", "Očakávaný odber podľa zmluvy", "date"],
  ["ordered", "Dátum objednania", "date"], ["collectionCreated", "Založenie záznamu odberu", "date"],
  ["services", "ID súvisiacich služieb"], ["serviceNames", "Súvisiace služby"], ["warning", "Upozornenie"],
];
const PAYMENT = [
  ["type", "Typ riadku"], ["client", "ID klienta"], ["contract", "ID zmluvy"], ["number", "Číslo zmluvy"],
  ["service", "ID služby v zmluve"], ["name", "Služba"], ["active", "Stav služby"],
  ["billing", "Ročné / viacročné nastavenie"], ["years", "Počet rokov fakturačného obdobia"],
  ["period", "Pôvodná hodnota periodicity"], ["company", "Fakturujúca spoločnosť – číselník"],
  ["history", "ID cenovej histórie"], ["current", "Aktuálna cenová história"],
  ["from", "História platná od", "date"], ["to", "História platná do", "date"],
  ["schedule", "ID splátkového plánu"], ["scheduleName", "Uložený názov plánu"],
  ["preliminary", "Predbežný plán"], ["generateAfter", "Generovať po", "date"],
  ["paymentType", "Platobný typ – aktuálny číselník"], ["count", "Počet splátok – číselník"],
  ["frequency", "Periodicita splátok"], ["installment", "ID definície splátky"],
  ["order", "Poradie splátky"], ["installmentName", "Uložený názov splátky"],
  ["amount", "Predpísaná suma – nie úhrada"], ["currency", "Mena predpísanej sumy"],
  ["dateField", "Základ dátumu splatnosti"],
  ["offset", "Dní od základného dátumu"], ["previous", "Dní od predchádzajúcej splátky"],
  ["scheduled", "ID predpisu"], ["due", "Predpísaná splatnosť – nie úhrada", "date"],
  ["invoice", "ID súvisiacej faktúry"], ["additional", "ID doplnkového nastavenia"],
  ["warning", "Význam a obmedzenia"],
];
const NOTE = [
  ["type", "Typ riadku"], ["client", "ID klienta"], ["first", "Meno"], ["last", "Priezvisko"],
  ["source", "Zdroj"], ["id", "ID zdrojového záznamu"],
  ["field", "Zdrojové pole"], ["links", "Pôvodné väzby zdroja"], ["at", "Dostupný dátum", "date"],
  ["dateMeaning", "Význam dátumu"], ["author", "Dostupný autor"], ["part", "Časť textu"],
  ["parts", "Počet častí"], ["text", "Plný text poznámky / výsledok kontroly"],
  ["expected", "Počet poznámok v zdroji"], ["exported", "Exportované poznámky pred rozdelením"],
  ["excluded", "Vylúčené odstránené poznámky"],
];

function buildModel(extraction) {
  const { data, notes } = extraction;
  const clients = index(data.clients, "cli_id"), contracts = index(data.contracts, "con_id");
  const services = index(data.services, "cse_id"), collections = index(data.collections, "sco_id");
  const histories = index(data.history, "hcs_id"), schedules = index(data.schedules, "csh_id");
  const installments = index(data.installments, "csy_id");
  index(data.invoicing, "sii_id"); index(data.scheduled, "spa_id"); index(data.additional, "csp_id");
  const contractGroups = grouped(data.contracts, "cli_id"), serviceGroups = grouped(data.services, "con_id");
  const invoicing = grouped(data.invoicing, "sin_id");
  const main = [], payments = [], noteRows = [], controls = [];
  const required = (map, id) => { check(map.has(String(id)), "MISSING_PARENT"); return map.get(String(id)); };
  function mainRow(c, con, rows = [], sco = null, warning = "") {
    main.push({
      client: c.cli_id,
      first: c.pda_first_name, middle: c.pda_middle_name, last: c.pda_last_name,
      created: c.cli_inserted, country: c.com_country_code || "Neurčená", company: c.com_name || "Neurčená",
      deleted: flag(c.cli_deleted) ? "Áno" : "Nie", contract: con?.con_id, number: con?.con_number,
      contractStatus: con ? `${con.csa_code || "Neurčený"} / ${con.csa_default_name || ""}` : "Bez zmluvy",
      contractCreated: con?.con_inserted, contractCancelled: con?.con_cancelled,
      collection: sco?.sco_id, status: collectionStatus(sco),
      sourceStatus: sco ? `${sco.csu_code || "Neurčený"} / ${sco.csu_default_name || ""}` : null,
      actual: sco?.sco_collection_made, planned: con?.con_expected_collection_date, ordered: null,
      collectionCreated: sco?.sco_inserted, services: list(rows.map(s => s.cse_id)),
      serviceNames: list(rows.map(s => s.sin_name)),
      warning: [warning, !c.pda_id ? "Chýbajú platné osobné údaje." : "",
        con?.con_cancelled && sco?.sco_collection_made ? "Zmluva je zrušená, dátum odberu zostáva zachovaný." : "",
      ].filter(Boolean).join(" "),
    });
  }
  for (const c of data.clients) {
    const cons = contractGroups.get(c.cli_id) || [];
    if (!cons.length) mainRow(c, null, [], null, "Klient nemá zmluvu.");
    for (const con of cons) {
      const all = serviceGroups.get(con.con_id) || [], groups = new Map(), noCollection = [];
      for (const s of all) {
        if (s.sco_id) {
          required(collections, s.sco_id);
          if (!groups.has(s.sco_id)) groups.set(s.sco_id, []);
          groups.get(s.sco_id).push(s);
        } else if (flag(s.ser_is_collectable)) noCollection.push(s);
      }
      for (const [sco, rows] of groups) mainRow(c, con, rows, collections.get(sco));
      for (const s of noCollection) mainRow(c, con, [s], null,
        "Odberová služba bez záznamu odberu; objednanie ani zrušenie odberu nemožno potvrdiť.");
      if (!groups.size && !noCollection.length) mainRow(c, con, all, null,
        "Zmluva nemá naviazaný odber ani odberovú službu.");
    }
  }
  function paymentBase(s) {
    const con = required(contracts, s.con_id), b = billing(s, invoicing.get(s.sin_id) || []);
    return {
      client: con.cli_id, contract: con.con_id, number: con.con_number, service: s.cse_id,
      name: s.sin_name || "Neurčená", active: s.cse_active == null ? "Neurčený" :
        flag(s.cse_active) ? "Aktívna" : "Neaktívna",
      billing: b.label, years: b.years, period: b.raw, company: b.companies,
      currency: con.cur_code || "Neurčená",
      warning: "Periodicita je aktuálne číselníkové nastavenie služby, nie historická snímka ani dôkaz úhrady.",
    };
  }
  function historyBase(h) {
    return { ...paymentBase(required(services, h.cse_id)), history: h.hcs_id,
      current: h.hcs_actual == null ? "Neurčené" : flag(h.hcs_actual) ? "Áno" : "Nie",
      from: h.hcs_from, to: h.hcs_to };
  }
  function scheduleBase(s) {
    return { ...historyBase(required(histories, s.hcs_id)),
      schedule: s.csh_id, scheduleName: s.csh_name,
      preliminary: s.csh_preliminary_schedule == null ? "Neurčené" : flag(s.csh_preliminary_schedule) ? "Áno" : "Nie",
      generateAfter: s.csh_generate_after, paymentType: s.pty_name,
      count: s.pty_installments_count, frequency: paymentFrequency(s.pty_name, s.pty_installments_count) };
  }
  function installmentBase(s) {
    return { ...scheduleBase(required(schedules, s.csh_id)),
      installment: s.csy_id, order: s.csy_installments_id, installmentName: s.csy_name,
      amount: s.amount, dateField: s.csy_paymentdate_field,
      offset: s.csy_days_from_field_value, previous: s.csy_days_from_previous };
  }
  for (const s of data.services) payments.push({ type: "Služba – aktuálne nastavenie", ...paymentBase(s) });
  for (const h of data.history) payments.push({ type: "Cenová história", ...historyBase(h) });
  for (const s of data.schedules) payments.push({ type: "Uložený splátkový plán", ...scheduleBase(s) });
  for (const s of data.installments) payments.push({ type: "Definícia splátky", ...installmentBase(s) });
  for (const s of data.scheduled) payments.push({
    type: "Predpis – nie úhrada", ...installmentBase(required(installments, s.csy_id)),
    scheduled: s.spa_id, invoice: s.inv_id, due: s.spa_date_of_payment,
    amount: s.amount, currency: s.currency || "Neurčená",
    order: s.spa_installments_id, installmentName: s.spa_name,
  });
  for (const s of data.additional) payments.push({
    type: "Doplnkové platobné nastavenie", ...paymentBase(required(services, s.cse_id)),
    additional: s.csp_id, paymentType: s.pty_name, count: s.pty_installments_count,
    frequency: paymentFrequency(s.pty_name, s.pty_installments_count),
  });
  let noteCount = 0, excludedNotes = 0;
  for (const { spec, rows, counts } of notes) {
    // Ordinal suffix preserves even physically duplicated composite-key rows.
    const occurrences = new Map();
    const ordered = [...rows].sort((a, b) => digest([a]).localeCompare(digest([b])));
    for (const row of ordered) {
      const clientIds = [...new Set(String(row._clients || "").split(",").filter(Boolean))];
      check(clientIds.length > 0 && clientIds.every(id => clients.has(id)), "NOTE_CLIENT_LINK_MISSING");
      const key = spec.keys.map(k => `${k}=${row[k] ?? "NULL"}`).join("; ");
      const occurrence = (occurrences.get(key) || 0) + 1;
      occurrences.set(key, occurrence);
      for (const field of spec.fields) {
        if (!hasNote(row[field])) continue;
        noteCount++;
        const parts = splitText(row[field]);
        const dateField = row._dateField || spec.at;
        const dateMeaning = !dateField ? "Dátum nie je dostupný" :
          dateField.endsWith("_updated") ? "Posledná zmena zdrojového záznamu, nie vznik poznámky" :
          spec.at === "pre_date_of_payment" ? "Dátum platby v zdroji, nie dátum poznámky" :
          dateField.endsWith("_changed") ? "Čas udalosti" :
          spec.at === "rem_date" || spec.at === "rar_date" ? "Dátum poznámky" : "Dátum zdrojového záznamu";
        parts.forEach((text, n) => noteRows.push({
          type: "Poznámka", clientIds, source: spec.table, id: `${key}; výskyt=${occurrence}`, field,
          links: spec.links.map(k => `${k}=${row[k] ?? "NULL"}`).join("; "),
          at: row._at, dateMeaning, author: row._author,
          part: n + 1, parts: parts.length, text,
        }));
      }
    }
    spec.fields.forEach((field, i) => {
      const exported = rows.filter(r => hasNote(r[field])).length, expected = Number(counts[`n${i}`]);
      check(exported === expected, "NOTE_COUNT_MISMATCH");
      const excluded = Number(counts[`d${i}`]); excludedNotes += excluded;
      controls.push({ type: "Kontrola zdroja", source: spec.table, field, expected, exported, excluded,
        text: "Počet súhlasí; celý text bol zachovaný v očíslovaných častiach." });
    });
  }
  const clientSet = new Set(main.map(r => r.client));
  const collectionSet = new Set(main.map(r => r.collection).filter(Boolean));
  const collectionClients = new Set(main.filter(r => r.collection).map(r => r.client));
  const periodClients = new Set(main.filter(r => inPeriod(r.actual)).map(r => r.client));
  check(clientSet.size === clients.size, "CLIENT_COVERAGE_MISMATCH");
  check(collectionSet.size === collections.size, "COLLECTION_COVERAGE_MISMATCH");
  const pairs = main.filter(r => r.collection).map(r => `${r.client}/${r.contract}/${r.collection}`);
  check(new Set(pairs).size === pairs.length, "COLLECTION_MULTIPLICATION");
  for (const con of data.contracts) required(clients, con.cli_id);
  const stats = {
    clients: clients.size, marked_deleted: data.clients.filter(c => flag(c.cli_deleted)).length,
    no_contract: data.clients.filter(c => !contractGroups.has(c.cli_id)).length,
    no_collection: data.clients.filter(c => !collectionClients.has(c.cli_id)).length,
    contracts: contracts.size, services: services.size, collections: collections.size,
    main_rows: main.length, payment_rows: payments.length, notes: noteCount,
    note_parts: noteRows.length, excluded_deleted_notes: excludedNotes,
    annual_services: data.services.filter(s => billing(s, invoicing.get(s.sin_id) || []).years === 1).length,
    multi_year_services: data.services.filter(s => (billing(s, invoicing.get(s.sin_id) || []).years || 0) > 1).length,
    unknown_storage_period: data.services.filter(s => flag(s.ser_is_storable) &&
      billing(s, invoicing.get(s.sin_id) || []).years == null).length,
    missing_identity: data.clients.filter(c => !c.pda_id).length,
    new_clients: data.clients.filter(c => inPeriod(c.cli_inserted)).length,
    older_clients: data.clients.filter(c => c.cli_inserted && c.cli_inserted < "2026-01-01").length,
    other_creation_clients: data.clients.filter(c => !c.cli_inserted || c.cli_inserted >= "2027-01-01").length,
    period_clients: periodClients.size,
    period_collections: data.collections.filter(c => inPeriod(c.sco_collection_made)).length,
    outside_period_collections: data.collections.filter(c => c.sco_collection_made && !inPeriod(c.sco_collection_made)).length,
    undated_collections: data.collections.filter(c => !c.sco_collection_made).length,
  };
  return { main, payments, notes: [...noteRows, ...controls], stats, controls };
}

function textCell(value) {
  if (value == null) return null;
  if (typeof value === "number") { check(Number.isFinite(value), "INVALID_NUMBER"); return { t: "n", v: value }; }
  check(String(value).length <= 32767, "CELL_TEXT_TOO_LONG");
  return { t: "s", v: String(value) }; // Never formula/autolink inference.
}
function makeWorkbook(XLSX, model, metadata) {
  const wb = XLSX.utils.book_new();
  const { clientOverview, clientNoteRows } = require("./iscbc-new-clients-2026-client-sheet.cjs");
  const { columns: clientColumns, records: clientRecords } = clientOverview(model);
  const noteRecords = clientNoteRows(model);
  const report = reportDefinition(metadata.report);
  const shared = [
    [report.title, "Tri listy: hlavný prehľad, platobné podmienky, poznámky. Všetky spoločnosti a krajiny CBC; bez iniciál."],
    ["Extrakcia – UTC", metadata.utc],
    ["Extrakcia – Europe/Bratislava", metadata.bratislava],
    ["Rozsah", report.selection + " Údaje dostupné v čase extrakcie; rok ešte nie je uzavretý, ak extrakcia predchádza 01.01.2027."],
    ["Úplnosť kohorty", `Klienti=${model.stats.clients}; noví v roku 2026=${model.stats.new_clients}; starší=${model.stats.older_clients}; iné/chýbajúce založenie=${model.stats.other_creation_clients}; odbery v roku 2026=${model.stats.period_collections}; bez zmluvy=${model.stats.no_contract}; bez odberu=${model.stats.no_collection}; označení odstránení=${model.stats.marked_deleted}.`],
    ["Kontrola čítania", "Dve úplné čítania a nezávislé zdrojové počty súhlasili. Bez databázového snapshotu; údaje boli čítané postupne."],
    ["Dátumy a prehľad", "Zachované sú všetky väzby vybraného klienta vrátane histórie. Odbery mimo roku 2026 sú osobitne označené. Časť klienta = poradový detailný riadok klienta. Klientske súhrnné počty sa opakujú; nesčítavať ich cez detailné riadky. Dátumy zachovávajú zdrojový čas bez časového pásma; založenie záznamu nie je objednanie."],
    ["Platby", "Fakturačné obdobie nie je periodicita splátok ani potvrdenie úhrady. Historické plány sú oddelené; periodicita služby je aktuálny číselník."],
    ["Poznámky", `Zdrojové poznámky=${model.stats.notes}; väzby na klientov=${model.stats.client_note_links}; vylúčené odstránené=${model.stats.excluded_deleted_notes}. Zdieľaná poznámka je pri každom preukázane prepojenom klientovi. Kontroly sú na konci listu Poznámky.`],
    ["Obmedzenia", metadata.limitations],
    ["Krajiny a spoločnosti", metadata.countries],
    ["Kontrolné počty", JSON.stringify(model.stats)],
  ];
  const definitions = [["Klienti a odbery", clientColumns, clientRecords],
    ["Platobné podmienky", PAYMENT, model.payments], ["Poznámky", NOTE, noteRecords]];
  const expected = [];
  for (const [title, columns, records] of definitions) {
    const top = shared.map(row => row.map(textCell));
    top.push([], columns.map(([, name]) => textCell(name)));
    const header = top.length - 1;
    for (const record of records) top.push(columns.map(([key, , kind]) =>
      kind === "date" ? excelDate(record[key]) : textCell(record[key])));
    check(top.length <= 1048576, "EXCEL_ROW_LIMIT");
    const ws = XLSX.utils.aoa_to_sheet(top);
    ws["!cols"] = columns.map(([key, name]) => ({ wch: ["text", "details", "paymentDetails", "noteDetails"].includes(key) ? 90 :
      ["warning", "links", "serviceNames", "dateMeaning"].includes(key) ? 55 : Math.min(36, Math.max(16, name.length + 2)) }));
    ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: header, c: 0 },
      e: { r: top.length - 1, c: columns.length - 1 } }) };
    ws["!rows"] = top.slice(0, header + 1).map((_, i) => ({ hpt: i === header ? 48 : 20 }));
    XLSX.utils.book_append_sheet(wb, ws, title);
    expected.push({ title, cells: top, header, columns: columns.length });
  }
  return { wb, expected };
}
function verifyWorkbook(XLSX, buffer, expected) {
  const read = XLSX.read(buffer, { type: "buffer", cellDates: false, cellFormula: true });
  check(read.SheetNames.join("|") === expected.map(s => s.title).join("|"), "WORKBOOK_SHEETS_MISMATCH");
  for (const sheet of expected) {
    const ws = read.Sheets[sheet.title];
    check(ws["!autofilter"], "WORKBOOK_FILTER_MISSING");
    for (let r = 0; r < sheet.cells.length; r++) {
      for (let c = 0; c < sheet.cells[r].length; c++) {
        const want = sheet.cells[r][c], got = ws[XLSX.utils.encode_cell({ r, c })];
        if (!want) { check(!got || got.v == null, "WORKBOOK_CELL_MISMATCH"); continue; }
        check(got && !got.f && got.t === want.t, "WORKBOOK_TYPE_MISMATCH");
        check(want.t === "n" ? Math.abs(got.v - want.v) < 1e-9 : got.v === want.v, "WORKBOOK_VALUE_MISMATCH");
      }
    }
  }
}
module.exports = {
  buildModel, makeWorkbook, verifyWorkbook, billing, paymentFrequency, collectionStatus,
  splitText, excelDate, check, index, MAIN, PAYMENT, NOTE,
};
