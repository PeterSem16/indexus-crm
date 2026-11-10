import { test } from "node:test";
import assert from "node:assert/strict";
import { digest, planContacts, membershipHash, type Candidate } from "./mission-contact-load-plan";
import { fileCandidates } from "./mission-contact-load-file";
const entity = {id:"old", name:"Clinic",country_code:"SK",phone:"123",email:"a@example.test"};
const dir = { clinic:[entity], hospital:[],customer:[],collaborator:[] };
const candidate: Candidate = {type:"clinic",id:"old",name:"Clinic",country:"SK",row:1};
test("canonical snapshots survive JSONB key ordering; membership excludes mutable agent work", () => {
  assert.equal(digest({a:1,b:{d:2,c:3}}),digest({b:{c:3,d:2},a:1}));
  assert.equal(membershipHash([{id:"x",contact_type:"clinic",clinic_id:"old",status:"pending"}]),
    membershipHash([{id:"x",contact_type:"clinic",clinic_id:"old",status:"completed"}]));
});
test("CRM adds only new identities without mutating previous enrollment or input", () => {
  const old = {id:"enrollment",contact_type:"clinic",clinic_id:"old",status:"completed",notes:"keep"};
  const before = JSON.stringify(old);
  assert.equal(planContacts([candidate],[old],dir,["SK"])[0].disposition,"existing");
  assert.equal(JSON.stringify(old),before);
  assert.equal(planContacts([candidate],[],dir,["CZ"])[0].disposition,"invalid");
});
test("file resolution requires country and unambiguous identity, never shared phone alone", () => {
  const row = {...candidate,id:undefined,data:{name:"Clinic",phone:"123"}};
  assert.equal(planContacts([row],[],dir,["SK"])[0].id,"old");
  assert.equal(planContacts([{...row,name:"Other clinic"}],[],dir,["SK"])[0].disposition,"invalid");
  assert.equal(planContacts([row],[],{...dir,clinic:[entity,{...entity,id:"duplicate"}]},["SK"])[0].disposition,"invalid");
  assert.equal(planContacts([row,row],[],dir,["SK"])[1].disposition,"existing");
  const fresh={...row,name:"New",data:{name:"New",phone:"444"}};
  assert.equal(planContacts([fresh,{...fresh,data:{name:"New",phone:"555"}}],[],dir,["SK"])[1].disposition,"invalid");
});
test("file parser preserves country, rejects bad rows and never maps due date into birth date", () => {
  const parse=(text:string,type="customer")=>fileCandidates({originalname:"load.csv",buffer:Buffer.from(text)},type,"SK");
  const rows=parse("first_name,last_name,phone,email,country\nAda,Test,123,ada@example.test,SK");
  assert.equal(rows[0].name,"Ada Test"); assert.equal(rows[0].country,"SK");
  assert.equal(parse("first_name,last_name,email\nAda,Test,invalid")[0].error,"invalid_email");
  const dated=parse("first_name,last_name,expected_delivery_date\nAda,Test,2027-01-01")[0];
  assert.equal(dated.error,"unsupported_date_field");
  assert.equal(dated.data?.date_of_birth,undefined);
  assert.throws(()=>parse("name\nClinic","unknown"),/invalid_input/);
});
