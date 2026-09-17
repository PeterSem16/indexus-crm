import assert from "node:assert/strict";
import {
  parseStatusListNoteBody,
  persistStatusListNote,
  StatusListNoteError,
  type StatusListNoteState,
  type StatusListNoteStore,
  type StatusListNoteTransaction,
} from "./status-list-note";

type Fixture = {
  contact: { campaignId: string };
  item: { campaignId: string; label: string; description: string | null };
  state: StatusListNoteState | null;
  history: any[];
  failHistory: boolean;
  automationsRun: number;
};

function storeFor(fixture: Fixture): StatusListNoteStore {
  return {
    transaction: async <T>(work: (tx: StatusListNoteTransaction) => Promise<T>) => {
      const snapshot = {
        state: fixture.state && { ...fixture.state },
        history: [...fixture.history],
      };
      const tx: StatusListNoteTransaction = {
        getCampaignContact: async () => fixture.contact,
        getStatusListItem: async () => fixture.item,
        getState: async () => fixture.state && { ...fixture.state },
        updateState: async (_contactId, _itemId, note, noteUpdatedAt) => {
          if (!fixture.state) return null;
          fixture.state = { ...fixture.state, itemNote: note, noteUpdatedAt };
          return { ...fixture.state };
        },
        insertHistory: async (history) => {
          if (fixture.failHistory) throw new Error("history insert failed");
          fixture.history.push(history);
        },
      };
      try {
        return await work(tx);
      } catch (error) {
        fixture.state = snapshot.state;
        fixture.history = snapshot.history;
        throw error;
      }
    },
  };
}

function serialStoreFor(fixture: Fixture): StatusListNoteStore {
  const base = storeFor(fixture);
  let tail: Promise<unknown> = Promise.resolve();
  return {
    transaction: async <T>(work: (tx: StatusListNoteTransaction) => Promise<T>) => {
      const result = tail.then(() => base.transaction(work));
      tail = result.catch(() => undefined);
      return result;
    },
  };
}

const baseFixture = (): Fixture => ({
  contact: { campaignId: "campaign-1" },
  item: { campaignId: "campaign-1", label: "Reached", description: "Talked to contact" },
  state: {
    campaignContactId: "contact-1",
    statusListItemId: "item-1",
    itemNote: "old note",
  },
  history: [],
  failHistory: false,
  automationsRun: 0,
});

async function expectStatus(promise: Promise<unknown>, status: number) {
  await assert.rejects(promise, (error: unknown) =>
    error instanceof StatusListNoteError && error.status === status,
  );
}

assert.deepEqual(parseStatusListNoteBody({ note: "hello" }), { note: "hello" });
assert.deepEqual(parseStatusListNoteBody({ note: null }), { note: null });
assert.deepEqual(parseStatusListNoteBody({ note: "" }), { note: "" });
assert.throws(() => parseStatusListNoteBody({}), /explicitly provided/);
assert.throws(() => parseStatusListNoteBody({ note: { value: "bad" } }), /string or null/);

{
  const fixture = baseFixture();
  fixture.state!.itemNote = null;
  const result = await persistStatusListNote({
    store: storeFor(fixture),
    campaignId: "campaign-1",
    campaignContactId: "contact-1",
    statusListItemId: "item-1",
    userId: "agent-7",
    note: "first note",
  });
  assert.equal(result.changed, true);
  assert.equal(fixture.state?.itemNote, "first note");
  assert.equal(fixture.history.length, 1);
}

{
  const fixture = baseFixture();
  const result = await persistStatusListNote({
    store: storeFor(fixture),
    campaignId: "campaign-1",
    campaignContactId: "contact-1",
    statusListItemId: "item-1",
    userId: "agent-7",
    note: "new note",
    now: new Date("2026-01-02T03:04:05.000Z"),
  });
  assert.equal(result.changed, true);
  assert.equal(fixture.state?.itemNote, "new note");
  assert.equal(fixture.history.length, 1);
  assert.equal(fixture.history[0].userId, "agent-7");
  assert.deepEqual(fixture.history[0].metadata, {
    statusListItemId: "item-1",
    campaignId: "campaign-1",
    itemNote: "new note",
    itemLabel: "Reached",
    itemDescription: "Talked to contact",
  });
  assert.equal(fixture.automationsRun, 0);
}

{
  const fixture = baseFixture();
  fixture.state!.itemNote = "before clear";
  const result = await persistStatusListNote({
    store: storeFor(fixture),
    campaignId: "campaign-1",
    campaignContactId: "contact-1",
    statusListItemId: "item-1",
    userId: "agent-7",
    note: "",
  });
  assert.equal(result.changed, true);
  assert.equal(fixture.state?.itemNote, "");
  assert.equal(fixture.history[0].metadata.itemNote, "");
}

{
  const fixture = baseFixture();
  const result = await persistStatusListNote({
    store: storeFor(fixture),
    campaignId: "campaign-1",
    campaignContactId: "contact-1",
    statusListItemId: "item-1",
    userId: "agent-7",
    note: "old note",
  });
  assert.equal(result.changed, false);
  assert.equal(fixture.history.length, 0);
}

{
  const fixture = baseFixture();
  const store = serialStoreFor(fixture);
  const results = await Promise.all([
    persistStatusListNote({
      store,
      campaignId: "campaign-1",
      campaignContactId: "contact-1",
      statusListItemId: "item-1",
      userId: "agent-7",
      note: "same concurrent note",
    }),
    persistStatusListNote({
      store,
      campaignId: "campaign-1",
      campaignContactId: "contact-1",
      statusListItemId: "item-1",
      userId: "agent-7",
      note: "same concurrent note",
    }),
  ]);
  assert.deepEqual(results.map(result => result.changed).sort(), [false, true]);
  assert.equal(fixture.history.length, 1);
}

{
  const fixture = baseFixture();
  fixture.state = null;
  await expectStatus(persistStatusListNote({
    store: storeFor(fixture),
    campaignId: "campaign-1",
    campaignContactId: "contact-1",
    statusListItemId: "item-1",
    userId: "agent-7",
    note: "new",
  }), 404);
  assert.equal(fixture.history.length, 0);
}

{
  const fixture = baseFixture();
  fixture.contact.campaignId = "other-campaign";
  await expectStatus(persistStatusListNote({
    store: storeFor(fixture),
    campaignId: "campaign-1",
    campaignContactId: "contact-1",
    statusListItemId: "item-1",
    userId: "agent-7",
    note: "new",
  }), 404);
  fixture.contact.campaignId = "campaign-1";
  fixture.item.campaignId = "other-campaign";
  await expectStatus(persistStatusListNote({
    store: storeFor(fixture),
    campaignId: "campaign-1",
    campaignContactId: "contact-1",
    statusListItemId: "item-1",
    userId: "agent-7",
    note: "new",
  }), 404);
}

{
  const fixture = baseFixture();
  fixture.failHistory = true;
  await assert.rejects(persistStatusListNote({
    store: storeFor(fixture),
    campaignId: "campaign-1",
    campaignContactId: "contact-1",
    statusListItemId: "item-1",
    userId: "agent-7",
    note: "must roll back",
  }), /history insert failed/);
  assert.equal(fixture.state?.itemNote, "old note");
  assert.equal(fixture.history.length, 0);
}

console.log("status-list note persistence scenarios passed");