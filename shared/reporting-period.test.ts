import { test } from "node:test";
import assert from "node:assert/strict";
import { reportingPreset, reportingBounds, reportingMonthOverlaps, parseReportingQuery, validReportingPeriod } from "./reporting-period";

test("calendar presets use Bratislava day and Monday weeks, including previous year",()=>{
  const now = new Date("2026-01-04T23:30:00Z"); // Monday locally.
  assert.deepEqual(reportingPreset("today",now),{from:"2026-01-05",to:"2026-01-05"});
  assert.deepEqual(reportingPreset("thisWeek",now),{from:"2026-01-05",to:"2026-01-11"});
  assert.deepEqual(reportingPreset("lastWeek",now),{from:"2025-12-29",to:"2026-01-04"});
  assert.deepEqual(reportingPreset("lastMonth",now),{from:"2025-12-01",to:"2025-12-31"});
  assert.deepEqual(reportingPreset("last7Days",now),{from:"2025-12-30",to:"2026-01-05"});
  assert.deepEqual(reportingPreset("last30Days",now),{from:"2025-12-07",to:"2026-01-05"});
});
test("all time and leap-month boundaries are explicit",()=>{
  assert.deepEqual(reportingPreset("allTime"),{from:"",to:""});
  assert.deepEqual(reportingPreset("lastMonth",new Date("2024-03-10T10:00:00Z")),{from:"2024-02-01",to:"2024-02-29"});
  assert.deepEqual(reportingPreset("thisMonth",new Date("2026-10-30T10:00:00Z")),{from:"2026-10-01",to:"2026-10-31"});
});
test("inclusive day bounds follow 23-hour and 25-hour DST days independently of process timezone",()=>{
  assert.deepEqual(reportingBounds({from:"2026-03-29",to:"2026-03-29"}),{
    valid:true,fromISO:"2026-03-28T23:00:00.000Z",toISO:"2026-03-29T21:59:59.999Z",
  });
  assert.deepEqual(reportingBounds({from:"2026-10-25",to:"2026-10-25"}),{
    valid:true,fromISO:"2026-10-24T22:00:00.000Z",toISO:"2026-10-25T22:59:59.999Z",
  });
});
test("empty bounds are not silently replaced by the current month",()=>{
  assert.equal(reportingBounds({from:"",to:""}).fromISO,"1970-01-01T00:00:00.000Z");
  assert.equal(reportingBounds({from:"2026-09-01",to:""}).toISO,"9999-12-31T23:59:59.999Z");
});
test("invalid calendar dates and reversed ranges cannot become valid requests",()=>{
  for(const from of ["2026-02-30","2026-13-01","not-a-date"]) assert.equal(validReportingPeriod({from,to:""}),false);
  assert.equal(reportingBounds({from:"2026-11-01",to:"2026-10-01"}).valid,false);
  assert.throws(()=>parseReportingQuery({from:["2026-01-01"]}));
  assert.throws(()=>parseReportingQuery({from:"2026-11-01",to:"2026-10-01"}));
});
test("Status List request and export accept identical date-only or explicit instant boundaries",()=>{
  const bound=reportingBounds({from:"2026-10-25",to:"2026-10-25"});
  assert.deepEqual(parseReportingQuery({from:"2026-10-25",to:"2026-10-25"}),{from:bound.fromISO,to:bound.toISO});
  assert.deepEqual(parseReportingQuery({from:bound.fromISO,to:bound.toISO}),{from:bound.fromISO,to:bound.toISO});
});
test("snapshot filters overlap calendar months without inventing daily precision",()=>{
  const period={from:"2026-10-20",to:"2026-11-02"};
  assert.equal(reportingMonthOverlaps(2026,10,period),true);
  assert.equal(reportingMonthOverlaps(2026,11,period),true);
  assert.equal(reportingMonthOverlaps(2026,9,period),false);
  assert.equal(reportingMonthOverlaps(2026,12,period),false);
});
