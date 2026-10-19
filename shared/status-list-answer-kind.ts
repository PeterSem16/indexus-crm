/** Both spellings exist in saved Missions. Recognize them without migrating data. */
export const isStatusListYesNo = (fieldType: string | null | undefined) =>
  fieldType === "yesno" || fieldType === "yes_no";
