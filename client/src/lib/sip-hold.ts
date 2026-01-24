import type { Session } from "sip.js";

interface SessionDescriptionWithBody {
  body: string;
  contentType: string;
}

function sdpSetDirection(sdp: string, direction: "sendonly" | "inactive" | "sendrecv"): string {
  if (!sdp || typeof sdp !== "string") return sdp;

  const lines = sdp.split(/\r\n/);

  let inAudio = false;
  let audioHasDirection = false;

  const isDirection = (l: string) =>
    l === "a=sendrecv" || l === "a=sendonly" || l === "a=recvonly" || l === "a=inactive";

  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("m=audio")) {
      inAudio = true;
      audioHasDirection = false;
      out.push(line);
      continue;
    }

    if (line.startsWith("m=") && !line.startsWith("m=audio")) {
      if (inAudio && !audioHasDirection) {
        out.push(`a=${direction}`);
      }
      inAudio = false;
      out.push(line);
      continue;
    }

    if (inAudio && isDirection(line)) {
      audioHasDirection = true;
      out.push(`a=${direction}`);
      continue;
    }

    out.push(line);
  }

  if (inAudio && !audioHasDirection) {
    out.push(`a=${direction}`);
  }

  return out.join("\r\n");
}

function holdModifier(description: SessionDescriptionWithBody): SessionDescriptionWithBody {
  if (!description || !description.body) return description;
  const newBody = sdpSetDirection(description.body, "sendonly");
  return {
    ...description,
    body: newBody
  };
}

function unholdModifier(description: SessionDescriptionWithBody): SessionDescriptionWithBody {
  if (!description || !description.body) return description;
  const newBody = sdpSetDirection(description.body, "sendrecv");
  return {
    ...description,
    body: newBody
  };
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
  modifier: (desc: SessionDescriptionWithBody) => SessionDescriptionWithBody
): Promise<void> {
  if (!session) throw new Error("No session");
  
  const sessionAny = session as any;
  if (typeof sessionAny.invite !== "function") {
    throw new Error("Session does not support re-INVITE");
  }
  
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
    await sendReinviteWithModifier(session, holdModifier);
    (session as any).__isHeld = true;
    console.log("[SIP Hold] Call placed on hold via re-INVITE");
  } catch (error) {
    setLocalMicEnabled(session, !wasHeld);
    console.error("[SIP Hold] Failed to place call on hold:", error);
    throw error;
  }
}

export async function unhold(session: Session): Promise<void> {
  const wasHeld = !!(session as any).__isHeld;
  
  try {
    await sendReinviteWithModifier(session, unholdModifier);
    setLocalMicEnabled(session, true);
    (session as any).__isHeld = false;
    console.log("[SIP Hold] Call resumed via re-INVITE");
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
