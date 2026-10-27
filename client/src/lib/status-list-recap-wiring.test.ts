import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source=readFileSync(new URL("../pages/agent-workspace.tsx",import.meta.url),"utf8");
for(const [start,end,gate] of [
  ["const handleSlToggle =","const handleSlConfirmWithCallback =","slActionRecap.confirm"],
  ["const handleMobileSlToggle =","mobileSlQueue.current = task","mobileSlActionRecap.confirm"],
]) {
  test(`${gate}: real step handler reviews date and actions before executing without a second dialog`,()=>{
    const handler=source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
    assert.ok(handler.indexOf(gate)>0);
    assert.ok(handler.indexOf(gate)<handler.indexOf("sender.send("));
    if (gate === "mobileSlActionRecap.confirm") {
      assert.match(handler,/prepareStatusListCallbackReview/);
      assert.match(handler,/callbackReview\.callbackEditor/);
    } else assert.match(handler,/onChange:detail=>Object\.assign\(callbackDraft!,detail\)/);
    assert.match(handler,/overrideCallbackDate:callbackDraft\.callbackDate/);
    assert.doesNotMatch(handler,/setSlPendingCallback\(\{/,"the old second confirmation must not open");
  });
}
