import { useQuery } from "@tanstack/react-query";
import { useOptionalReportingPeriod } from "./reporting-period";

export function useStatusListReport<T>(campaignId: string) {
  const period = useOptionalReportingPeriod();
  const from = period?.fromISO ?? "", to = period?.toISO ?? "";
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const suffix = params.size ? `?${params}` : "";
  const path = `/api/campaigns/${encodeURIComponent(campaignId)}/status-list-analytics`;
  const query = useQuery<T>({
    queryKey: ["/api/campaigns", campaignId, "status-list-analytics", from, to],
    enabled: !!campaignId && (period?.valid ?? true),
    queryFn: async () => {
      const response = await fetch(`${path}${suffix}`, { credentials: "include" });
      if (!response.ok) throw new Error(`Status List report failed (${response.status})`);
      return response.json();
    },
  });
  return { query, exportUrl: `${path}/export${suffix}`, from, to };
}
