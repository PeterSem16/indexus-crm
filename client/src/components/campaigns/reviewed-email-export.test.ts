import {test} from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import {computeMissionFunnel} from "../../../../server/lib/mission-funnel";
import {emptyFunnelConfig} from "../../../../shared/mission-funnel";
import {missionFunnelTranslations} from "../../i18n/mission-funnel-translations";
import {funnelExportTranslations} from "../../i18n/mission-funnel-export-translations";
import {buildFunnelExport,funnelExportXlsx} from "./mission-funnel-export";
test("persisted Excel keeps reviewed creation evidence separate from unknown sending time",async()=>{
  const config=emptyFunnelConfig();config.sources.email=["mail"];
  const report={...computeMissionFunnel({
    config,clinics:[{id:"clinic",name:"Example Clinic",representativeId:null,referred:false}],
    enrollments:[{id:"contact",clinicId:"clinic"}],items:[],states:[],events:[],
    calls:[{id:"call",clinicId:"clinic",contactId:"contact",direction:"outbound",status:"completed",
      at:"2026-09-01T08:00:00Z",answeredAt:"2026-09-01T08:00:01Z",duration:10}],
    emailEvidence:[{id:"review",contactId:"contact",at:null,recordedAt:"2026-09-23T10:05:03Z"}],
  }),missionName:"Example",canConfigure:false};
  const tables=buildFunnelExport(report,missionFunnelTranslations.sk,funnelExportTranslations.sk,
    {from:"",to:"",referral:"all"},{step:"email",locale:"sk"});
  const evidence=tables[2].rows[1];
  assert.equal(evidence[2],"");
  assert.equal(typeof evidence[3],"object");
  assert.match(String(evidence[4]),/čas odoslania neznámy/);
  const book=XLSX.read(await funnelExportXlsx(tables),{type:"array",cellNF:true});
  const sheet=book.Sheets[book.SheetNames[2]];
  assert.equal(sheet.C2?.v??"","");
  assert.equal(sheet.D2.t,"n");
  assert.ok(sheet.D2.z);
  assert.match(sheet.E2.v,/čas odoslania neznámy/);
});
