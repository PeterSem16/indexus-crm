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
