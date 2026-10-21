import { ACTIVITY_TEMPLATE_FIELDS } from "./automation-activity-context";

/** The ordinary activity envelope, backed by the Mission contact snapshot.
 * Optional values remain empty, just as in the general automation renderer.
 * Call/analysis/accounting-only fields are not capabilities of Status List. */
export const STATUS_LIST_ACTIVITY_FIELDS = ACTIVITY_TEMPLATE_FIELDS.filter(field =>
  !["activity.value", "activity.metricType", "activity.contractNumber", "activity.invoiceNumber"].includes(field.value));
