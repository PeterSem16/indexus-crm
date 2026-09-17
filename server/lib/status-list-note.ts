import {
  and,
  eq,
} from "drizzle-orm";
import {
  campaignContactHistory,
  campaignContacts,
  campaignContactStatusListState,
  campaignStatusListItems,
} from "@shared/schema";

export type StatusListNote = string | null;

export type StatusListNoteContact = { campaignId: string };
export type StatusListNoteItem = {
  campaignId: string;
  label: string;
  description: string | null;
};
export type StatusListNoteState = {
  campaignContactId: string;
  statusListItemId: string;
  itemNote: string | null;
  noteUpdatedAt?: Date | null;
  [key: string]: unknown;
};

export type StatusListNoteHistory = {
  campaignContactId: string;
  userId: string;
  action: "status_list_note_update";
  metadata: Record<string, unknown>;
};

export interface StatusListNoteTransaction {
  getCampaignContact(campaignContactId: string): Promise<StatusListNoteContact | null>;
  getStatusListItem(statusListItemId: string): Promise<StatusListNoteItem | null>;
  getState(campaignContactId: string, statusListItemId: string): Promise<StatusListNoteState | null>;
  updateState(
    campaignContactId: string,
    statusListItemId: string,
    note: StatusListNote,
    noteUpdatedAt: Date,
  ): Promise<StatusListNoteState | null>;
  insertHistory(history: StatusListNoteHistory): Promise<void>;
}

export interface StatusListNoteStore {
  transaction<T>(work: (tx: StatusListNoteTransaction) => Promise<T>): Promise<T>;
}

export class StatusListNoteError extends Error {
  constructor(
    public readonly status: 400 | 404 | 409,
    message: string,
  ) {
    super(message);
    this.name = "StatusListNoteError";
  }
}

/**
 * PATCH intentionally requires the key to be present.  In particular, an
 * omitted key must not be interpreted as a request to clear a note.
 */
export function parseStatusListNoteBody(body: unknown): { note: StatusListNote } {
  if (!body || typeof body !== "object" || !Object.prototype.hasOwnProperty.call(body, "note")) {
    throw new StatusListNoteError(400, "note must be explicitly provided as a string or null");
  }
  const note = (body as { note: unknown }).note;
  if (note !== null && typeof note !== "string") {
    throw new StatusListNoteError(400, "note must be a string or null");
  }
  return { note };
}

export interface PersistStatusListNoteInput {
  store: StatusListNoteStore;
  campaignId: string;
  campaignContactId: string;
  statusListItemId: string;
  userId: string;
  note: StatusListNote;
  now?: Date;
}

export interface PersistStatusListNoteResult {
  ok: true;
  changed: boolean;
  state: StatusListNoteState;
  metadata: Record<string, unknown>;
}

/**
 * Updates a confirmed status-list note and its audit event in one transaction.
 * The Drizzle adapter locks the confirmed state row while it is read, so
 * concurrent identical PATCHes serialize before the no-op comparison.
 */
export async function persistStatusListNote(
  input: PersistStatusListNoteInput,
): Promise<PersistStatusListNoteResult> {
  const { campaignId, campaignContactId, statusListItemId, userId, note } = input;
  const now = input.now ?? new Date();

  return input.store.transaction(async (tx) => {
    const contact = await tx.getCampaignContact(campaignContactId);
    if (!contact || contact.campaignId !== campaignId) {
      throw new StatusListNoteError(404, "Contact not found in campaign");
    }

    const item = await tx.getStatusListItem(statusListItemId);
    if (!item || item.campaignId !== campaignId) {
      throw new StatusListNoteError(404, "Status-list item not found in campaign");
    }

    const state = await tx.getState(campaignContactId, statusListItemId);
    if (!state) {
      throw new StatusListNoteError(404, "Status-list item is not confirmed");
    }

    const metadata: Record<string, unknown> = {
      statusListItemId,
      campaignId,
      itemNote: note,
      itemLabel: item.label,
      itemDescription: item.description,
    };

    // Idempotent PATCHes must not create another timeline event or mutate the
    // note timestamp.
    if (state.itemNote === note) {
      return { ok: true, changed: false, state, metadata };
    }

    const updated = await tx.updateState(campaignContactId, statusListItemId, note, now);
    if (!updated) {
      throw new StatusListNoteError(409, "Status-list note could not be updated");
    }

    await tx.insertHistory({
      campaignContactId,
      userId,
      action: "status_list_note_update",
      metadata,
    });
    return { ok: true, changed: true, state: updated, metadata };
  });
}

/**
 * Adapter used by the route. Keeping the persistence operation behind the
 * small store interface makes rollback/idempotency tests independent of a
 * production database.
 */
export function createDrizzleStatusListNoteStore(database: any): StatusListNoteStore {
  return {
    transaction: <T>(work: (tx: StatusListNoteTransaction) => Promise<T>) =>
      database.transaction(async (transaction: any) => work({
        getCampaignContact: async (campaignContactId) => {
          const [row] = await transaction
            .select({ campaignId: campaignContacts.campaignId })
            .from(campaignContacts)
            .where(eq(campaignContacts.id, campaignContactId))
            .limit(1);
          return row ?? null;
        },
        getStatusListItem: async (statusListItemId) => {
          const [row] = await transaction
            .select({
              campaignId: campaignStatusListItems.campaignId,
              label: campaignStatusListItems.label,
              description: campaignStatusListItems.description,
            })
            .from(campaignStatusListItems)
            .where(eq(campaignStatusListItems.id, statusListItemId))
            .limit(1);
          return row ?? null;
        },
        getState: async (campaignContactId, statusListItemId) => {
          const [row] = await transaction
            .select()
            .from(campaignContactStatusListState)
            .where(and(
              eq(campaignContactStatusListState.campaignContactId, campaignContactId),
              eq(campaignContactStatusListState.statusListItemId, statusListItemId),
            ))
            .for("update")
            .limit(1);
          return row ?? null;
        },
        updateState: async (campaignContactId, statusListItemId, note, noteUpdatedAt) => {
          const [row] = await transaction
            .update(campaignContactStatusListState)
            .set({ itemNote: note, noteUpdatedAt })
            .where(and(
              eq(campaignContactStatusListState.campaignContactId, campaignContactId),
              eq(campaignContactStatusListState.statusListItemId, statusListItemId),
            ))
            .returning();
          return row ?? null;
        },
        insertHistory: async (history) => {
          await transaction.insert(campaignContactHistory).values(history);
        },
      })),
  };
}