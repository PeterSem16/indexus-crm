import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";
import { createSingleSelectTransition, executeSingleSelectTransition } from "./status-list-single-select-transition";
import { prepareStatusListCallbackReview } from "./status-list-callback-review";

test("a replacement clears each sibling once and then selects the new answer once", async () => {
  const transition = createSingleSelectTransition("new-choice", ["old-choice", "old-choice", "new-choice"]);
  assert.deepEqual(transition, [
    { id: "old-choice", confirm: false },
    { id: "new-choice", confirm: true },
  ]);

  const requests: string[] = [];
  await executeSingleSelectTransition(transition, async step => {
    requests.push(`${step.id}:${step.confirm}`);
    return requests.length;
  });
  assert.deepEqual(requests, ["old-choice:false", "new-choice:true"]);
});

test("a failed sibling write stops before executing the new answer's action", async () => {
  const requests: string[] = [];
  await assert.rejects(executeSingleSelectTransition(
    createSingleSelectTransition("new", ["old"]),
    async step => {
      requests.push(step.id);
      throw new Error("write_failed");
    },
  ), /write_failed/);
  assert.deepEqual(requests, ["old"]);
});

// Exercise the real callbacks without mounting the whole signed-in workspace
// or touching any contact/database. This also catches the busy-guard regression.
const source = readFileSync(new URL("../pages/agent-workspace.tsx", import.meta.url), "utf8");
function realHandler(name: string, endMarker: string, bindings: Record<string, any>) {
  const start = source.indexOf(`const ${name} = useCallback`);
  assert.ok(start > 0);
  const end = source.indexOf(endMarker, start);
  assert.ok(end > start);
  const js = ts.transpileModule(source.slice(start, end), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  return new Function(...Object.keys(bindings), `const useCallback = fn => fn;\n${js}\nreturn ${name};`)(...Object.values(bindings));
}

for (const mobile of [false, true]) {
  for (const accepted of [false, true]) {
    test(`${mobile ? "mobile" : "desktop"}: one click ${accepted ? "replaces the answer and runs its action once" : "keeps the old answer when review is cancelled"}`, async () => {
      let checked = new Set(["old"]);
      const busy = { current: false };
      const writes: Array<{ id: string; body: any }> = [];
      const child = { id: "new", automations: [{ id: "callback", actionType: "set_callback" }] };
      const sender = { send: async (url: string, body: any) => {
        writes.push({ id: url.split("/").at(-1)!, body });
        return { ok: true };
      } };
      const recap = { complete: () => {}, confirm: async (changes: any[], _force: boolean, _manual: any, _details: any, editor: any) => {
        assert.deepEqual(changes.map(change => [change.id, change.value]), [["old", false], ["new", true]]);
        assert.equal(writes.length, 0, "do not clear the old answer before review");
        assert.deepEqual([...checked], ["old"]);
        assert.equal(busy.current, true, "hold one lock for the complete replacement");
        editor?.onChange({ callbackDate: "2027-06-21T12:30:00.000Z", callbackNote: "reviewed" });
        return accepted;
      } };
      const setChecked = (update: (previous: Set<string>) => Set<string>) => { checked = update(checked); };
      const shared = {
        createSingleSelectTransition, executeSingleSelectTransition, prepareStatusListCallbackReview,
        queryClient: { invalidateQueries: async () => {} },
        toast: () => assert.fail("unexpected failure notification"),
        locale: "sk", slPrefillDt: () => "2027-06-18T12:30:00.000Z",
        getStatusListExecutionCopy: () => ({ failed: "failed", failedDetail: "failed" }),
        slt: () => "failed",
      };
      const handler = mobile
        ? realHandler("handleMobileSlToggle", "\n\n  useEffect(", {
          ...shared, selectedCampaignId: "mission", effectiveCampaignContactId: "contact",
          mobileSlBusy: busy, mobileDbStatusList: [{ id: "old" }, child],
          mobileSlExecution: { current: { client: sender } }, mobileStatusListMode: "immediate",
          mobileSlActionRecap: recap, mobileSlScope: "mission:contact",
          mobileDbSlState: [], setMobileDbSlChecked: setChecked,
          campaignDispositions: [],
          setMobileBatchSlSelections: () => {}, mobileSlQueue: { current: Promise.resolve() },
        })
        : realHandler("handleSlSingleChildTransition", "\n  const handleSlConfirmWithCallback", {
          ...shared, campaign: { id: "mission" }, campaignContactId: "contact", contactCountry: "SK",
          slMutationBusyRef: busy, slExecutionRef: { current: { client: sender } },
          statusListScopeToken: "mission:contact:0",
          statusListScopeRef: { current: { key: "mission:contact", generation: 0 } },
          dbSlChecked: checked, dbStatusList: [{ id: "old" }, child],
          handleSlToggle: () => assert.fail("replacement must not call two guarded toggles"),
          slActionRecap: recap, setSlBusy: (value: boolean) => { busy.current = value; },
          setDbSlChecked: setChecked, slDispositions: [], hasStatusListCallbackAction: () => true,
        });
      await (mobile ? handler("new", true, ["old"]) : handler(child, ["old"]));
      assert.equal(busy.current, false);
      assert.deepEqual([...checked], accepted ? ["new"] : ["old"]);
      assert.deepEqual(writes.map(write => [write.id, write.body.confirm]),
        accepted ? [["old", false], ["new", true]] : []);
      if (accepted) {
        assert.equal(writes[1].body.overrideCallbackDate, "2027-06-21T12:30:00.000Z");
        assert.equal(writes[1].body.overrideCallbackNote, "reviewed");
        if (mobile) {
          await handler("new", false);
          assert.deepEqual(writes.at(-1), { id: "new", body: { confirm: false } });
          assert.deepEqual([...checked], []);
        }
      }
    });
  }
}
