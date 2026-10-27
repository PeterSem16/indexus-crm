import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

// Real production components; only host call state and API data are fixtures.
// No server authentication, production data, or telephony settings are changed.
const base = process.env.STATUS_LIST_TEST_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`;
const browser = await chromium.launch({
  executablePath: "/repl/tools/bin/chromium", headless: true, args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.route("**/api/**", route => route.fulfill({ json: [] }));
  await page.route("**/src/contexts/call-context.tsx*", route => route.fulfill({
    contentType: "application/javascript",
    body: `export const useCall=()=>({callState:"idle",callInfo:null,callDuration:0,callTiming:{}});`,
  }));
  await page.route("**/status-list-correction-test", route => route.fulfill({
    contentType: "text/html",
    body: `<html><head><link rel="stylesheet" href="/src/index.css"></head><body>
    <div id="test-root"></div><script type="module">
      const refresh=await import("/@react-refresh");
      refresh.injectIntoGlobalHook(window);
      window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;
      window.__vite_plugin_react_preamble_installed__=true;
      const source=await fetch("/src/pages/agent-workspace.tsx").then(r=>r.text());
      const entry=await fetch("/src/main.tsx").then(r=>r.text());
      const rm=await import(source.match(/from\\s*["']([^"']*\\/react\\.js[^"']*)["']/)[1]);
      const React=rm.default||rm;
      const dom=await import(entry.match(/from\\s*["']([^"']*react-dom_client[^"']*)["']/)[1]);
      const query=await import(source.match(/from\\s*["']([^"']*react-query[^"']*)["']/)[1]);
      const {I18nProvider}=await import("/src/i18n/I18nProvider.tsx");
      const {AuthProvider}=await import("/src/contexts/auth-context.tsx");
      const {TooltipProvider}=await import("/src/components/ui/tooltip.tsx");
      const {SlStatusButton,CustomerInfoPanel}=await import("/src/pages/agent-workspace.tsx");
      const noop=()=>{};window.ruleRuns=0;window.statusSelections=[];
      const history=[
        {id:"answer",type:"disposition",date:"2026-10-22T10:29:00Z",action:"status_list_answer",
          content:"status_list_answer",agentName:"Fixture Agent",campaignName:"Fixture Mission",
          metadata:{questionLabel:"Want to reschedule",previous:false,value:true}},
        {id:"action",type:"disposition",date:"2026-10-22T10:29:01Z",action:"status_list_action",
          content:"status_list_action",agentName:"Fixture Agent",campaignName:"Fixture Mission",
          metadata:{actionType:"set_contact_status",dispositionName:"No time",itemLabel:"First contact",
            callbackDate:"2026-10-28T08:00:00Z"}},
        {id:"deleted",type:"disposition",date:"2026-10-22T10:30:00Z",action:"status_list_action",
          content:"status_list_action",metadata:{automationId:"deleted-internal-id"}},
        {id:"regular",type:"disposition",date:"2026-10-22T10:31:00Z",action:"status_change",
          content:"Regular status change"}
      ];
      const node=React.createElement("div",null,
        React.createElement(SlStatusButton,{automation:{id:"fixture",statusListItemId:"step",questionId:"q"},
          isRunning:false,isCallback:true,locale:"en",onRun:()=>window.ruleRuns++,
          onOpenDisposition:source=>window.statusSelections.push(source)}),
        React.createElement(CustomerInfoPanel,{
          contact:{id:"fixture",firstName:"Fixture",lastName:"Contact",country:"SK",phone:"000000000"},
          campaign:{id:"mission",name:"Fixture Mission"},callNotes:"",onAddNote:noop,onDisposition:noop,
          onQuickAction:noop,rightTab:"history",onRightTabChange:noop,contactHistory:history,
          dispositions:[],currentUserId:"fixture",onOpenDispositionModal:noop,callState:"idle",
          callDuration:0,ringDuration:0,onEndCall:noop,onOpenDispositionFromCall:noop,
          isMuted:false,isOnHold:false,volume:1,micVolume:1,onToggleMute:noop,onToggleHold:noop,
          onSendDtmf:noop,onVolumeChange:noop,onMicVolumeChange:noop,callerNumber:"000000000"}));
      const client=new query.QueryClient({defaultOptions:{queries:{retry:false}}});
      (dom.createRoot||dom.default.createRoot)(document.getElementById("test-root")).render(
        React.createElement(query.QueryClientProvider,{client},React.createElement(AuthProvider,null,
          React.createElement(I18nProvider,{userCountries:["SK"]},React.createElement(TooltipProvider,null,node)))));
    </script></body></html>`,
  }));
  await page.goto(`${base}/status-list-correction-test`);
  await page.getByTestId("btn-sl-status-fixture").waitFor({ timeout: 60000 });
  await page.getByTestId("btn-sl-status-fixture").click();
  assert.equal(await page.evaluate(() => window.ruleRuns), 0);
  assert.deepEqual(await page.evaluate(() => window.statusSelections), [{ statusListItemId: "step", questionId: "q" }]);
  assert.equal(await page.locator('[role="dialog"]').count(), 0, "no callback calendar before status selection");
  for (const id of ["answer", "action", "deleted"]) {
    const card = page.getByTestId(`history-item-${id}`);
    await card.waitFor();
    assert.doesNotMatch(await card.innerText(), /status_list_|deleted-internal-id/);
    assert.equal(await page.getByTestId(`status-list-history-source-${id}`).innerText(), "Status list");
  }
  assert.match(await page.getByTestId("history-item-answer").innerText(), /Want to reschedule/);
  assert.match(await page.getByTestId("history-item-action").innerText(), /No time/);
  assert.equal(await page.getByTestId("status-list-history-source-regular").count(), 0);
  assert.equal(errors.length, 0, errors.join("\n"));
  console.log("PASS: manual status delegates to Mission chooser without running rule; real history cards show source and human text");
} finally {
  await browser.close();
}
