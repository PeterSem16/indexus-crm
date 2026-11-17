import type { EmailMonitoringDetail } from "@shared/email-monitoring-detail";
import { useI18n } from "@/i18n";
import { getCommunicationAnalysisCopy } from "@/lib/communication-analysis-copy";

const flags = ["hasInappropriateContent", "hasAngryTone", "hasRudeExpressions",
  "wantsToCancel", "wantsConsent", "doesNotAcceptContract"] as const;

export function EmailMonitoringAnalysis({ result }: { result: EmailMonitoringDetail | null | undefined }) {
  const { t, locale } = useI18n();
  if (!result || result.source !== "email.monitoring") return null;
  const copy = getCommunicationAnalysisCopy(locale), text = t.emailMonitoringDetail;
  const analysis = result.analysis;
  const tone = analysis.alertLevel === "critical"
    ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950"
    : analysis.alertLevel === "warning"
      ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950"
      : "border-border bg-muted/30";
  return <section className={`rounded-md border p-3 ${tone}`} aria-label={text.title}
    data-testid="email-monitoring-analysis">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-sm font-semibold">{text.title}</h3>
      <span className="font-mono text-xs text-muted-foreground">email.monitoring</span>
    </div>
    <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
      {[["sentiment", copy.optionLabels[analysis.sentiment]], ["alertLevel", copy.optionLabels[analysis.alertLevel]]]
        .map(([key, value]) => <div key={key} className="flex flex-wrap justify-between gap-x-2">
          <dt className="text-muted-foreground">{copy.fieldLabels[`newValues.${key}`]}</dt><dd>{value}</dd>
        </div>)}
      {flags.map(key => <div key={key} className="flex flex-wrap justify-between gap-x-2" data-analysis-field={key}>
        <dt className="text-muted-foreground">{key === "hasInappropriateContent" ? text.inappropriate
          : copy.fieldLabels[`newValues.${key}`]}</dt>
        <dd>{analysis[key] ? copy.yes : copy.no}</dd>
      </div>)}
    </dl>
    <p className="mt-2 text-xs font-medium">{text.note}</p>
    <p className="whitespace-pre-wrap break-words text-sm" data-testid="email-monitoring-note">{analysis.note}</p>
  </section>;
}
