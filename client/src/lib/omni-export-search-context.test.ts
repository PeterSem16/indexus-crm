import assert from "node:assert/strict";
import { test } from "node:test";
import copy from "../i18n/omni-group-translations";
import {
  appendOmniExportSearchContext, snapshotOmniExportSearchContext, proposeOmniExportSubject, type OmniExportSearchContext,
} from "./omni-export-search-context";

const context: OmniExportSearchContext = {
  query: 'from:sender@example.test subject:"invoice <2026>"',
  dateFrom: "2026-11-01", dateTo: "2026-11-05",
  scope: "group:care", groupName: "Customer support",
  accounts: ["support@example.test", "zero-matches@example.test"],
};

test("suggested subject covers all locales, empty templates and no group without replacing custom subjects", () => {
  for (const locale of ["en", "sk", "cs", "hu", "ro", "it", "de"] as const) {
    for (const value of [undefined, "", " \t "])
      assert.equal(proposeOmniExportSubject(value, copy[locale].defaultSearchSubject), copy[locale].defaultSearchSubject);
    assert.equal(proposeOmniExportSubject("Custom group subject", copy[locale].defaultSearchSubject), "Custom group subject");
  }
  assert.equal(copy.sk.defaultSearchSubject, "Výsledky vyhľadávania");
});

test("all seven locales describe the executed expression, dates, group and every searched account", () => {
  for (const locale of ["en", "sk", "cs", "hu", "ro", "it", "de"] as const) {
    const body = appendOmniExportSearchContext("Original template.", context, copy[locale], locale);
    assert.ok(body.startsWith("Original template.\n\n"));
    for (const value of [copy[locale].criteriaTitle, copy[locale].dateFrom, copy[locale].dateTo,
      copy[locale].criteriaAccounts, context.query, context.groupName!, ...context.accounts]) {
      assert.ok(body.includes(value), `${locale} missing ${value}`);
    }
    assert.ok(!body.includes(copy[locale].criteriaNoQuery));
    assert.ok(!body.includes(copy[locale].criteriaAnyDate));
  }
});

test("date-only and open-ended searches accurately describe absent restrictions", () => {
  for (const dates of [
    { dateFrom: "2026-11-05", dateTo: "" },
    { dateFrom: "", dateTo: "2026-11-05" },
    { dateFrom: "2026-11-05", dateTo: "2026-11-05" },
    { dateFrom: "", dateTo: "" },
  ]) {
    const value = { ...context, ...dates, query: "", groupName: undefined };
    const body = appendOmniExportSearchContext("", value, copy.en, "en");
    assert.ok(body.startsWith(copy.en.criteriaTitle));
    assert.ok(body.includes(copy.en.criteriaNoQuery));
    assert.equal(body.includes(`${copy.en.dateFrom}:`), !!dates.dateFrom);
    assert.equal(body.includes(`${copy.en.dateTo}:`), !!dates.dateTo);
    assert.equal(body.includes(copy.en.criteriaAnyDate), !dates.dateFrom && !dates.dateTo);
    assert.ok(!body.includes(`${copy.en.criteriaGroup}:`));
  }
});

test("snapshot clones actual searched accounts, including zero-match accounts, without later mutations", () => {
  const criteria = { ...context };
  const accounts = [...context.accounts, context.accounts[0]];
  const snapshot = snapshotOmniExportSearchContext(criteria, accounts);
  accounts.splice(0, accounts.length, "draft@example.test");
  criteria.query = "later draft";
  assert.deepEqual(snapshot.accounts, context.accounts);
  assert.equal(snapshot.query, context.query);
});

test("body initialization preserves editable templates and never silently truncates criteria", () => {
  assert.equal(appendOmniExportSearchContext("Existing.", undefined, copy.en, "en"), "Existing.");
  const body = appendOmniExportSearchContext("x".repeat(20000), context, copy.en, "en");
  assert.ok(body.length > 20000);
  assert.ok(body.includes(context.accounts[1]));
});

test("formatting date-only values is independent of the server time zone", () => {
  const original = process.env.TZ;
  try {
    process.env.TZ = "Pacific/Honolulu";
    const first = appendOmniExportSearchContext("", context, copy.sk, "sk");
    process.env.TZ = "Pacific/Kiritimati";
    assert.equal(appendOmniExportSearchContext("", context, copy.sk, "sk"), first);
    assert.match(first, /01\. 11\. 2026/);
    assert.match(first, /05\. 11\. 2026/);
  } finally {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  }
});
