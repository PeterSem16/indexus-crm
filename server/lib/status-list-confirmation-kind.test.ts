import assert from "node:assert/strict";
import test from "node:test";
import { isPersistedStatusListInfoHeading } from "./status-list-confirmation-kind";

const group = { id: "group", parentId: null, itemType: "step", confirmationType: "info" };
const answer = { id: "answer", parentId: group.id, itemType: "step", confirmationType: "info" };
test("persisted classification scopes hierarchy to the requested Mission without writes", async () => {
  const query = async (sql: string, params: unknown[]) => {
    assert.deepEqual(params, ["mission"]);
    assert.match(sql, /WHERE campaign_id=\$1/);
    assert.match(sql, /WHERE i\.campaign_id=\$1/);
    assert.doesNotMatch(sql, /\b(INSERT|UPDATE|DELETE)\b/i);
    return { rows: [group, answer] };
  };
  assert.equal(await isPersistedStatusListInfoHeading({ query } as any, "mission", answer), false);
  assert.equal(await isPersistedStatusListInfoHeading({ query } as any, "mission", group), true);
});
test("missing parent and real nested questions retain the heading restriction", async () => {
  assert.equal(await isPersistedStatusListInfoHeading({
    query: async () => ({ rows: [answer] }),
  } as any, "other-mission", answer), true);
  assert.equal(await isPersistedStatusListInfoHeading({
    query: async () => ({ rows: [group, answer, { id: "question", parentId: answer.id, itemType: "question" }] }),
  } as any, "mission", answer), true);
});
test("ordinary manual and automatic nodes do not require an extra hierarchy read", async () => {
  const query = async () => { throw Error("Unexpected query"); };
  for (const confirmationType of ["radio", "checkbox", "auto"])
    assert.equal(await isPersistedStatusListInfoHeading({ query } as any, "mission", {
      ...answer, confirmationType,
    }), false);
});
