import type { AIJobView } from "@shared/ai-jobs";
import { useI18n } from "@/i18n/I18nProvider";
import { AIJobStatus } from "@/components/tasks/ai-job-status";
import { Button } from "@/components/ui/button";
export function EmailSummaryJob({ job, onOpen, onRetry, retrying }: {
  job?: AIJobView | null; onOpen(summary: string): void; onRetry(): void; retrying: boolean;
}) {
  const { t } = useI18n();
  if (!job) return null;
  return <div className="my-2 rounded-md border border-border p-3" data-testid="email-summary-job">
    <AIJobStatus job={job} />
    {job.status === "completed" && typeof job.result?.summary === "string" &&
      <Button variant="ghost" size="sm" onClick={() => onOpen(job.result!.summary as string)}>
        {t.nexusOmni.ai.conversationSummary}
      </Button>}
    {job.status === "failed" && <Button variant="ghost" size="sm" onClick={onRetry}
      disabled={retrying || job.attempts >= job.maxAttempts}>{t.tasks.resolutionDialog.retry}</Button>}
  </div>;
}
