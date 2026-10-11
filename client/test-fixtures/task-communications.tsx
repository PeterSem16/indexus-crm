import { createRoot } from "react-dom/client";
import { useState, useEffect, lazy, Suspense } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { PermissionsProvider } from "@/contexts/permissions-context";
import { CountryFilterProvider } from "@/contexts/country-filter-context";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider, useI18n } from "@/i18n";
import { ChatProvider } from "@/contexts/chat-context";
import { PulseCommunicationCenter } from "@/components/tasks/pulse-communication-center";
import { TaskGroupsDialog } from "@/components/tasks/task-groups-dialog";
import { AgentToolbarUnified } from "@/components/agent/AgentToolbarUnified";
import { useCommunicationUpdates } from "@/hooks/use-communication-updates";
import { Toaster } from "@/components/ui/toaster";
import { InternalChatPanel } from "@/components/chat/InternalChatPanel";
import NexusSidebar from "@/components/nexus/nexus-sidebar";
import { NotificationItem } from "@/components/notification-center";
import "@/index.css";
const CampaignsPage = lazy(() => import("@/pages/campaigns"));

function Fixture() {
  const { user } = useAuth();
  const { setLocale, t } = useI18n();
  const [fixtureMode] = useState(() => location.search);
  const toolbar = fixtureMode.includes("toolbar");
  const [missionId, setMissionId] = useState<string | undefined>(fixtureMode.includes("scope") ? "mission-one" : undefined);
  const updates = useCommunicationUpdates(toolbar && !!user?.id, missionId);
  const [open, setOpen] = useState(!toolbar);
  const [omniPartner, setOmniPartner] = useState<string | null>(null);
  useEffect(() => setLocale("en"), [setLocale]);
  if (!user) return <div>Loading test identity</div>;
  return <>{fixtureMode.includes("scope") && <button data-testid="switch-mission" onClick={() => setMissionId("mission-two")}>Switch Mission</button>}{toolbar && <AgentToolbarUnified status="available" onStatusChange={() => {}} stats={{ calls: 0, emails: 0, sms: 0 }}
    quotas={null} isQuotaBlocked={() => false} workTime="01:00" breakTypes={[]} onStartBreak={() => {}} onOpenBreak={() => {}}
    breakDialogOpen={false} isOnBreak={false} onEndSession={() => {}} isSessionActive t={t}
    onOpenMyActivity={() => {}} onOpenCommunicationCenter={() => setOpen(true)} communicationUpdates={updates.counts}/>}
    <button onClick={() => setOpen(true)}>Reopen</button>{
    fixtureMode.includes("mission-chat")
      ? <PermissionsProvider><CountryFilterProvider><TooltipProvider><Suspense fallback={<div>Loading Mission settings</div>}><CampaignsPage/></Suspense></TooltipProvider></CountryFilterProvider></PermissionsProvider>
      : fixtureMode.includes("settings")
      ? <TaskGroupsDialog open={open} onOpenChange={setOpen}/>
      : fixtureMode.includes("omni") ? <div className="h-screen p-4">
        <NotificationItem notification={{ id: "chat-notice", userId: "viewer", type: "new_chat", title: "Chat", message: "Test Colleague A", priority: "normal", isRead: false, isDismissed: false, createdAt: new Date().toISOString(), metadata: { senderId: "a" } } as any} onMarkRead={() => {}} onDismiss={() => {}} />
         <TooltipProvider><div className="flex h-[calc(100%-40px)] gap-3">
           {fixtureMode.includes("rail") && <NexusSidebar activeTab="chats" selectedFolderId={null} onSelectFolder={() => {}} folders={[]} foldersLoading={false}
             smsFilter="all" onSmsFilterChange={() => {}} taskFilter="all" onTaskFilterChange={() => {}} totalUnreadEmails={0}
             collapsed onToggleCollapse={() => {}} selectedChatId={omniPartner} onSelectChat={setOmniPartner}
             chatsData={[
               { id: "a", participantId: "a", participantName: "Test Colleague A", participantAvatarUrl: "/test-avatar-a.svg", lastMessage: "", lastMessageAt: "", unreadCount: 2 },
               { id: "b", participantId: "b", participantName: "Test Colleague B", lastMessage: "", lastMessageAt: "", unreadCount: 0 },
             ]}/>}
           <InternalChatPanel theme="omni" initialPartnerId={omniPartner} onPartnerChange={setOmniPartner}/>
         </div></TooltipProvider>
      </div>
       : <PulseCommunicationCenter missionId={missionId} open={open} onOpenChange={setOpen} onTaskViewed={updates.markTaskViewed} onNewRequest={() => setOpen(false)}/>
  }<Toaster/></>;
}
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}><AuthProvider><I18nProvider><ChatProvider><Fixture/></ChatProvider></I18nProvider></AuthProvider></QueryClientProvider>,
);
