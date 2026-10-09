import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/i18n";
import { getAutomationRecordTagCopy } from "@/i18n/automation-record-tag-copy";
import { visibleRecordTags } from "@shared/automation-record-tags";

export type RecordTagsBadgesProps = {
  entityType: string;
  entityId?: string | null;
  tags?: string[] | null;
  refresh?: boolean;
};

export function RecordTagsBadges({ entityType, entityId, tags: fallbackTags = [], refresh = true }: RecordTagsBadgesProps) {
  const { locale } = useI18n();
  const copy = getAutomationRecordTagCopy(locale);
  const hasIdentity = Boolean(refresh && entityType && entityId);
  const query = useQuery<{ tags: string[] }>({
    queryKey: ["/api/record-tags", entityType, entityId],
    enabled: hasIdentity,
    staleTime: 0,
    refetchInterval: hasIdentity ? 30_000 : false,
    queryFn: async () => {
      const response = await fetch(`/api/record-tags/${encodeURIComponent(entityType)}/${encodeURIComponent(String(entityId))}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("record tags");
      const data = await response.json();
      return { tags: visibleRecordTags(data.tags) };
    },
  });
  const visible = !refresh ? visibleRecordTags(fallbackTags) : query.isError && query.data === undefined
    ? visibleRecordTags(fallbackTags)
    : visibleRecordTags(query.data?.tags ?? fallbackTags);
  return <div data-testid="record-tag-badges" className="flex min-w-0 flex-wrap items-center gap-1" aria-label={copy.tags}>
    {visible.map(tag => <Badge key={tag} variant="secondary" className="h-5 rounded-md border-primary/10 bg-primary/[0.07] px-2 py-0 text-[10px] font-medium text-foreground/80">
      {tag}
    </Badge>)}
    {query.isError && <span className="sr-only" role="status" title={copy.badgeError}>{copy.badgeError}</span>}
  </div>;
}
