import { test } from "node:test";
import assert from "node:assert/strict";
import { missionFunnelTranslations } from "./mission-funnel-translations";
import { funnelSources, funnelSteps, funnelExceptions } from "../../../shared/mission-funnel";

test("all seven locales contain complete funnel copy, source labels and evidence labels",()=>{
  const keys=Object.keys(missionFunnelTranslations.en).sort();
  for(const locale of ["en","sk","cs","hu","ro","it","de"] as const){
    const copy=missionFunnelTranslations[locale];
    assert.deepEqual(Object.keys(copy).sort(),keys,locale);
    for(const [key,value] of Object.entries(copy)){
      if(typeof value==="string") assert.ok(value.trim().length,`${locale}.${key}`);
    }
    for(const key of funnelSources) assert.ok(copy.sourceLabels[key],`${locale}.source.${key}`);
    for(const key of funnelSteps) assert.ok(copy.stepLabels[key],`${locale}.step.${key}`);
    for(const key of funnelExceptions) assert.ok(copy.exceptionLabels[key],`${locale}.exception.${key}`);
  }
});

test("English funnel stages use the full requested wording", () => {
  assert.deepEqual(missionFunnelTranslations.en.stepLabels, {
    assigned:"Assigned to coordinator",
    dialed:"Called",
    connected:"Reached",
    qualified:"Qualified",
    agreed:"Agreed to cooperate",
    wantsContract:"Wants a contract",
    withoutContract:"Does not want a contract",
    email:"Email with contract proposal sent",
    wantsToSign:"Wants to sign a contract",
    sent:"Contract sent",
    received:"Contract delivered to the doctor",
    returned:"Contract returned",
    validated:"Contract validated",
    cooperating:"Cooperating",
    materials:"Package of materials sent",
  });
  assert.deepEqual(missionFunnelTranslations.en.exceptionLabels, {
    unqualified:"Unqualified",
    refused:"Refused to collaborate",
    unreachable:"Unavailable",
    absent:"Long-term absence",
    wrongNumber:"Incorrect number",
    notWorking:"Non-functional number",
  });
  for (const locale of ["sk","cs","hu","ro","it","de"] as const) {
    assert.notEqual(missionFunnelTranslations[locale].stepLabels.sent, "Sent", `${locale}.sent`);
    assert.notEqual(missionFunnelTranslations[locale].stepLabels.email, "Email", `${locale}.email`);
    assert.notEqual(missionFunnelTranslations[locale].stepLabels.materials, "Materials", `${locale}.materials`);
    assert.notEqual(missionFunnelTranslations[locale].exceptionLabels.refused, "Refused", `${locale}.refused`);
    assert.notEqual(missionFunnelTranslations[locale].exceptionLabels.unreachable, "Unreachable", `${locale}.unreachable`);
  }
});
