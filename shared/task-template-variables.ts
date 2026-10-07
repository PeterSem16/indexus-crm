/** Email/SMS keys already have braces; catalog field paths do not. */
export function templateVariableToken(value: string): string {
  return `{{${value.replace(/^\{+|\}+$/g, "").trim()}}}`;
}

export function taskSalutationFields(module: string, event?: string) {
  // Scheduled snapshots intentionally exclude contact identity.
  if (event === "schedule.tick" || !["customer", "clinic", "collaborator"].includes(module)) return [];
  return [
    { value: "newValues.salutation", label: "Salutation", type: "string" },
    { value: "newValues.salutationFull", label: "Full salutation", type: "string" },
    { value: "newValues.salutationDoc", label: "Doctor salutation", type: "string" },
  ];
}
