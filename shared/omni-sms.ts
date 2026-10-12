export const OMNI_SMS_PROVIDERS = ["bulkgate", "smstools"] as const;
export type OmniSmsProvider = typeof OMNI_SMS_PROVIDERS[number];
export const OMNI_SMS_COUNTRIES = ["SK", "CZ", "AT", "HU", "RO", "IT", "DE", "US", "CH"] as const;
export interface OmniSmsAccess {
  isAdmin: boolean;
  countries: string[];
  grants: { countryCode: string; provider: OmniSmsProvider }[];
  gateways: { provider: OmniSmsProvider; label: string; countries: string[] }[];
}
export interface OmniSmsMessage {
  id: string;
  isRead?: boolean;
  replyToSmsId?: string | null;
  replies?: OmniSmsMessage[];
  countryCode: string | null;
  provider: string | null;
  direction: string;
  content: string;
  recipientPhone: string | null;
  senderPhone: string | null;
  status: string;
  deliveryStatus: string | null;
  createdAt: string;
  sentAt: string | null;
  campaignId: string | null;
  entityId: string | null;
  entityType: string | null;
  customerId: string | null;
  customer?: { id: string; firstName: string; lastName: string } | null;
  contactName: string | null;
  aiAnalyzed: boolean | null;
  aiAlertLevel: string | null;
  aiSentiment: string | null;
  aiHasAngryTone: boolean | null;
  aiHasRudeExpressions: boolean | null;
  aiWantsToCancel: boolean | null;
  aiWantsConsent: boolean | null;
  aiDoesNotAcceptContract: boolean | null;
  aiAnalysisNote: string | null;
}
export interface OmniSmsPage {
  messages: OmniSmsMessage[];
  total: number;
  page: number;
  pageSize: number;
}
export interface OmniSmsPermissionUser {
  id: string;
  name: string;
  username: string;
  assignedCountries: string[];
  providers: OmniSmsProvider[];
}
