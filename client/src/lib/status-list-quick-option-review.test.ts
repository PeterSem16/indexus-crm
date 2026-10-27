import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";
import { prepareStatusListCallbackReview } from "./status-list-callback-review";

test("callback statuses and direct callback actions both get an editable draft", () => {
  for (const action of [
    { id: "callback", actionType: "set_callback", callbackOffsetDays: 2, callbackTime: "14:30" },
    { id: "status", actionType: "set_contact_status", dispositionId: "reschedule", callbackTime: "14:30" },
  ]) {
    const review = prepareStatusListCallbackReview({ automations: [action] }, [{ id: "reschedule", actionType: "callback" }]);
    assert.ok(review.callbackEditor);
    assert.ok(review.callbackDraft?.callbackDate.endsWith("T14:30"));
    review.callbackEditor.onChange({ callbackDate: "2027-06-21T12:30:00.000Z", callbackNote: "operator edit" });
    assert.equal(review.callbackDraft?.callbackDate, "2027-06-21T12:30:00.000Z");
    assert.equal(review.callbackDetails[action.id].callbackNote, "operator edit");
  }
  assert.equal(prepareStatusListCallbackReview({ automations: [{ actionType: "send_sms" }] }).callbackEditor, undefined);
});

const source = readFileSync(new URL("../pages/agent-workspace.tsx", import.meta.url), "utf8");
for (const accepted of [false, true]) {
  test(`real Quick Option callback ${accepted ? "commits the operator's edited date once" : "cancels without saving"}`, async () => {
    const writes: any[] = [];
    const busy = { current: false };
    const sender = { send: async (_url: string, body: any) => { writes.push(body); return { ok: true }; } };
    const option = { id: "quick", label: "Reschedule", automations: [{ id: "cb", actionType: "set_callback" }] };
    const bindings = {
      campaign: { id: "mission" }, campaignContactId: "contact", contact: { country: "SK" },
      slMutationBusyRef: busy, slExecutionRef: { current: { client: sender } },
      statusListMode: "immediate", setBatchSlSelections: () => assert.fail("not Batch"),
      setSlBusy: (value: boolean) => { busy.current = value; }, setSlRunningOption: () => {},
      prepareStatusListCallbackReview, slDispositions: [], locale: "sk",
      slActionRecap: { confirm: async (changes: any[], force: boolean, _manual: any[], _details: any, editor: any) => {
        assert.deepEqual(changes, [{ kind: "item", id: "quick", value: true }]);
        assert.equal(force, true);
        assert.equal(writes.length, 0);
        editor.onChange({ callbackDate: "2027-06-21T12:30:00.000Z", callbackNote: "operator edit" });
        return accepted;
      } },
      queryClient: { invalidateQueries: async () => {} }, toast: () => {},
      getStatusListExecutionCopy: () => ({ saved: "saved" }), actionCopy: () => "",
      onCloseCallAfterStatusList: () => assert.fail("a callback must not close the card"),
      slt: () => "failed",
    };
    const start = source.indexOf("const handleSlOptionSelect = useCallback");
    const end = source.indexOf("// Fast lookup:", start);
    assert.ok(start > 0 && end > start);
    const js = ts.transpileModule(source.slice(start, end), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
    }).outputText;
    const handler = new Function(...Object.keys(bindings), `const useCallback = fn => fn;\n${js}\nreturn handleSlOptionSelect;`)(...Object.values(bindings));
    await handler(option);
    assert.equal(busy.current, false);
    assert.deepEqual(writes, accepted ? [{
      confirm: true, overrideCallbackDate: "2027-06-21T12:30:00.000Z", overrideCallbackNote: "operator edit",
    }] : []);
  });
}
