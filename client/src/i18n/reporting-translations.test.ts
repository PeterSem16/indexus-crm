import { test } from "node:test";
import assert from "node:assert/strict";
import { reportingTranslations } from "./reporting-translations";
import { reportingPresets } from "../../../shared/reporting-period";

test("shared reporting navigation, validation and every preset are translated in all seven languages",()=>{
  const keys=Object.keys(reportingTranslations.en).sort();
  for(const locale of ["en","sk","cs","hu","ro","it","de"] as const){
    const copy=reportingTranslations[locale];
    assert.deepEqual(Object.keys(copy).sort(),keys,locale);
    for(const [key,value] of Object.entries(copy)) assert.ok(typeof value==="string" && value.trim(),`${locale}.${key}`);
    for(const key of reportingPresets) assert.ok(copy[key],`${locale}.${key}`);
  }
});
