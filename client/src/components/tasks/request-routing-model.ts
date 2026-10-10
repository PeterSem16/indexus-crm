import type { Translations } from "@/i18n/translations";

export type RequestRecipients = { groupIds: string[]; userIds: string[] };
export type TaskRequestType = RequestRecipients & { id: string; name: string; enabled: boolean };
export const emptyRecipients = (): RequestRecipients => ({ groupIds: [], userIds: [] });
export function defaultRecipients(type?: TaskRequestType): RequestRecipients {
  return type?.enabled ? { groupIds: [...type.groupIds], userIds: [...type.userIds] } : emptyRecipients();
}
export function requestTypeLabel(type: { id?: string; name?: string | null }, t: Translations): string {
  const labels: Record<string, string> = {
    change_data: t.quickCreate.catChangeData, wrong_phone: t.quickCreate.catWrongPhone,
    wrong_email: t.quickCreate.catWrongEmail, wrong_address: t.quickCreate.catWrongAddress,
    document_request: t.quickCreate.catDocument, complaint: t.quickCreate.catComplaint, other: t.quickCreate.catOther,
  };
  return type.name && type.name !== type.id ? type.name : labels[type.id || ""] || t.taskCommunication.generalRequest;
}
export function toggleRecipient(current: RequestRecipients, key: keyof RequestRecipients, id: string): RequestRecipients {
  return { ...current, [key]: current[key].includes(id) ? current[key].filter(value => value !== id) : [...current[key], id] };
}
export function recipientsAreAvailable(current: RequestRecipients, groups: { id: string }[], users: { id: string }[]): boolean {
  return current.groupIds.every(id => groups.some(group => group.id === id)) && current.userIds.every(id => users.some(user => user.id === id));
}
