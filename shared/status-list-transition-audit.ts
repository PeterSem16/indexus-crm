import type { TransitionAction, TransitionInventory } from "./status-list-transition";

export const MEDICAL_PARTNER_AUDIT_CAMPAIGN = "a65e7775-885c-4413-b2be-e63c92decd3d";
export const EXCLUDED_MEDICAL_PARTNER_EMAIL = {
  id: "ff8a1238-dc56-4923-945c-eaa66ca6c29b",
  fingerprint: "9dd70e8a0c45e2305a4a708567856e5e",
};
/** Operator-provided redacted production inventory, 2026-10-20.
 * This is evidence, not current production data, an import or an execution config.
 */
export function medicalPartnerAudit(campaignId: string): TransitionInventory | null {
  if (campaignId !== MEDICAL_PARTNER_AUDIT_CAMPAIGN) return null;
  const data = [
    ["2d2cdb47-78e2-4110-bb7f-2004ef0dacfc", "7a72d71b-33b3-4d08-a394-602e9f71dc0d", "MPN-01a", "set_contact_status", 1, "lt", "a6c85b96-97d7-4387-9f63-f505b41e0ed1", "ab57172da8ecb2bb871ae02e1c49520f"],
    ["f7375765-30ec-421d-a6a0-a64b0109e515", "6ea41ed2-360c-4508-ae76-79e8c3648478", "MPN-01b", "set_contact_status", 1, "gt", "ea014ac2-e98a-41bd-932a-803fb10c80bb", "e933b9fe97ccfcd22de0c5cc6ef96071"],
    ["5ccd33f1-4261-4cef-afad-b0c739501b65", "ed2e2be4-58a9-4e2b-8757-7d7a0e8097a8", "MPN-02b", "notify_role", null, "gt", null, "7d0e42b6574062df0fd2df1cb81104af"],
    ["25ef54c2-dba9-4964-92b4-bc97a0b933c4", "a1de5391-7dc5-47d4-a786-3d227e63c05b", "MPN-05b", "set_callback", 3, null, "5fa3ab94-c6f3-4c6d-a9ce-cd45e01563e1", "f55d673e4e4669f5e0a2232dc45b7967"],
    ["3023d4d4-8182-4556-8a47-04c4af379c49", "92d65d40-952e-4ee9-8b72-d45b0b6051d4", "MPN-05c", "set_callback", 7, null, null, "03148f2b70c0b0a95d7321253717803c"],
    ["ff8a1238-dc56-4923-945c-eaa66ca6c29b", "92d65d40-952e-4ee9-8b72-d45b0b6051d4", "MPN-05c", "send_email_group", null, null, null, "9dd70e8a0c45e2305a4a708567856e5e"],
    ["00cadb72-b7e1-4184-980b-269abce940cd", "bdf39464-05f3-4d4c-aaf0-1490f38d4dba", "MPN-05d", "set_callback", 14, null, null, "26f0dcaf8403ecceee19356623f2faed"],
    ["b766d08c-55d3-4405-beea-64f7cefdf7cb", "07a05065-ee2e-4ccb-ba02-dc0ae39c8ca7", "MPN-06c", "set_callback", 3, null, null, "991998fde826bc1710d4b084cbc393ba"],
    ["1e2ff408-f3a3-4eab-935f-cf4b5952aa5a", "7a55480a-2c3b-40e8-a558-21c54096c58b", "MPN-06d", "set_callback", 3, null, null, "015a8ea5a47e4194d4a86fc976da634d"],
    ["7656cd19-4747-4cfd-a2ec-e26543a6a8a4", "e49ab401-9e10-4960-a673-5475a6ceba28", "MPN-06e", "set_callback", 7, null, null, "f7dc7f3794358927944140128ca6debe"],
  ] as const;
  const actions: TransitionAction[] = data.map(([id, itemId, stepCode, type, days, op, dispositionId, fingerprint]) => ({
    id, itemId, stepCode, type, fingerprint, dispositionId,
    condition: op ? { kind: "call_count", logic: "AND", rules: [{ op, value: 1 }] } : { kind: "always" },
    callback: days === null ? null : { days, time: "09:00", weekdaysOnly: true, existing: "replace" },
    issues: type === "notify_role" ? ["legacy_notification_unhandled"] :
      id === EXCLUDED_MEDICAL_PARTNER_EMAIL.id ? ["excluded_by_owner"] : [],
    excluded: id === EXCLUDED_MEDICAL_PARTNER_EMAIL.id,
  }));
  return {
    campaignId, source: "audited_production", capturedAt: "2026-10-20T10:10:28.535887Z",
    fingerprint: "operator-audit-2026-10-20", actions,
    evidence: {
      productionLiveVerified: false, sourceCommit: "0b1bc1c12ea690cd3db2fb01369a7f7dbe370a5e",
      schemaAvailable: false, itemCount: 70, questionCount: 0,
    },
    activationAllowed: false,
  };
}
