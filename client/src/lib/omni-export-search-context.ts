export type OmniExportSearchContext = {
  query: string;
  dateFrom: string;
  dateTo: string;
  scope: string;
  groupName?: string;
  accounts: string[];
};

export type OmniSearchCriteriaCopy = {
  criteriaTitle: string;
  criteriaQuery: string;
  criteriaNoQuery: string;
  criteriaPeriod: string;
  criteriaAnyDate: string;
  criteriaAccounts: string;
  criteriaGroup: string;
  dateFrom: string;
  dateTo: string;
};

export function proposeOmniExportSubject(templateSubject: string | undefined, defaultSubject: string): string {
  return templateSubject?.trim() ? templateSubject : defaultSubject;
}

/** The result batch, including accounts with zero matches, owns this snapshot. */
export function snapshotOmniExportSearchContext(
  criteria: Omit<OmniExportSearchContext, "accounts">,
  accounts: readonly string[],
): OmniExportSearchContext {
  return { ...criteria, accounts: Array.from(new Set(accounts)) };
}

function displayDate(value: string, locale: string): string {
  const date = new Date(`${value}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== value) return value;
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC",
  }).format(date);
}

/** Populate the editable send copy; never persist search values into the group template. */
export function appendOmniExportSearchContext(
  templateBody: string,
  context: OmniExportSearchContext | undefined,
  copy: OmniSearchCriteriaCopy,
  locale: string,
): string {
  if (!context) return templateBody;
  const lines = [
    copy.criteriaTitle,
    `${copy.criteriaQuery}: ${context.query || copy.criteriaNoQuery}`,
  ];
  if (context.dateFrom) lines.push(`${copy.dateFrom}: ${displayDate(context.dateFrom, locale)}`);
  if (context.dateTo) lines.push(`${copy.dateTo}: ${displayDate(context.dateTo, locale)}`);
  if (!context.dateFrom && !context.dateTo) lines.push(`${copy.criteriaPeriod}: ${copy.criteriaAnyDate}`);
  if (context.groupName) lines.push(`${copy.criteriaGroup}: ${context.groupName}`);
  lines.push(`${copy.criteriaAccounts}:`, ...context.accounts.map(account => `- ${account}`));
  return [templateBody, lines.join("\n")].filter(Boolean).join("\n\n");
}
