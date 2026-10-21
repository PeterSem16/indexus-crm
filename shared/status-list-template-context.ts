import { ACTIVITY_TEMPLATE_FIELDS } from "./automation-activity-context";

/** The ordinary activity envelope, backed by the Mission contact snapshot.
 * Optional values remain empty, just as in the general automation renderer.
 * Call/analysis/accounting-only fields are not capabilities of Status List. */
export const STATUS_LIST_ACTIVITY_FIELDS = ACTIVITY_TEMPLATE_FIELDS.filter(field =>
  !["activity.value", "activity.metricType", "activity.contractNumber", "activity.invoiceNumber"].includes(field.value));

/** Same names as the Mission composer; no arbitrary entity-row traversal. */
export const STATUS_LIST_RECORD_KEYS: Record<string, string[]> = {
  clinic: ["id", "name", "doctorTitle", "doctorFirstName", "doctorLastName", "doctorTitleAfter",
    "address", "city", "postalCode", "countryCode", "phone", "email", "website", "notes", "contractStatus"],
  hospital: ["id", "name", "fullName", "address", "city", "postalCode", "region", "countryCode",
    "contactPerson", "phone", "email"],
  customer: ["id", "firstName", "lastName", "email", "email2", "phone", "phone2", "address",
    "city", "postalCode", "country", "birthDate", "deliveryDate"],
};
export const STATUS_LIST_RECORD_TEMPLATE_FIELDS = [
  ...Object.entries(STATUS_LIST_RECORD_KEYS).flatMap(([type, fields]) => fields.map(key => `${type}.${key}`)),
  ...["clinic.doctorName", "clinic.doctorFullName", "clinic.doctorSalutation", "clinic.doctorSalutationFull", "clinic.doctorSalutationDoc",
    "hospital.contactPersonSalutation", "hospital.contactPersonSalutationFull", "hospital.contactPersonSalutationDoc",
    "customer.fullName", "customer.salutation", "customer.salutationFull",
    "user.fullName", "user.email", "user.phone", "user.position", "currentDate", "currentYear"],
].map(value => ({ value, label: value, type: "string" }));

export const STATUS_LIST_RECORD_DB_KEYS = [...new Set(Object.values(STATUS_LIST_RECORD_KEYS).flat()
  .map(key => key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)))];

export function statusListRecordValues(type: string, data: Record<string, unknown>) {
  return Object.fromEntries((STATUS_LIST_RECORD_KEYS[type] || []).map(key => {
    const value = data[key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)];
    return [key, typeof value === "string" || typeof value === "number" ? value : ""];
  }));
}
