export type NexusTab = "email" | "sms" | "tasks" | "chats" | "teams";

export interface Mailbox {
  id: string;
  email: string;
  displayName: string;
  type: "personal" | "shared";
  isDefault: boolean;
}

export interface MailFolder {
  id: string;
  displayName: string;
  unreadItemCount: number;
  totalItemCount: number;
  wellKnownName?: string;
  childFolderCount?: number;
  hasChildren?: boolean;
  isChildFolder?: boolean;
  parentFolderId?: string;
  parentDisplayName?: string;
  depth?: number;
}

export interface EmailMessage {
  id: string;
  subject: string;
  from: { emailAddress: { name: string; address: string } };
  toRecipients: { emailAddress: { name: string; address: string } }[];
  ccRecipients?: { emailAddress: { name: string; address: string } }[];
  receivedDateTime: string;
  sentDateTime?: string;
  isRead: boolean;
  bodyPreview: string;
  body?: { content: string; contentType: string };
  hasAttachments: boolean;
  importance: string;
  linkedCustomer?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  aiAnalysis?: {
    sentiment: string;
    hasInappropriateContent: boolean;
    alertLevel: string;
    note: string;
    hasAngryTone?: boolean;
    hasRudeExpressions?: boolean;
    wantsToCancel?: boolean;
    wantsConsent?: boolean;
    doesNotAcceptContract?: boolean;
    pipelineActionTaken?: boolean;
    pipelineStageId?: string;
    pipelineStageName?: string;
    pipelineActionReason?: string;
  };
  _mailboxEmail?: string;
}

export interface EmailSignature {
  id?: string;
  userId: string;
  mailboxEmail: string;
  htmlContent: string;
  isActive: boolean;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;
  priority: string;
  status: string;
  assignedUserId: string;
  createdByUserId: string;
  customerId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatConversation {
  id: string;
  participantId: string;
  participantName: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

export interface SmsMessage {
  id: string;
  customerId?: string;
  recipientPhone: string;
  senderPhone?: string;
  content: string;
  type: "sms";
  direction: "outbound" | "inbound";
  status?: string;
  deliveryStatus?: string;
  sentAt?: string;
  deliveredAt?: string;
  createdAt: string;
  customer?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  aiAnalyzed?: boolean;
  aiSentiment?: string;
  aiAlertLevel?: string;
  aiHasAngryTone?: boolean;
  aiHasRudeExpressions?: boolean;
  aiWantsToCancel?: boolean;
  aiWantsConsent?: boolean;
  aiDoesNotAcceptContract?: boolean;
  aiAnalysisNote?: string;
}

export interface ColumnConfig {
  id: string;
  label: string;
  visible: boolean;
  order: number;
}

export type SidebarChannel = "all" | "unread" | "email-inbox" | "email-sent" | "email-drafts" | "email-trash" | "sms-all" | "sms-inbound" | "sms-outbound" | "tasks" | "chats" | string;

export const typeColors: Record<string, { bg: string; text: string; border: string; dot: string; accent: string }> = {
  email: { bg: "bg-blue-50 dark:bg-blue-950/30", text: "text-blue-700 dark:text-blue-300", border: "border-blue-200 dark:border-blue-800", dot: "bg-blue-500", accent: "text-blue-600 dark:text-blue-400" },
  task: { bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-700 dark:text-amber-300", border: "border-amber-200 dark:border-amber-800", dot: "bg-amber-500", accent: "text-amber-600 dark:text-amber-400" },
  tasks: { bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-700 dark:text-amber-300", border: "border-amber-200 dark:border-amber-800", dot: "bg-amber-500", accent: "text-amber-600 dark:text-amber-400" },
  chat: { bg: "bg-violet-50 dark:bg-violet-950/30", text: "text-violet-700 dark:text-violet-300", border: "border-violet-200 dark:border-violet-800", dot: "bg-violet-500", accent: "text-violet-600 dark:text-violet-400" },
  chats: { bg: "bg-violet-50 dark:bg-violet-950/30", text: "text-violet-700 dark:text-violet-300", border: "border-violet-200 dark:border-violet-800", dot: "bg-violet-500", accent: "text-violet-600 dark:text-violet-400" },
  sms: { bg: "bg-cyan-50 dark:bg-cyan-950/30", text: "text-cyan-700 dark:text-cyan-300", border: "border-cyan-200 dark:border-cyan-800", dot: "bg-cyan-500", accent: "text-cyan-600 dark:text-cyan-400" },
  teams: { bg: "bg-indigo-50 dark:bg-indigo-950/30", text: "text-indigo-700 dark:text-indigo-300", border: "border-indigo-200 dark:border-indigo-800", dot: "bg-indigo-500", accent: "text-indigo-600 dark:text-indigo-400" },
};

export type TaskFilter = "all" | "pending" | "in_progress" | "completed" | "cancelled";
export type SmsFilter = "all" | "inbound" | "outbound";
