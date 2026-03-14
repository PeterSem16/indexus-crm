import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Inbox,
  Send,
  FileText,
  Trash2,
  Mail,
  MessageSquare,
  ListTodo,
  MessagesSquare,
  ChevronDown,
  ChevronRight,
  ArrowDownLeft,
  ArrowUpRight,
  Loader2,
  ChevronLeft,
  ChevronUp,
  Eye,
  EyeOff,
  Settings,
  Clock,
  CheckCircle2,
  XCircle,
  CircleDashed,
  Filter,
} from "lucide-react";
import type { MailFolder, SmsMessage, Task, ChatConversation, NexusTab, TaskFilter, SmsFilter } from "./nexus-types";

interface NexusSidebarProps {
  activeTab: NexusTab;
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string) => void;
  folders: MailFolder[];
  foldersLoading: boolean;
  smsFilter: SmsFilter;
  onSmsFilterChange: (filter: SmsFilter) => void;
  taskFilter: TaskFilter;
  onTaskFilterChange: (filter: TaskFilter) => void;
  smsData?: SmsMessage[];
  tasksData?: Task[];
  chatsData?: ChatConversation[];
  totalUnreadEmails: number;
  selectedChatId?: string | null;
  onSelectChat?: (chatId: string) => void;
  onHide: () => void;
}

const wellKnownFolderMap: Record<string, { icon: React.ReactNode; order: number }> = {
  "Inbox": { icon: <Inbox className="h-4 w-4" />, order: 0 },
  "inbox": { icon: <Inbox className="h-4 w-4" />, order: 0 },
  "Sent Items": { icon: <Send className="h-4 w-4" />, order: 1 },
  "sentitems": { icon: <Send className="h-4 w-4" />, order: 1 },
  "Drafts": { icon: <FileText className="h-4 w-4" />, order: 2 },
  "drafts": { icon: <FileText className="h-4 w-4" />, order: 2 },
  "Deleted Items": { icon: <Trash2 className="h-4 w-4" />, order: 3 },
  "deleteditems": { icon: <Trash2 className="h-4 w-4" />, order: 3 },
};

function getFolderIcon(folder: MailFolder) {
  return wellKnownFolderMap[folder.displayName]?.icon 
    || wellKnownFolderMap[folder.wellKnownName || ""]?.icon 
    || <Mail className="h-4 w-4" />;
}

function loadFolderOrder(): string[] {
  try {
    const saved = localStorage.getItem("nexus-folder-order");
    return saved ? JSON.parse(saved) : [];
  } catch { return []; }
}

function saveFolderOrder(order: string[]) {
  localStorage.setItem("nexus-folder-order", JSON.stringify(order));
}

function loadHiddenFolders(): Set<string> {
  try {
    const saved = localStorage.getItem("nexus-hidden-folders");
    return saved ? new Set(JSON.parse(saved)) : new Set();
  } catch { return new Set(); }
}

