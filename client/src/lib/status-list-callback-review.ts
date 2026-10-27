import { statusListCallbackPrefill } from "../../../shared/status-list-callback-calendar";

/** A fresh, click-owned draft; never save it until the agent accepts review. */
export function prepareStatusListCallbackReview(item: any, dispositions: any[] = []) {
  const callbackActions = (item?.automations || []).filter((action: any) =>
    action.actionType === "set_callback" ||
    action.actionType === "set_contact_status" && dispositions.some(disposition =>
      String(disposition.id) === String(action.dispositionId) &&
      ["callback", "schedule_email", "schedule_sms"].includes(disposition.actionType)));
  const callbackDraft = callbackActions.length
    ? { callbackDate: statusListCallbackPrefill(callbackActions[0]), callbackNote: "" }
    : undefined;
  return {
    callbackDraft,
    callbackDetails: Object.fromEntries(callbackActions.map((action: any) => [String(action.id), callbackDraft!])),
    callbackEditor: callbackDraft ? {
      actionId: String(callbackActions[0].id),
      onChange: (detail: { callbackDate?: string; callbackNote?: string }) => { Object.assign(callbackDraft, detail); },
    } : undefined,
  };
}
