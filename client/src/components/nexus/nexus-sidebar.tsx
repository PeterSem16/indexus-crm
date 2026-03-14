import { useState, useEffect } from "react";
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
  Eye,
  EyeOff,
  Settings,
} from "lucide-react";
import type { MailFolder, SmsMessage, Task, ChatConversation, SidebarChannel } from "./nexus-types";

interface NexusSidebarProps {
  selectedChannel: SidebarChannel;
  onSelectChannel: (channel: SidebarChannel) => void;
  folders: MailFolder[];
  foldersLoading: boolean;
  smsData?: SmsMessage[];
  tasksData?: Task[];
  chatsData?: ChatConversation[];
  totalUnreadEmails: number;
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

export default function NexusSidebar({
  selectedChannel,
  onSelectChannel,
  folders,
  foldersLoading,
  smsData,
  tasksData,
  chatsData,
  totalUnreadEmails,
  onHide,
}: NexusSidebarProps) {
  const [emailFoldersOpen, setEmailFoldersOpen] = useState(true);
  const [folderManageMode, setFolderManageMode] = useState(false);

  const [hiddenFolders, setHiddenFolders] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("nexus-hidden-folders");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });

  const toggleFolderVisibility = (folderId: string) => {
    setHiddenFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      localStorage.setItem("nexus-hidden-folders", JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const smsInboundCount = smsData?.filter(s => s.direction === "inbound" && s.deliveryStatus !== "read")?.length || 0;
  const smsTotal = smsData?.length || 0;
  const smsInboundTotal = smsData?.filter(s => s.direction === "inbound")?.length || 0;
  const smsOutboundTotal = smsData?.filter(s => s.direction === "outbound")?.length || 0;
  const pendingTasks = tasksData?.filter(t => t.status === "pending")?.length || 0;
  const totalTasks = tasksData?.length || 0;
  const unreadChats = chatsData?.reduce((acc, c) => acc + (c.unreadCount || 0), 0) || 0;
  const totalChats = chatsData?.length || 0;

  const parentFolders = folders.filter(f => !f.isChildFolder);

  const isActive = (channel: SidebarChannel) => selectedChannel === channel;

  return (
    <div className="flex flex-col h-full bg-card rounded-lg border shadow-sm w-[220px] min-w-[200px] max-w-[240px] shrink-0">
      <div className="flex items-center justify-between px-3 py-2.5 border-b">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Kanály</span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onHide} data-testid="button-hide-sidebar">
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          <SidebarItem
            icon={<Inbox className="h-4 w-4" />}
            label="Všetka komunikácia"
            active={isActive("all")}
            onClick={() => onSelectChannel("all")}
            testId="channel-all"
          />
          <SidebarItem
            icon={<Mail className="h-4 w-4" />}
            label="Neprečítané"
            badge={totalUnreadEmails > 0 ? totalUnreadEmails : undefined}
            badgeColor="bg-red-500"
            active={isActive("unread")}
            onClick={() => onSelectChannel("unread")}
            testId="channel-unread"
          />

          <SectionHeader label="Email" />
          <SidebarItem
            icon={<Inbox className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
            label="Doručená pošta"
            badge={totalUnreadEmails > 0 ? totalUnreadEmails : undefined}
            badgeColor="bg-blue-500"
            active={isActive("email-inbox")}
            onClick={() => onSelectChannel("email-inbox")}
            testId="channel-email-inbox"
          />

          <div>
            <div className="flex items-center justify-between">
              <button
                onClick={() => setEmailFoldersOpen(!emailFoldersOpen)}
                className="flex-1 flex items-center gap-1.5 px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                data-testid="toggle-email-folders"
              >
                {emailFoldersOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                <span>Ďalšie priečinky</span>
              </button>
              {emailFoldersOpen && (
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
              )}
            </div>
            {emailFoldersOpen && (
              <div className="space-y-0.5 ml-2">
                {foldersLoading ? (
                  <div className="flex items-center justify-center py-2">
                    <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  parentFolders
                    .filter(f => {
                      const wk = f.wellKnownName || f.displayName;
                      return wk !== "Inbox" && wk !== "inbox";
                    })
                    .filter(f => folderManageMode || !hiddenFolders.has(f.id))
                    .map((folder) => {
                      const isHidden = hiddenFolders.has(folder.id);
                      const childFolders = folders
                        .filter(cf => cf.isChildFolder && cf.parentFolderId === folder.id)
                        .filter(cf => folderManageMode || !hiddenFolders.has(cf.id));
                      return (
                        <div key={folder.id}>
                          <div className="flex items-center gap-0.5">
                            <div className={`flex-1 ${isHidden ? "opacity-40" : ""}`}>
                              <SidebarItem
                                icon={getFolderIcon(folder)}
                                label={folder.displayName}
                                badge={folder.unreadItemCount > 0 ? folder.unreadItemCount : undefined}
                                badgeColor="bg-blue-500"
                                active={isActive(`email-folder-${folder.id}`)}
                                onClick={() => !folderManageMode && onSelectChannel(`email-folder-${folder.id}`)}
                                small
                                testId={`channel-email-${folder.displayName.toLowerCase().replace(/\s/g, "-")}`}
                              />
                            </div>
                            {folderManageMode && (
                              <button
                                onClick={() => toggleFolderVisibility(folder.id)}
                                className="shrink-0 p-1 rounded hover:bg-accent transition-colors"
                                title={isHidden ? "Zobraziť" : "Skryť"}
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
                                    active={isActive(`email-folder-${child.id}`)}
                                    onClick={() => !folderManageMode && onSelectChannel(`email-folder-${child.id}`)}
                                    small
                                    indent
                                    testId={`channel-email-child-${child.displayName.toLowerCase().replace(/\s/g, "-")}`}
                                  />
                                </div>
                                {folderManageMode && (
                                  <button
                                    onClick={() => toggleFolderVisibility(child.id)}
                                    className="shrink-0 p-1 rounded hover:bg-accent transition-colors"
                                    title={isChildHidden ? "Zobraziť" : "Skryť"}
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
            )}
          </div>

          <SectionHeader label="SMS" />
          <SidebarItem
            icon={<MessageSquare className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />}
            label="Všetky SMS"
            count={smsTotal}
            badge={smsInboundCount > 0 ? smsInboundCount : undefined}
            badgeColor="bg-cyan-500"
            active={isActive("sms-all")}
            onClick={() => onSelectChannel("sms-all")}
            testId="channel-sms-all"
          />
          <SidebarItem
            icon={<ArrowDownLeft className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />}
            label="Prijaté"
            count={smsInboundTotal}
            badge={smsInboundCount > 0 ? smsInboundCount : undefined}
            badgeColor="bg-cyan-500"
            active={isActive("sms-inbound")}
            onClick={() => onSelectChannel("sms-inbound")}
            small
            testId="channel-sms-inbound"
          />
          <SidebarItem
            icon={<ArrowUpRight className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
            label="Odoslané"
            count={smsOutboundTotal}
            active={isActive("sms-outbound")}
            onClick={() => onSelectChannel("sms-outbound")}
            small
            testId="channel-sms-outbound"
          />

          <SectionHeader label="Tím" />
          <SidebarItem
            icon={<MessagesSquare className="h-4 w-4 text-violet-600 dark:text-violet-400" />}
            label="Interné chaty"
            count={totalChats}
            badge={unreadChats > 0 ? unreadChats : undefined}
            badgeColor="bg-violet-500"
            active={isActive("chats")}
            onClick={() => onSelectChannel("chats")}
            testId="channel-chats"
          />
          <SidebarItem
            icon={<ListTodo className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
            label="Úlohy"
            count={totalTasks}
            badge={pendingTasks > 0 ? pendingTasks : undefined}
            badgeColor="bg-amber-500"
            active={isActive("tasks")}
            onClick={() => onSelectChannel("tasks")}
            testId="channel-tasks"
          />
        </div>
      </ScrollArea>
    </div>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="pt-3 pb-1 px-2">
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">{label}</span>
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
