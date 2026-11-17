/** Read-only projection of an already persisted monitoring result, never a new inference. */
export interface EmailMonitoringDetail {
  source: "email.monitoring";
  analyzedAt: string | null;
  analysis: {
    sentiment: "positive" | "neutral" | "negative" | "angry";
    hasInappropriateContent: boolean;
    hasAngryTone: boolean;
    hasRudeExpressions: boolean;
    wantsToCancel: boolean;
    wantsConsent: boolean;
    doesNotAcceptContract: boolean;
    alertLevel: "none" | "warning" | "critical";
    note: string;
  };
}
