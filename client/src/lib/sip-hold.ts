import type { Session } from "sip.js";

interface SessionDescription {
  sdp?: string;
  type?: string;
}

function sdpHoldModifier(description: SessionDescription): Promise<SessionDescription> {
  if (!description || !description.sdp) return Promise.resolve(description);

  let sdp = description.sdp;
  
  sdp = sdp.replace(/a=sendrecv/g, "a=sendonly");

  if (!/a=(sendonly|inactive|recvonly)/.test(sdp)) {
    sdp = sdp.replace(/(\r\nm=audio[^\r\n]*\r\n)/, (m) => m + "a=sendonly\r\n");
  }

  console.log("[SIP Hold] Modified SDP for HOLD - replaced sendrecv with sendonly");

  return Promise.resolve({
    ...description,
    sdp
  });
}

function sdpUnholdModifier(description: SessionDescription): Promise<SessionDescription> {
  if (!description || !description.sdp) return Promise.resolve(description);

  const sdp = description.sdp.replace(/a=sendonly|a=inactive|a=recvonly/g, "a=sendrecv");

  console.log("[SIP Hold] Modified SDP for UNHOLD - replaced sendonly with sendrecv");

  return Promise.resolve({
    ...description,
    sdp
  });
}

function setLocalMicEnabled(session: Session, enabled: boolean): void {
  try {
    const sdh = session.sessionDescriptionHandler as any;
    if (!sdh || !sdh.peerConnection) return;
    const pc = sdh.peerConnection as RTCPeerConnection;
    pc.getSenders().forEach((sender) => {
      if (sender && sender.track && sender.track.kind === "audio") {
        sender.track.enabled = !!enabled;
      }
    });
  } catch (e) {
    console.error("[SIP Hold] Error setting mic enabled:", e);
  }
}

async function sendReinviteWithModifier(
  session: Session, 
  modifier: (desc: SessionDescription) => Promise<SessionDescription>
): Promise<void> {
  if (!session) throw new Error("No session");
  
  const sessionAny = session as any;
  if (typeof sessionAny.invite !== "function") {
    throw new Error("Session does not support re-INVITE");
  }
  
  console.log("[SIP Hold] Sending re-INVITE with SDP modifier");
  
  return sessionAny.invite({
    requestOptions: {
      extraHeaders: []
    },
    sessionDescriptionHandlerModifiers: [modifier]
  });
}

export async function hold(session: Session): Promise<void> {
  const wasHeld = !!(session as any).__isHeld;
  
  setLocalMicEnabled(session, false);
  
  try {
    await sendReinviteWithModifier(session, sdpHoldModifier);
    (session as any).__isHeld = true;
    console.log("[SIP Hold] Call placed on hold via re-INVITE with sendonly SDP");
  } catch (error) {
    setLocalMicEnabled(session, !wasHeld);
    console.error("[SIP Hold] Failed to place call on hold:", error);
    throw error;
  }
}

export async function unhold(session: Session): Promise<void> {
  const wasHeld = !!(session as any).__isHeld;
  
  try {
    await sendReinviteWithModifier(session, sdpUnholdModifier);
    setLocalMicEnabled(session, true);
    (session as any).__isHeld = false;
    console.log("[SIP Hold] Call resumed via re-INVITE with sendrecv SDP");
  } catch (error) {
    if (wasHeld) {
      setLocalMicEnabled(session, false);
    }
    console.error("[SIP Hold] Failed to resume call:", error);
    throw error;
  }
}

export async function holdToggle(session: Session): Promise<boolean> {
  if (!session) {
    throw new Error("No active session");
  }
  
  const held = !!(session as any).__isHeld;
  if (held) {
    await unhold(session);
    return false;
  } else {
    await hold(session);
    return true;
  }
}

export function isHeld(session: Session): boolean {
  return !!(session as any).__isHeld;
}
