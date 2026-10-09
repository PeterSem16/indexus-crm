import { useQuery } from "@tanstack/react-query";
import { UserRound } from "lucide-react";
import { useI18n } from "@/i18n";
import { getAutomationAssignOwnerCopy } from "@/i18n/automation-assign-owner-copy";

export function CustomerOwnerBadge({ customerId }: { customerId: string }) {
  const { locale } = useI18n();
  const copy = getAutomationAssignOwnerCopy(locale);
  const query = useQuery<{ name: string | null }>({
    queryKey: ["/api/customers", customerId, "owner"],
    staleTime: 0,
    refetchInterval: 30_000,
    queryFn: async () => {
      const response = await fetch(`/api/customers/${encodeURIComponent(customerId)}/owner`, { credentials: "include" });
      if (!response.ok) throw new Error("Owner unavailable");
      return response.json();
    },
  });
  return <div className="flex items-center gap-2 text-xs text-muted-foreground" data-testid="customer-owner">
    <UserRound className="h-3.5 w-3.5" />
    <span>{copy.ownerLabel}: <span className="font-medium text-foreground">
      {query.isError ? copy.ownerLoadError : query.isLoading ? "…" : query.data?.name || copy.noOwner}
    </span></span>
  </div>;
}
