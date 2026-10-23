import { useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getStatusListExecutionCopy } from "@/i18n/status-list-execution-copy";

/** Opening a contact and opening its Status List are distinct, explicit events. */
export function useStatusListAutomaticOpen({ campaignId, contactId, items, mode, pulseActive, enabled = true, locale }: {
  campaignId?: string | null; contactId?: string | null; items: any[];
  mode: "immediate" | "batch"; pulseActive: boolean; enabled?: boolean; locale: string;
}) {
  const { toast } = useToast();
  const scope = `${campaignId || ""}:${contactId || ""}`;
  const state = useRef({ scope, opened: new Set<string>(), counts: new Map<string, number>(), deferred: 0 });
  const [pending, setPending] = useState(0);
  useEffect(() => {
    if (state.current.scope !== scope) {
      state.current = { scope, opened: new Set(), counts: new Map(), deferred: 0 };
      setPending(0);
    }
    if (!enabled || !campaignId || !contactId || !items.length) return;
    const current = state.current;
    let cancelled = false;
    const check = async () => {
      await Promise.all((["card_open", "pulse_open"] as const).map(async source => {
        if (cancelled || state.current !== current) return;
        if (source === "pulse_open" && !pulseActive && !current.opened.has(source)) return;
        if (!items.some(item => item.automaticTrigger === source ||
          source==="card_open" && item.automaticTrigger==="background_change")) return;
        if (mode === "immediate" && current.opened.has(source)) return;
        current.opened.add(source);
        try {
          const response = await apiRequest("POST",
            `/api/campaigns/${campaignId}/contacts/${contactId}/status-list-workflows/automatic-open`,
            { executionMode: mode, source });
          const result = await response.json();
          if (cancelled || state.current !== current) return;
          current.counts.set(source, result.candidateCount ?? result.pendingCount ?? 0);
          current.deferred = result.deferredCount ?? 0;
          setPending(current.deferred + [...current.counts.values()].reduce((a, b) => a + b, 0));
        } catch {
          current.opened.delete(source);
          if (!cancelled && state.current === current)
            toast({ title: getStatusListExecutionCopy(locale).failed, variant: "destructive" });
        }
      }));
    };
    void check();
    const timer = mode === "batch" ? setInterval(() => void check(), 15000) : undefined;
    return () => { cancelled = true; if (timer) clearInterval(timer); };
  }, [scope, enabled, campaignId, contactId, items, mode, pulseActive, locale, toast]);
  return [pending,setPending] as const;
}
