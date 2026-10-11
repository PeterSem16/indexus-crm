import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/contexts/auth-context";
import { AgentToolbarUnified } from "@/components/agent/AgentToolbarUnified";
import { translations } from "@/i18n/translations";

function Fixture() {
  const [counts, setCounts] = useState({ inProgress: 0, completed: 0, chat: 0, backOffice: 0 });
  const [missedCounts, setMissedCounts] = useState({ calls: 0, emails: 0, sms: 0 });
  const [stats, setStats] = useState({ calls: 0, emails: 0, sms: 0 });
  const [quotas, setQuotas] = useState<{ calls: number; emails: number; sms: number } | null>(null);
  useEffect(() => {
    const update = (event: Event) => setCounts((event as CustomEvent<typeof counts>).detail);
    const updateMissed = (event: Event) => setMissedCounts((event as CustomEvent<typeof missedCounts>).detail);
    const updateStats = (event: Event) => {
      const detail = (event as CustomEvent<{ stats: typeof stats; quotas?: typeof quotas }>).detail;
      setStats(detail.stats);
      setQuotas(detail.quotas ?? null);
    };
    window.addEventListener("test:inbox-counts", update);
    window.addEventListener("test:missed-counts", updateMissed);
    window.addEventListener("test:session-stats", updateStats);
    return () => {
      window.removeEventListener("test:inbox-counts", update);
      window.removeEventListener("test:missed-counts", updateMissed);
      window.removeEventListener("test:session-stats", updateStats);
    };
  }, []);
  return <AgentToolbarUnified status="available" onStatusChange={() => {}} stats={stats}
    quotas={quotas} isQuotaBlocked={type => quotas !== null && stats[type] >= quotas[type]} workTime="01:00" breakTypes={[]} onStartBreak={() => {}}
    onOpenBreak={() => {}} breakDialogOpen={false} isOnBreak={false} onEndSession={() => {}}
    isSessionActive t={translations.en} onOpenCommunicationCenter={() => {}} communicationUpdates={counts}
    onOpenAbandonedCalls={() => window.dispatchEvent(new Event("test:missed-open"))} missedCommunicationCounts={missedCounts} />;
}

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={new QueryClient()}><AuthProvider><Fixture /></AuthProvider></QueryClientProvider>,
);
