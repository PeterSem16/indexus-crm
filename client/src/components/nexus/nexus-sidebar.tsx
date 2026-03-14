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
  Clock,
  CheckCircle2,
  XCircle,
  CircleDashed,
  FolderOpen,
  Archive,
  Star,
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

const WELL_KNOWN_FOLDERS: Record<string, { icon: React.ReactNode; label: string; order: number }> = {
  inbox: { icon: <Inbox className="h-4 w-4" />, label: "Doručená pošta", order: 0 },
  sentitems: { icon: <Send className="h-4 w-4" />, label: "Odoslané", order: 1 },
  drafts: { icon: <FileText className="h-4 w-4" />, label: "Koncepty", order: 2 },
  junkemail: { icon: <Archive className="h-4 w-4" />, label: "Spam", order: 3 },
  deleteditems: { icon: <Trash2 className="h-4 w-4" />, label: "Kôš", order: 4 },
  archive: { icon: <Archive className="h-4 w-4" />, label: "Archív", order: 5 },
};

function getWellKnownKey(folder: MailFolder): string | null {
  if (folder.wellKnownName && WELL_KNOWN_FOLDERS[folder.wellKnownName]) return folder.wellKnownName;
  const nameMap: Record<string, string> = {
    "Inbox": "inbox", "Doručená pošta": "inbox",
    "Sent Items": "sentitems", "Odoslané": "sentitems", "Odoslaná pošta": "sentitems",
    "Drafts": "drafts", "Koncepty": "drafts",
    "Junk Email": "junkemail", "Spam": "junkemail", "Nevyžiadaná pošta": "junkemail",
    "Deleted Items": "deleteditems", "Kôš": "deleteditems", "Odstránené položky": "deleteditems",
    "Archive": "archive", "Archív": "archive",
  };
  return nameMap[folder.displayName] || null;
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
  const [showOtherFolders, setShowOtherFolders] = useState(false);

  const wellKnownFolders = folders
    .filter(f => !f.isChildFolder && getWellKnownKey(f) !== null)
    .sort((a, b) => {
      const aKey = getWellKnownKey(a)!;
      const bKey = getWellKnownKey(b)!;
      return (WELL_KNOWN_FOLDERS[aKey]?.order ?? 99) - (WELL_KNOWN_FOLDERS[bKey]?.order ?? 99);
    });

  const otherFolders = folders.filter(f => !f.isChildFolder && getWellKnownKey(f) === null);

  const smsInboundCount = smsData?.filter(s => s.direction === "inbound" && s.deliveryStatus !== "read")?.length || 0;
  const smsTotal = smsData?.length || 0;
  const smsInboundTotal = smsData?.filter(s => s.direction === "inbound")?.length || 0;
  const smsOutboundTotal = smsData?.filter(s => s.direction === "outbound")?.length || 0;
  const pendingTasks = tasksData?.filter(t => t.status === "pending")?.length || 0;
  const inProgressTasks = tasksData?.filter(t => t.status === "in_progress")?.length || 0;
  const completedTasks = tasksData?.filter(t => t.status === "completed")?.length || 0;
  const cancelledTasks = tasksData?.filter(t => t.status === "cancelled")?.length || 0;
  const totalTasks = tasksData?.length || 0;

  const tabConfig: Record<NexusTab, { title: string; icon: React.ReactNode }> = {
    email: { title: "E-mail", icon: <Mail className="h-3.5 w-3.5 text-blue-500" /> },
    sms: { title: "SMS", icon: <MessageSquare className="h-3.5 w-3.5 text-cyan-500" /> },
    tasks: { title: "Úlohy", icon: <ListTodo className="h-3.5 w-3.5 text-amber-500" /> },
    chats: { title: "Chaty", icon: <MessagesSquare className="h-3.5 w-3.5 text-violet-500" /> },
  };

  return (
    <div className="flex flex-col h-full bg-card rounded-lg border w-[220px] min-w-[200px] max-w-[240px] shrink-0">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-1.5">
          {tabConfig[activeTab].icon}
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{tabConfig[activeTab].title}</span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onHide} data-testid="button-hide-sidebar">
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-1.5 space-y-0.5">
          {activeTab === "email" && (
            <>
              {foldersLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  {wellKnownFolders.map(folder => {
                    const wkKey = getWellKnownKey(folder)!;
                    const config = WELL_KNOWN_FOLDERS[wkKey];
                    const isInbox = wkKey === "inbox";
                    const childFolders = folders.filter(cf => cf.isChildFolder && cf.parentFolderId === folder.id);
                    return (
                      <div key={folder.id}>
                        <SidebarItem
                          icon={config.icon}
                          label={config.label}
                          badge={folder.unreadItemCount > 0 ? folder.unreadItemCount : undefined}
                          badgeVariant={isInbox ? "primary" : "muted"}
                          active={selectedFolderId === folder.id}
                          onClick={() => onSelectFolder(folder.id)}
                          bold={isInbox}
                          testId={`folder-${wkKey}`}
                        />
                        {childFolders.map(child => (
                          <SidebarItem
                            key={child.id}
                            icon={<FolderOpen className="h-3.5 w-3.5" />}
                            label={child.displayName}
                            badge={child.unreadItemCount > 0 ? child.unreadItemCount : undefined}
                            active={selectedFolderId === child.id}
                            onClick={() => onSelectFolder(child.id)}
                            indent
                            small
                            testId={`folder-child-${child.id}`}
                          />
                        ))}
                      </div>
                    );
                  })}

                  {otherFolders.length > 0 && (
                    <div className="pt-1">
                      <button
                        onClick={() => setShowOtherFolders(!showOtherFolders)}
                        className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-accent/40"
                        data-testid="toggle-other-folders"
                      >
                        {showOtherFolders ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        <FolderOpen className="h-3 w-3" />
                        <span>Ďalšie priečinky ({otherFolders.length})</span>
                      </button>
                      {showOtherFolders && (
                        <div className="space-y-0.5 mt-0.5">
                          {otherFolders.map(folder => {
                            const childFolders = folders.filter(cf => cf.isChildFolder && cf.parentFolderId === folder.id);
                            return (
                              <div key={folder.id}>
                                <SidebarItem
                                  icon={<FolderOpen className="h-3.5 w-3.5" />}
                                  label={folder.displayName}
                                  badge={folder.unreadItemCount > 0 ? folder.unreadItemCount : undefined}
                                  active={selectedFolderId === folder.id}
                                  onClick={() => onSelectFolder(folder.id)}
                                  small
                                  indent
                                  testId={`folder-other-${folder.id}`}
                                />
                                {childFolders.map(child => (
                                  <SidebarItem
                                    key={child.id}
                                    icon={<FolderOpen className="h-3 w-3" />}
                                    label={child.displayName}
                                    badge={child.unreadItemCount > 0 ? child.unreadItemCount : undefined}
                                    active={selectedFolderId === child.id}
                                    onClick={() => onSelectFolder(child.id)}
                                    indent
                                    small
                                    doubleIndent
                                    testId={`folder-other-child-${child.id}`}
                                  />
                                ))}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {activeTab === "sms" && (
            <>
              <SidebarItem
                icon={<MessageSquare className="h-4 w-4" />}
                label="Všetky SMS"
                count={smsTotal}
                badge={smsInboundCount > 0 ? smsInboundCount : undefined}
                badgeVariant="primary"
                active={smsFilter === "all"}
                onClick={() => onSmsFilterChange("all")}
                testId="sms-filter-all"
              />
              <SidebarItem
                icon={<ArrowDownLeft className="h-4 w-4" />}
                label="Prijaté"
                count={smsInboundTotal}
                active={smsFilter === "inbound"}
                onClick={() => onSmsFilterChange("inbound")}
                small
                testId="sms-filter-inbound"
              />
              <SidebarItem
                icon={<ArrowUpRight className="h-4 w-4" />}
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
                icon={<ListTodo className="h-4 w-4" />}
                label="Všetky úlohy"
                count={totalTasks}
                active={taskFilter === "all"}
                onClick={() => onTaskFilterChange("all")}
                testId="task-filter-all"
              />
              <div className="my-1 mx-2 border-t" />
              <SidebarItem
                icon={<Clock className="h-3.5 w-3.5 text-amber-500" />}
                label="Čakajúce"
                count={pendingTasks}
                badge={pendingTasks > 0 ? pendingTasks : undefined}
                badgeVariant="primary"
                active={taskFilter === "pending"}
                onClick={() => onTaskFilterChange("pending")}
                small
                testId="task-filter-pending"
              />
              <SidebarItem
                icon={<CircleDashed className="h-3.5 w-3.5 text-blue-500" />}
                label="Rozpracované"
                count={inProgressTasks}
                active={taskFilter === "in_progress"}
                onClick={() => onTaskFilterChange("in_progress")}
                small
                testId="task-filter-in-progress"
              />
              <SidebarItem
                icon={<CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                label="Dokončené"
                count={completedTasks}
                active={taskFilter === "completed"}
                onClick={() => onTaskFilterChange("completed")}
                small
                testId="task-filter-completed"
              />
              <SidebarItem
                icon={<XCircle className="h-3.5 w-3.5 text-red-400" />}
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
                    icon={<MessagesSquare className="h-3.5 w-3.5" />}
                    label={chat.participantName || "Konverzácia"}
                    badge={chat.unreadCount > 0 ? chat.unreadCount : undefined}
                    badgeVariant="primary"
                    active={selectedChatId === chat.id}
                    onClick={() => onSelectChat?.(chat.id)}
                    small
                    testId={`chat-conversation-${chat.id}`}
                  />
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <MessagesSquare className="h-8 w-8 mb-2 opacity-30" />
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
  badgeVariant?: "primary" | "muted";
  count?: number;
  active: boolean;
  onClick: () => void;
  small?: boolean;
  bold?: boolean;
  indent?: boolean;
  doubleIndent?: boolean;
  testId: string;
}

function SidebarItem({ icon, label, badge, badgeVariant = "muted", count, active, onClick, small, bold, indent, doubleIndent, testId }: SidebarItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between rounded-md transition-all
        ${small ? "px-2 py-1 text-[12.5px]" : "px-2.5 py-1.5 text-[13px]"}
        ${indent ? "ml-2" : ""} ${doubleIndent ? "ml-4" : ""}
        ${active 
          ? "bg-primary/10 text-primary font-medium border border-primary/20" 
          : "hover:bg-accent/50 text-foreground"
        }
      `}
      data-testid={testId}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className={`shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`}>{icon}</span>
        <span className={`truncate ${bold ? "font-semibold" : ""}`}>{label}</span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {count !== undefined && !badge && (
          <span className={`text-[10px] tabular-nums ${active ? "text-primary/60" : "text-muted-foreground/60"}`}>{count}</span>
        )}
        {badge !== undefined && badge > 0 && (
          <span className={`text-[10px] tabular-nums font-medium rounded-full h-[18px] min-w-[18px] px-1 flex items-center justify-center ${
            badgeVariant === "primary" 
              ? "bg-primary text-primary-foreground" 
              : "bg-muted text-muted-foreground"
          }`}>
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </div>
    </button>
  );
}
