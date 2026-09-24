export function callBrowseDisplayName(call: {
  entityName: string | null;
  customerName: string | null;
  phoneNumber: string;
}): string {
  return call.entityName?.trim() || call.customerName?.trim() || call.phoneNumber;
}