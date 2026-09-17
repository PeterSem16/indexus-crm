/** Utilities shared by the Nexus Pulse status-list note editors. */

export type StatusListNoteDrafts = Record<string, string>;

export function normalizeStatusListNote(note: unknown): string {
  return typeof note === "string" ? note : "";
}

/** The API uses null for a cleared note, while the editor uses an empty string. */
export function statusListNotePayload(note: unknown): string | null {
  const value = normalizeStatusListNote(note);
  return value.length > 0 ? value : null;
}

/**
 * Return only drafts which differ from the last server snapshot.  Keeping this
 * comparison outside the component is important: an empty string is a real
 * draft (it clears a note), not a missing object key.
 */
export function getDirtyStatusListNoteIds(
  drafts: StatusListNoteDrafts,
  persisted: Record<string, unknown>,
  eligibleIds?: Iterable<string>,
): Set<string> {
  const eligible = eligibleIds ? new Set(Array.from(eligibleIds, String)) : null;
  const dirty = new Set<string>();
  for (const [rawId, draft] of Object.entries(drafts)) {
    const id = String(rawId);
    if (eligible && !eligible.has(id)) continue;
    if (normalizeStatusListNote(draft) !== normalizeStatusListNote(persisted[id])) {
      dirty.add(id);
    }
  }
  return dirty;
}

/**
 * Hydrate server notes without touching a draft that has diverged locally.
 * This makes query invalidation/refetch safe while a textarea is being edited.
 */
export function mergeStatusListNoteDrafts(
  drafts: StatusListNoteDrafts,
  persisted: Record<string, unknown>,
  dirtyIds: Iterable<string> = [],
): StatusListNoteDrafts {
  const dirty = new Set(Array.from(dirtyIds, String));
  const next = { ...drafts };
  for (const [rawId, serverNote] of Object.entries(persisted)) {
    const id = String(rawId);
    if (!dirty.has(id)) {
      next[id] = normalizeStatusListNote(serverNote);
    }
  }
  return next;
}