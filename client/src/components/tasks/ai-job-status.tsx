import { useI18n } from "@/i18n/I18nProvider";
import { Loader2 } from "lucide-react";
import type { AIJobView } from "@shared/ai-jobs";
import { activeAIJob } from "@/hooks/use-ai-job";
export function AIJobStatus({ job }: { job: AIJobView | null | undefined }) {
  const { t } = useI18n();
  if (!job) return null;
  return <div role="status" aria-live="polite" data-testid="ai-job-status" data-job-state={job.status}
    className="text-xs text-muted-foreground">
    <span className="inline-flex items-center gap-1.5">
      {activeAIJob(job) && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
      {t.aiJobs[job.status]}
    </span>
    {activeAIJob(job) && <p className="mt-1">{t.aiJobs.continueWorking}</p>}
  </div>;
}
