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

function unchangedSdpModifier(description: SessionDescription): Promise<SessionDescription> {
  return Promise.resolve(description);
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

export async function restartSessionMedia(session: Session): Promise<void> {
  if (!session) throw new Error("No session");
  const sessionAny = session as any;
  if (sessionAny.__isHeld) throw new Error("Cannot recover media while the call is on hold");
  if (sessionAny.__mediaRecoveryInProgress) throw new Error("Media recovery is already in progress");

  const peerConnection = sessionAny.sessionDescriptionHandler?.peerConnection as RTCPeerConnection | undefined;
  if (!peerConnection) throw new Error("Session has no peer connection");
  if (typeof peerConnection.restartIce !== "function") throw new Error("ICE restart is not supported");

  sessionAny.__mediaRecoveryInProgress = true;
  try {
    peerConnection.getSenders().forEach((sender) => {
      if (sender.track?.kind === "audio") sender.track.enabled = true;
    });
    peerConnection.restartIce();
    // Do not race this transaction with a local timeout. A timed-out Promise
    // would leave the SIP re-INVITE running and could overlap a subsequent BYE.
    await sendReinviteWithModifier(session, unchangedSdpModifier);
  } finally {
    sessionAny.__mediaRecoveryInProgress = false;
  }
}

export async function hold(session: Session): Promise<void> {
  const wasHeld = !!(session as any).__isHeld;
  if ((session as any).__mediaRecoveryInProgress) {
    throw new Error("Cannot place the call on hold while media recovery is in progress");
  }
  
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
  if ((session as any).__mediaRecoveryInProgress) {
    throw new Error("Cannot resume the call while media recovery is in progress");
  }
  
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
