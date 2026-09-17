import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getDirtyStatusListNoteIds,
  mergeStatusListNoteDrafts,
  statusListNotePayload,
} from "./status-list-note-drafts";

test("empty note is a dirty draft and serializes as null", () => {
  assert.deepEqual(
    getDirtyStatusListNoteIds({ parent: "" }, { parent: "old note" }),
    new Set(["parent"]),
  );
  assert.equal(statusListNotePayload(""), null);
  assert.equal(statusListNotePayload("  "), "  ");
});

test("hydration never overwrites a divergent local draft", () => {
  assert.deepEqual(
    mergeStatusListNoteDrafts({ parent: "local", child: "" }, { parent: "server", child: "" }),
    { parent: "server", child: "" },
  );
  assert.deepEqual(
    mergeStatusListNoteDrafts({ parent: "local" }, { parent: "server" }, ["parent"]),
    { parent: "local" },
  );
  assert.deepEqual(
    mergeStatusListNoteDrafts({ parent: "server" }, { parent: "server 2" }),
    { parent: "server 2" },
  );
});