import { createRoot } from "react-dom/client";
import { useState, useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { I18nProvider, useI18n } from "@/i18n";
import { ChatProvider } from "@/contexts/chat-context";
import { PulseCommunicationCenter } from "@/components/tasks/pulse-communication-center";
import { TaskGroupsDialog } from "@/components/tasks/task-groups-dialog";
import { Toaster } from "@/components/ui/toaster";
import "@/index.css";

function Fixture() {
  const { user } = useAuth();
  const { setLocale } = useI18n();
  const [open, setOpen] = useState(true);
  useEffect(() => setLocale("en"), [setLocale]);
  if (!user) return <div>Loading test identity</div>;
  return <><button onClick={() => setOpen(true)}>Reopen</button>{
    location.search.includes("settings")
      ? <TaskGroupsDialog open={open} onOpenChange={setOpen}/>
      : <PulseCommunicationCenter open={open} onOpenChange={setOpen} onNewRequest={() => setOpen(false)}/>
  }<Toaster/></>;
}
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}><AuthProvider><I18nProvider><ChatProvider><Fixture/></ChatProvider></I18nProvider></AuthProvider></QueryClientProvider>,
);