export default function NexusSidebar({
  activeTab,
  selectedFolderId,
  onSelectFolder,
  folders,
  foldersLoading,
  smsFilter,
  onSmsFilterChange,
  taskFilter,
  onTaskFilterChange,
  smsData,
  tasksData,
  chatsData,
  totalUnreadEmails,
  selectedChatId,
  onSelectChat,
  onHide,
}: NexusSidebarProps) {
  const [folderManageMode, setFolderManageMode] = useState(false);
  const [hiddenFolders, setHiddenFolders] = useState<Set<string>>(loadHiddenFolders);
  const [folderOrder, setFolderOrder] = useState<string[]>(loadFolderOrder);

  const toggleFolderVisibility = (folderId: string) => {
    setHiddenFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      localStorage.setItem("nexus-hidden-folders", JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const parentFolders = folders.filter(f => !f.isChildFolder);
  const nonInboxFolders = parentFolders.filter(f => {
    const wk = f.wellKnownName || f.displayName;
    return wk !== "Inbox" && wk !== "inbox";
  });

  const sortedFolders = [...nonInboxFolders].sort((a, b) => {
    const orderA = folderOrder.indexOf(a.id);
    const orderB = folderOrder.indexOf(b.id);
    if (orderA !== -1 && orderB !== -1) return orderA - orderB;
    if (orderA !== -1) return -1;
    if (orderB !== -1) return 1;
    return 0;
  });

  const moveFolderUp = (folderId: string) => {
    const ids = sortedFolders.map(f => f.id);
    const idx = ids.indexOf(folderId);
    if (idx <= 0) return;
    [ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]];
    setFolderOrder(ids);
    saveFolderOrder(ids);
  };

  const moveFolderDown = (folderId: string) => {
    const ids = sortedFolders.map(f => f.id);
    const idx = ids.indexOf(folderId);
    if (idx < 0 || idx >= ids.length - 1) return;
    [ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]];
    setFolderOrder(ids);
    saveFolderOrder(ids);
  };

  const smsInboundCount = smsData?.filter(s => s.direction === "inbound" && s.deliveryStatus !== "read")?.length || 0;
  const smsTotal = smsData?.length || 0;
  const smsInboundTotal = smsData?.filter(s => s.direction === "inbound")?.length || 0;
  const smsOutboundTotal = smsData?.filter(s => s.direction === "outbound")?.length || 0;
  const pendingTasks = tasksData?.filter(t => t.status === "pending")?.length || 0;
  const inProgressTasks = tasksData?.filter(t => t.status === "in_progress")?.length || 0;
  const completedTasks = tasksData?.filter(t => t.status === "completed")?.length || 0;
  const cancelledTasks = tasksData?.filter(t => t.status === "cancelled")?.length || 0;
  const totalTasks = tasksData?.length || 0;

  const inboxFolder = folders.find(f => f.wellKnownName === "inbox" || f.displayName === "Inbox");
  const inboxId = inboxFolder?.id || null;

  const tabTitles: Record<NexusTab, string> = {
    email: "E-mail priečinky",
    sms: "SMS filter",
    tasks: "Stav úloh",
    chats: "Konverzácie",
  };

  return (
    <div className="flex flex-col h-full bg-card rounded-lg border shadow-sm w-[220px] min-w-[200px] max-w-[240px] shrink-0">
      <div className="flex items-center justify-between px-3 py-2.5 border-b">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{tabTitles[activeTab]}</span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onHide} data-testid="button-hide-sidebar">
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-0.5">
          {activeTab === "email" && (
            <>
              {inboxFolder && (
                <SidebarItem
                  icon={<Inbox className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
                  label="Doručená pošta"
                  badge={totalUnreadEmails > 0 ? totalUnreadEmails : undefined}
                  badgeColor="bg-blue-500"
                  active={selectedFolderId === inboxId}
                  onClick={() => inboxId && onSelectFolder(inboxId)}
                  testId="channel-email-inbox"
                />
              )}

              <div className="pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 px-2 py-1">Priečinky</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 mr-1"
                    onClick={() => setFolderManageMode(!folderManageMode)}
                    title={folderManageMode ? "Hotovo" : "Spravovať priečinky"}
                    data-testid="button-manage-folders"
                  >
                    {folderManageMode ? <Eye className="h-3 w-3" /> : <Settings className="h-3 w-3" />}
                  </Button>
                </div>
                <div className="space-y-0.5">
                  {foldersLoading ? (
                    <div className="flex items-center justify-center py-2">
                      <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    sortedFolders
                      .filter(f => folderManageMode || !hiddenFolders.has(f.id))
                      .map((folder, idx, arr) => {
                        const isHidden = hiddenFolders.has(folder.id);
                        const childFolders = folders
                          .filter(cf => cf.isChildFolder && cf.parentFolderId === folder.id)
                          .filter(cf => folderManageMode || !hiddenFolders.has(cf.id));
                        return (
                          <div key={folder.id}>
                            <div className="flex items-center gap-0.5">
                              {folderManageMode && (
                                <div className="flex flex-col shrink-0">
                                  <button
                                    onClick={() => moveFolderUp(folder.id)}
                                    className="p-0.5 rounded hover:bg-accent transition-colors disabled:opacity-30"
                                    disabled={idx === 0}
                                    data-testid={`move-folder-up-${folder.id}`}
                                  >
                                    <ChevronUp className="h-2.5 w-2.5 text-muted-foreground" />
                                  </button>
                                  <button
                                    onClick={() => moveFolderDown(folder.id)}
                                    className="p-0.5 rounded hover:bg-accent transition-colors disabled:opacity-30"
                                    disabled={idx === arr.length - 1}
                                    data-testid={`move-folder-down-${folder.id}`}
                                  >
                                    <ChevronDown className="h-2.5 w-2.5 text-muted-foreground" />
                                  </button>
                                </div>
                              )}
                              <div className={`flex-1 ${isHidden ? "opacity-40" : ""}`}>
                                <SidebarItem
                                  icon={getFolderIcon(folder)}
                                  label={folder.displayName}
                                  badge={folder.unreadItemCount > 0 ? folder.unreadItemCount : undefined}
                                  badgeColor="bg-blue-500"
                                  active={selectedFolderId === folder.id}
                                  onClick={() => !folderManageMode && onSelectFolder(folder.id)}
                                  small
                                  testId={`channel-email-${folder.displayName.toLowerCase().replace(/\s/g, "-")}`}
                                />
                              </div>
                              {folderManageMode && (
                                <button
                                  onClick={() => toggleFolderVisibility(folder.id)}
                                  className="shrink-0 p-1 rounded hover:bg-accent transition-colors"
                                  data-testid={`toggle-folder-${folder.id}`}
                                >
                                  {isHidden ? <EyeOff className="h-3 w-3 text-muted-foreground" /> : <Eye className="h-3 w-3 text-muted-foreground" />}
                                </button>
                              )}
                            </div>
                            {childFolders.map((child) => {
                              const isChildHidden = hiddenFolders.has(child.id);
                              return (
                                <div key={child.id} className="flex items-center gap-0.5">
                                  <div className={`flex-1 ${isChildHidden ? "opacity-40" : ""}`}>
                                    <SidebarItem
                                      icon={<Mail className="h-3.5 w-3.5 opacity-60" />}
                                      label={child.displayName}
                                      badge={child.unreadItemCount > 0 ? child.unreadItemCount : undefined}
                                      badgeColor="bg-blue-500"
                                      active={selectedFolderId === child.id}
                                      onClick={() => !folderManageMode && onSelectFolder(child.id)}
                                      small
                                      indent
                                      testId={`channel-email-child-${child.displayName.toLowerCase().replace(/\s/g, "-")}`}
                                    />
                                  </div>
                                  {folderManageMode && (
                                    <button
                                      onClick={() => toggleFolderVisibility(child.id)}
                                      className="shrink-0 p-1 rounded hover:bg-accent transition-colors"
                                      data-testid={`toggle-folder-${child.id}`}
                                    >
                                      {isChildHidden ? <EyeOff className="h-3 w-3 text-muted-foreground" /> : <Eye className="h-3 w-3 text-muted-foreground" />}
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })
                  )}
                </div>
              </div>
            </>
          )}

          {activeTab === "sms" && (
            <>
              <SidebarItem
                icon={<MessageSquare className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />}
                label="Všetky SMS"
                count={smsTotal}
                badge={smsInboundCount > 0 ? smsInboundCount : undefined}
                badgeColor="bg-cyan-500"
                active={smsFilter === "all"}
                onClick={() => onSmsFilterChange("all")}
                testId="sms-filter-all"
              />
              <SidebarItem
                icon={<ArrowDownLeft className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />}
                label="Prijaté"
                count={smsInboundTotal}
                badge={smsInboundCount > 0 ? smsInboundCount : undefined}
                badgeColor="bg-cyan-500"
                active={smsFilter === "inbound"}
                onClick={() => onSmsFilterChange("inbound")}
                small
                testId="sms-filter-inbound"
              />
              <SidebarItem
                icon={<ArrowUpRight className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
                label="Odoslané"
                count={smsOutboundTotal}
                active={smsFilter === "outbound"}
                onClick={() => onSmsFilterChange("outbound")}
                small
                testId="sms-filter-outbound"
              />
            </>
          )}

          {activeTab === "tasks" && (
            <>
              <SidebarItem
                icon={<ListTodo className="h-4 w-4 text-amber-600 dark:text-amber-400" />}
                label="Všetky úlohy"
                count={totalTasks}
                active={taskFilter === "all"}
                onClick={() => onTaskFilterChange("all")}
                testId="task-filter-all"
              />
              <SidebarItem
                icon={<Clock className="h-4 w-4 text-slate-500" />}
                label="Čakajúce"
                count={pendingTasks}
                badge={pendingTasks > 0 ? pendingTasks : undefined}
                badgeColor="bg-amber-500"
                active={taskFilter === "pending"}
                onClick={() => onTaskFilterChange("pending")}
                small
                testId="task-filter-pending"
              />
              <SidebarItem
                icon={<CircleDashed className="h-4 w-4 text-blue-500" />}
                label="Rozpracované"
                count={inProgressTasks}
                active={taskFilter === "in_progress"}
                onClick={() => onTaskFilterChange("in_progress")}
                small
                testId="task-filter-in-progress"
              />
              <SidebarItem
                icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                label="Dokončené"
                count={completedTasks}
                active={taskFilter === "completed"}
                onClick={() => onTaskFilterChange("completed")}
                small
                testId="task-filter-completed"
              />
              <SidebarItem
                icon={<XCircle className="h-4 w-4 text-red-500" />}
                label="Zrušené"
                count={cancelledTasks}
                active={taskFilter === "cancelled"}
                onClick={() => onTaskFilterChange("cancelled")}
                small
                testId="task-filter-cancelled"
              />
            </>
          )}

          {activeTab === "chats" && (
            <>
              {chatsData && chatsData.length > 0 ? (
                chatsData.map(chat => (
                  <SidebarItem
                    key={chat.id}
                    icon={<MessagesSquare className="h-4 w-4 text-violet-600 dark:text-violet-400" />}
                    label={chat.participantName || "Konverzácia"}
                    badge={chat.unreadCount > 0 ? chat.unreadCount : undefined}
                    badgeColor="bg-violet-500"
                    active={selectedChatId === chat.id}
                    onClick={() => onSelectChat?.(chat.id)}
                    small
                    testId={`chat-conversation-${chat.id}`}
                  />
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                  <MessagesSquare className="h-6 w-6 mb-2 opacity-40" />
                  <span className="text-xs">Žiadne konverzácie</span>
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  badge?: number;
  badgeColor?: string;
  count?: number;
  active: boolean;
  onClick: () => void;
  small?: boolean;
  indent?: boolean;
  testId: string;
}

function SidebarItem({ icon, label, badge, badgeColor = "bg-primary", count, active, onClick, small, indent, testId }: SidebarItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between rounded-md transition-all group
        ${small ? "px-2 py-1.5 text-[13px]" : "px-2.5 py-2 text-sm"}
        ${indent ? "ml-3" : ""}
        ${active 
          ? "bg-primary text-primary-foreground shadow-sm" 
          : "hover:bg-accent/60 text-foreground"
        }
      `}
      data-testid={testId}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className={`shrink-0 ${active ? "text-primary-foreground" : ""}`}>{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {count !== undefined && !badge && (
          <span className={`text-[10px] ${active ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{count}</span>
        )}
        {badge !== undefined && badge > 0 && (
          <Badge className={`${active ? "bg-white/20 text-primary-foreground" : badgeColor + " text-white"} text-[10px] h-5 min-w-[20px] px-1.5 flex items-center justify-center`}>
            {badge}
          </Badge>
        )}
      </div>
    </button>
  );
}
