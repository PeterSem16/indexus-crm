import assert from "node:assert/strict";
import { automaticAdmission, automaticCondition, automaticConfigSchema } from "./status-list-automatic";
import { statusListHistoryFields, type StatusListHistoryFacts } from "./status-list-history";

const facts=Object.fromEntries(statusListHistoryFields.map(field=>[field,false])) as StatusListHistoryFacts;
assert.equal(automaticCondition({},facts,"SK",undefined).value,true);
assert.equal(automaticCondition({conditionField:"country",conditionValue:"SK"},facts,"SK",undefined).value,true);
assert.equal(automaticCondition({conditionField:"unknown",conditionValue:"false"},facts,"SK",null).issue,"invalid_condition");
assert.equal(automaticCondition({conditionField:"answer",conditionValue:"yes"},facts,"SK",null).issue,"missing_answer");
assert.equal(automaticCondition({conditionField:"answer",conditionValue:"yes"},facts,"SK",true).value,true);
assert.equal(automaticCondition({conditionField:"history.reached",conditionValue:"false"},null,"SK",null).value,null);
assert.equal(automaticCondition({conditionField:"history.reached",conditionValue:"false"},facts,"SK",null).value,true);
assert.equal(automaticCondition({conditionField:"history.reached",conditionValue:"true",conditionOperator:"neq"},facts,"SK",null).value,true);
assert.equal(automaticCondition({conditionJson:{logic:"OR",rules:[
  {field:"country",op:"eq",value:"SK"},{field:"guessed",op:"eq",value:"yes"},
]}},facts,"SK",null).issue,"invalid_condition");
assert.equal(automaticCondition({conditionJson:"{"},facts,"SK",null).issue,"invalid_condition");
const input={trigger:"card_open" as const,enabled:true,supported:true,condition:true,batch:false};
assert.equal(automaticAdmission(input),"ready");
assert.equal(automaticAdmission({...input,enabled:false}),"disabled");
assert.equal(automaticAdmission({...input,supported:false}),"unsupported_action");
assert.equal(automaticAdmission({...input,condition:false}),"condition_false");
assert.equal(automaticAdmission({...input,batch:true}),"batch_deferred");
assert.equal(automaticAdmission({...input,priorStatus:"pending"}),"pending");
assert.equal(automaticAdmission({...input,priorStatus:"succeeded"}),"already_executed");
assert.equal(automaticAdmission({...input,priorStatus:"indeterminate"}),"indeterminate");
assert.equal(automaticAdmission({...input,trigger:"agent_confirmation"}),"disabled");
assert.equal(automaticAdmission({...input,trigger:"background_change"}),"background_baseline");
assert.equal(automaticAdmission({...input,trigger:"background_change",previous:true}),"waiting_transition");
assert.equal(automaticAdmission({...input,trigger:"background_change",previous:false}),"ready");
assert.equal(automaticAdmission({...input,trigger:"background_change",previous:false,batch:true}),"batch_deferred");
assert.equal(automaticConfigSchema.safeParse({trigger:"card_open",enabled:true,expectedRevision:null,acknowledged:true}).success,true);
assert.equal(automaticConfigSchema.safeParse({trigger:"card_open",enabled:true,expectedRevision:null}).success,false);
console.log("Status List automatic: strict conditions, truthful baseline, once-only admission and Batch gates passed.");
