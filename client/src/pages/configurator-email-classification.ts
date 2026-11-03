import type { EmailPurpose } from "@shared/email-purpose";
import type { FunnelStep } from "../../../shared/mission-funnel";

interface ExistingEmailTemplate {
  type: string;
  emailPurpose?: EmailPurpose;
  emailFunnelSteps?: FunnelStep[] | null;
}

export function templateEmailClassification({
  type,
  existing,
  purpose,
  funnelSteps,
  funnelStepsEdited,
}: {
  type: string;
  existing: ExistingEmailTemplate | null;
  purpose: EmailPurpose;
  funnelSteps: FunnelStep[];
  funnelStepsEdited: boolean;
}): { emailPurpose: EmailPurpose | undefined; emailFunnelSteps: FunnelStep[] | null } {
  if (type !== "email") return { emailPurpose: "unspecified", emailFunnelSteps: [] };

  const emailPurpose = existing?.type === "email"
    ? existing.emailPurpose
    : purpose;
  const emailFunnelSteps = existing?.type === "email" && !funnelStepsEdited
    ? existing.emailFunnelSteps ?? null
    : [...funnelSteps];

  return { emailPurpose, emailFunnelSteps };
}
