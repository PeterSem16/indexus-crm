import {test} from "node:test";
import assert from "node:assert/strict";
import {funnelEvidenceBasisLabel} from "./reviewed-email-evidence";
test("reviewed-record labels are translated in all seven languages without changing other evidence",()=>{
  const values=["en","sk","cs","hu","ro","it","de"].map(locale=>funnelEvidenceBasisLabel({timestampKind:"recorded"},"History",locale));
  assert.equal(new Set(values).size,7);
  assert.match(values[0],/sending time unknown/);
  assert.equal(funnelEvidenceBasisLabel({},"History","sk"),"History");
});
