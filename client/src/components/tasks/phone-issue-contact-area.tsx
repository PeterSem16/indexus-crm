import { PhoneIssueVerificationControl, phoneIssueText } from "@/components/tasks/phone-issue-workflow";

export type PhoneIssueContactIdentity = {
  missionId?: string | null;
  sessionId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  locale: string;
};

/**
 * Shared phone-area slot used by the desktop communication card and the mobile
 * contact-details card. Keeping the verification control here makes it
 * impossible for either surface to accidentally couple it to disposition UI.
 */
export function PhoneIssueContactArea(props: PhoneIssueContactIdentity) {
  if ((props.entityType !== "clinic" && props.entityType !== "hospital") || !props.entityId) return null;
  const identity = `${props.missionId || ""}:${props.sessionId || ""}:${props.entityType}:${props.entityId}`;
  return (
    <section
      key={identity}
      data-testid="phone-issue-contact-area"
      aria-label={phoneIssueText("verifyTitle", props.locale)}
      className="empty:hidden border-t border-border/60 bg-muted/20 px-3 py-2 sm:px-4"
    >
      <PhoneIssueVerificationControl
        key={identity}
        open
        missionId={props.missionId}
        sessionId={props.sessionId}
        entityType={props.entityType}
        entityId={props.entityId}
        locale={props.locale}
      />
    </section>
  );
}
