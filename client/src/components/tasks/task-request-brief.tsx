import type { ReactNode } from "react";
import { MessageSquareQuote } from "lucide-react";
import { getTaskRequestBrief } from "@/lib/task-request-brief";
import type { Locale } from "@/i18n/translations";

interface TaskRequestBriefProps {
  description: string | null | undefined;
  locale: Locale;
  taskId: number | string;
  heading: string;
  originalLabel: string;
  emptyLabel: string;
  categoryLabels: Record<string, string>;
  children?: ReactNode;
}

export function TaskRequestBrief({
  description,
  locale,
  taskId,
  heading,
  originalLabel,
  emptyLabel,
  categoryLabels,
  children,
}: TaskRequestBriefProps) {
  const brief = getTaskRequestBrief(description, locale);
  const testId = String(taskId);

  return (
    <section className="nexus-signal-brief task-request-brief" data-testid={`task-request-brief-${testId}`} aria-labelledby={`task-request-heading-${testId}`}>
      <div className="task-request-heading">
        <span className="task-request-icon" aria-hidden="true"><MessageSquareQuote className="h-4 w-4" /></span>
        <h3 id={`task-request-heading-${testId}`}>{heading}</h3>
      </div>
      {brief.category && (
        <div className="task-request-category">{categoryLabels[brief.category]}</div>
      )}
      <p className="task-request-text" data-testid={`task-request-text-${testId}`}>{brief.request || emptyLabel}</p>
      {brief.isFeatured && (
        <details className="task-request-original">
          <summary data-testid={`button-task-request-original-${testId}`}>{originalLabel}</summary>
          <p>{brief.original}</p>
        </details>
      )}
      {children}
    </section>
  );
}