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

export type UnifiedMessage = {
  id: string;
  type: "email" | "task" | "chat" | "sms";
  title: string;
  preview: string;
  timestamp: string;
  isUnread: boolean;
  priority?: string;
  status?: string;
  from?: string;
  hasAttachments?: boolean;
  direction?: "inbound" | "outbound";
  originalData: EmailMessage | Task | ChatConversation | SmsMessage;
  aiAlertLevel?: string;
  aiHasAngryTone?: boolean;
  aiWantsToCancel?: boolean;
};

export interface ColumnConfig {
  id: string;
  label: string;
  visible: boolean;
  order: number;
}

export type SidebarChannel = "all" | "unread" | "email-inbox" | "email-sent" | "email-drafts" | "email-trash" | "sms-all" | "sms-inbound" | "sms-outbound" | "tasks" | "chats" | string;

export const typeColors = {
  email: { bg: "bg-blue-50 dark:bg-blue-950/30", text: "text-blue-700 dark:text-blue-300", border: "border-blue-400", dot: "bg-blue-500" },
  task: { bg: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-400", dot: "bg-emerald-500" },
  chat: { bg: "bg-violet-50 dark:bg-violet-950/30", text: "text-violet-700 dark:text-violet-300", border: "border-violet-400", dot: "bg-violet-500" },
  sms: { bg: "bg-cyan-50 dark:bg-cyan-950/30", text: "text-cyan-700 dark:text-cyan-300", border: "border-cyan-400", dot: "bg-cyan-500" },
};
