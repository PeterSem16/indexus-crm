import { test } from "node:test";
import assert from "node:assert/strict";
import { missionFunnelTranslations } from "./mission-funnel-translations";
import { funnelSources, funnelSteps, funnelExceptions } from "../../../shared/mission-funnel";
import { emailPurposes } from "../../../shared/email-purpose";

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

test("all locales explain validated contract cooperation and name the three sent materials", () => {
  const terms={en:"validated contract",sk:"overenú zmluvu",cs:"ověřenou smlouvu",
    hu:"ellenőrzött szerződés",ro:"contract validat",it:"contratto convalidato",de:"geprüften Vertrag"};
  for (const locale of ["en","sk","cs","hu","ro","it","de"] as const) {
    const copy=missionFunnelTranslations[locale];
    assert.ok(copy.configurationHelp.includes(terms[locale]),`${locale}.contract rule`);
    for (const source of ["materials17","materials18","materials19"] as const) {
      assert.doesNotMatch(copy.sourceLabels[source],/\b(?:17|18|19)\b/,`${locale}.${source}`);
      if (locale!=="en") assert.notEqual(copy.sourceLabels[source],missionFunnelTranslations.en.sourceLabels[source]);
    }
  }
});

test("email purpose UI is translated in every locale and keeps email evidence separate from postal and Status List steps", () => {
  for (const locale of ["en","sk","cs","hu","ro","it","de"] as const) {
    const copy = missionFunnelTranslations[locale];
    for (const purpose of emailPurposes) assert.ok(copy.emailPurposeLabels[purpose].trim(), `${locale}.${purpose}`);
    assert.ok(copy.templateEmailPurposeLabel.trim(), `${locale}.template purpose label`);
    assert.ok(copy.templateEmailPurposeHelp.trim(), `${locale}.template snapshot note`);
    assert.ok(copy.funnelEmailPurposeLabel.trim(), `${locale}.funnel purpose label`);
    assert.ok(copy.funnelEmailPurposeHelp.trim(), `${locale}.funnel purpose help`);
    assert.ok(copy.emailPurposePostalBoundary.trim(), `${locale}.postal boundary`);
    assert.match(copy.emailPurposePostalBoundary, /Status List/);
  }
});
