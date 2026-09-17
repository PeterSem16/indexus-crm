import { useEffect, useMemo } from "react";

type EntityLike = { id?: string | number | null } | null | undefined;

export interface WallboardPresenceOptions {
  sessionId?: string | null;
  isSessionActive: boolean;
  /** The effective selected campaign (selectedCampaign?.id || selectedCampaignId). */
  campaignId?: string | null;
  currentCampaignContactId?: string | number | null;
  currentContact?: EntityLike;
  currentClinicData?: EntityLike;
  currentCollaboratorData?: EntityLike;
  /** Keep telemetry off while the page is not the live agent workspace. */
  enabled?: boolean;
}

// A process-wide queue also orders cleanup from an unmounted workspace before
// a newly mounted workspace can announce its card.  This prevents a delayed
// stale `working:false` request from clearing a newer view.
let presenceRequestChain: Promise<void> = Promise.resolve();
let presenceRevision = 0;

function enqueuePresence(payload: {
  sessionId: string;
  campaignId: string;
  working: boolean;
}): void {
  const revision = ++presenceRevision;
  const send = async () => {
    if (revision !== presenceRevision) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5_000);
    try {
      await fetch("/api/wallboard/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch {
      // Advisory telemetry must never interfere with card work.
    } finally {
      window.clearTimeout(timeout);
    }
  };
  presenceRequestChain = presenceRequestChain.then(send, send);
}

/**
 * Announces only ephemeral editing of the current contact card.  It does not
 * inspect or control SIP/call state.
 */
export function useWallboardPresence({
  sessionId,
  isSessionActive,
  campaignId,
  currentCampaignContactId,
  currentContact,
  currentClinicData,
  currentCollaboratorData,
  enabled = true,
}: WallboardPresenceOptions): void {
  const contactId = currentContact?.id == null ? "" : String(currentContact.id);
  const clinicId = currentClinicData?.id == null ? "" : String(currentClinicData.id);
  const collaboratorId = currentCollaboratorData?.id == null ? "" : String(currentCollaboratorData.id);
  const campaignContactId = currentCampaignContactId == null ? "" : String(currentCampaignContactId);
  const effectiveCampaignId = campaignId || "";

  const cardKey = useMemo(() => {
    if (!campaignContactId || !effectiveCampaignId) return "";
    // Entity IDs are included so an async card switch cannot be mistaken for
    // the previous card while React is committing several state updates.
    return [
      effectiveCampaignId,
      campaignContactId,
      contactId,
      clinicId,
      collaboratorId,
    ].join(":");
  }, [campaignContactId, clinicId, collaboratorId, contactId, effectiveCampaignId]);

  const shouldAnnounce = !!(
    enabled &&
    isSessionActive &&
    sessionId &&
    effectiveCampaignId &&
    cardKey &&
    (contactId || clinicId || collaboratorId)
  );

  useEffect(() => {
    // Capture all identifiers in this effect.  Cleanup therefore clears only
    // the view it announced, never whichever card happens to be current later.
    if (!sessionId || !effectiveCampaignId || !enabled || !isSessionActive) return;
    const payload = {
      sessionId,
      campaignId: effectiveCampaignId,
      working: shouldAnnounce,
    };
    enqueuePresence(payload);
    if (!shouldAnnounce) return;

    const timer = window.setInterval(() => enqueuePresence(payload), 9_000);
    return () => {
      window.clearInterval(timer);
      enqueuePresence({ ...payload, working: false });
    };
  }, [cardKey, effectiveCampaignId, enabled, isSessionActive, sessionId, shouldAnnounce]);
}