import { createRoot } from "react-dom/client";
import { useState, useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { I18nProvider, useI18n } from "@/i18n";
import { ChatProvider } from "@/contexts/chat-context";
import { PulseCommunicationCenter } from "@/components/tasks/pulse-communication-center";
import { TaskGroupsDialog } from "@/components/tasks/task-groups-dialog";
import { AgentToolbarUnified } from "@/components/agent/AgentToolbarUnified";
import { useCommunicationUpdates } from "@/hooks/use-communication-updates";
import { Toaster } from "@/components/ui/toaster";
import "@/index.css";

function Fixture() {
  const { user } = useAuth();
  const { setLocale, t } = useI18n();
  const toolbar = location.search.includes("toolbar");
  const updates = useCommunicationUpdates(toolbar && !!user?.id);
  const [open, setOpen] = useState(!toolbar);
  useEffect(() => setLocale("en"), [setLocale]);
  if (!user) return <div>Loading test identity</div>;
  return <>{toolbar && <AgentToolbarUnified status="available" onStatusChange={() => {}} stats={{ calls: 0, emails: 0, sms: 0 }}
    quotas={null} isQuotaBlocked={() => false} workTime="01:00" breakTypes={[]} onStartBreak={() => {}} onOpenBreak={() => {}}
    breakDialogOpen={false} isOnBreak={false} onEndSession={() => {}} isSessionActive t={t}
    onOpenMyActivity={() => {}} onOpenCommunicationCenter={() => setOpen(true)} communicationUpdates={updates.counts}/>}
    <button onClick={() => setOpen(true)}>Reopen</button>{
    location.search.includes("settings")
      ? <TaskGroupsDialog open={open} onOpenChange={setOpen}/>
       : <PulseCommunicationCenter open={open} onOpenChange={setOpen} onTaskViewed={updates.markTaskViewed} onNewRequest={() => setOpen(false)}/>
  }<Toaster/></>;
}
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}><AuthProvider><I18nProvider><ChatProvider><Fixture/></ChatProvider></I18nProvider></AuthProvider></QueryClientProvider>,
);
