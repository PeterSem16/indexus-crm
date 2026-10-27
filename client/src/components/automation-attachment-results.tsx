import { useI18n } from "@/i18n";
import type { AttachmentOutcome } from "@shared/automation-attachment-outcomes";

export function AutomationAttachmentResults({ activity }: {
  activity: { status: "available" | "unavailable" | "not_recorded"; outcomes: AttachmentOutcome[] };
}) {
  const { t } = useI18n();
  const copy = t.automationAttachments;
  return <section className="mt-2 rounded-md border p-3" data-testid="automation-attachment-results">
    <h4 className="text-sm font-medium">{copy.title}</h4>
    {activity.status !== "available"
      ? <p className="mt-1 text-xs text-muted-foreground">{activity.status === "unavailable" ? copy.unavailable : copy.notRecorded}</p>
      : !activity.outcomes.length ? <p className="mt-1 text-xs text-muted-foreground">{copy.empty}</p>
      : <ul className="mt-2 space-y-2">
        {activity.outcomes.map(outcome => <li key={outcome.position} className="text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{copy.attachment} {outcome.position}</span>
            <span className="rounded bg-muted px-2 py-0.5">{copy[outcome.result]}</span>
          </div>
          {outcome.result === "unprocessed" && <p className="mt-1 text-muted-foreground">{copy.reasons[outcome.reason]}</p>}
        </li>)}
      </ul>}
  </section>;
}
