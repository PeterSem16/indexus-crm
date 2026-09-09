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

type SipOperationName = "hold" | "unhold" | "media-recovery" | "terminate";

function enqueueSipOperation(
  session: Session,
  name: SipOperationName,
  operation: () => Promise<void>,
): Promise<void> {
  const sessionAny = session as any;
  const previous: Promise<void> = sessionAny.__sipOperationQueue || Promise.resolve();
  const current = previous
    .catch(() => {})
    .then(async () => {
      if (sessionAny.__terminationRequested && name !== "terminate") {
        throw new Error("Session termination is already requested");
      }
      sessionAny.__activeSipOperation = name;
      try {
        await operation();
      } finally {
        if (sessionAny.__activeSipOperation === name) {
          sessionAny.__activeSipOperation = null;
        }
      }
    });
  sessionAny.__sipOperationQueue = current.catch(() => {});
  return current;
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

  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const transactionDeadline = window.setTimeout(() => {
      if (settled) return;
      sessionAny.__terminationRequested = true;
      console.error("[SIP Hold] re-INVITE did not receive a final response; terminating the dialog");
      void Promise.resolve(
        String(session.state) === "Established" ? session.bye() : sessionAny.cancel?.(),
      ).catch((error: unknown) => {
        settle(error instanceof Error ? error : new Error(String(error)));
      });
    }, 20_000);
    const settle = (error?: Error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(transactionDeadline);
      if (session.stateChange && onStateChange) {
        session.stateChange.removeListener(onStateChange);
      }
      error ? reject(error) : resolve();
    };
    const onStateChange = (state: any) => {
      if (String(state) === "Terminated") {
        settle(new Error("Session terminated while re-INVITE was pending"));
      }
    };
    session.stateChange?.addListener(onStateChange);
    void sessionAny.invite({
      requestOptions: {
        extraHeaders: []
      },
      sessionDescriptionHandlerModifiers: [modifier],
      requestDelegate: {
        onAccept: () => settle(),
        onReject: (response: any) => {
          const statusCode = response?.message?.statusCode;
          settle(new Error(`re-INVITE rejected${statusCode ? ` (${statusCode})` : ""}`));
        },
        onRedirect: (response: any) => {
          const statusCode = response?.message?.statusCode;
          settle(new Error(`re-INVITE redirected${statusCode ? ` (${statusCode})` : ""}`));
        },
      },
    }).catch((error: unknown) => {
      settle(error instanceof Error ? error : new Error(String(error)));
    });
  });
}

export async function restartSessionMedia(session: Session): Promise<void> {
  if (!session) throw new Error("No session");
  const sessionAny = session as any;
  return enqueueSipOperation(session, "media-recovery", async () => {
    if (sessionAny.__isHeld || sessionAny.__desiredHeld) {
      throw new Error("Cannot recover media while the call is on hold");
    }
    const peerConnection = sessionAny.sessionDescriptionHandler?.peerConnection as RTCPeerConnection | undefined;
    if (!peerConnection) throw new Error("Session has no peer connection");
    if (typeof peerConnection.restartIce !== "function") throw new Error("ICE restart is not supported");

    sessionAny.__mediaRecoveryInProgress = true;
    try {
      peerConnection.getSenders().forEach((sender) => {
        if (sender.track?.kind === "audio") sender.track.enabled = true;
      });
      sessionAny.__mediaRecoveryIceStarted = true;
      peerConnection.restartIce();
      // Do not race this transaction with a local timeout. A timed-out Promise
      // would leave the SIP re-INVITE running and could overlap a subsequent BYE.
      await sendReinviteWithModifier(session, unchangedSdpModifier);
    } finally {
      sessionAny.__mediaRecoveryInProgress = false;
    }
  });
}

export async function hold(session: Session): Promise<void> {
  const sessionAny = session as any;
  const intentVersion = Number(sessionAny.__holdIntentVersion || 0) + 1;
  sessionAny.__holdIntentVersion = intentVersion;
  sessionAny.__holdEpisode = Number(sessionAny.__holdEpisode || 0) + 1;
  sessionAny.__holdRecoveryNeeded = false;
  sessionAny.__desiredHeld = true;
  return enqueueSipOperation(session, "hold", async () => {
    if (sessionAny.__isHeld) return;
    const wasHeld = !!sessionAny.__isHeld;
    setLocalMicEnabled(session, false);
    try {
      await sendReinviteWithModifier(session, sdpHoldModifier);
      sessionAny.__isHeld = true;
      console.log("[SIP Hold] Call placed on hold via re-INVITE with sendonly SDP");
    } catch (error) {
      setLocalMicEnabled(session, !wasHeld);
      if (sessionAny.__holdIntentVersion === intentVersion) {
        sessionAny.__desiredHeld = wasHeld;
      }
      console.error("[SIP Hold] Failed to place call on hold:", error);
      throw error;
    }
  });
}

export async function unhold(session: Session, reason: "manual" | "recovery" = "manual"): Promise<void> {
  const sessionAny = session as any;
  const intentVersion = Number(sessionAny.__holdIntentVersion || 0) + 1;
  sessionAny.__holdIntentVersion = intentVersion;
  if (reason === "manual") {
    sessionAny.__holdRecoveryNeeded = false;
    sessionAny.__holdRecoveryEpisode = null;
  }
  sessionAny.__desiredHeld = false;
  return enqueueSipOperation(session, "unhold", async () => {
    if (!sessionAny.__isHeld) {
      setLocalMicEnabled(session, true);
      return;
    }
    const wasHeld = !!sessionAny.__isHeld;
    try {
      await sendReinviteWithModifier(session, sdpUnholdModifier);
      setLocalMicEnabled(session, true);
      sessionAny.__isHeld = false;
      console.log("[SIP Hold] Call resumed via re-INVITE with sendrecv SDP");
    } catch (error) {
      if (wasHeld) setLocalMicEnabled(session, false);
      if (sessionAny.__holdIntentVersion === intentVersion) {
        sessionAny.__desiredHeld = wasHeld;
      }
      console.error("[SIP Hold] Failed to resume call:", error);
      throw error;
    }
  });
}

export async function holdToggle(session: Session): Promise<boolean> {
  if (!session) {
    throw new Error("No active session");
  }
  
  const held = (session as any).__desiredHeld ?? !!(session as any).__isHeld;
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

export function isHoldTransitioning(session: Session): boolean {
  const sessionAny = session as any;
  return sessionAny.__activeSipOperation === "hold"
    || sessionAny.__activeSipOperation === "unhold"
    || (!!sessionAny.__desiredHeld !== !!sessionAny.__isHeld);
}

export function endSessionAfterSipOperations(session: Session): Promise<void> {
  const sessionAny = session as any;
  sessionAny.__terminationRequested = true;
  sessionAny.__desiredHeld = false;
  return enqueueSipOperation(session, "terminate", async () => {
    if (String(session.state) === "Terminated") return;
    if (String(session.state) === "Established") {
      await Promise.resolve(session.bye());
      return;
    }
    await Promise.resolve(sessionAny.cancel?.());
  });
}

export async function forceEndSessionNow(session: Session): Promise<void> {
  const sessionAny = session as any;
  sessionAny.__terminationRequested = true;
  sessionAny.__desiredHeld = false;
  if (String(session.state) === "Terminated") return;
  if (String(session.state) === "Established") {
    await Promise.resolve(session.bye());
    return;
  }
  await Promise.resolve(sessionAny.cancel?.());
}

export function endSessionBounded(session: Session, timeoutMs = 1500): Promise<void> {
  const queuedEnd = endSessionAfterSipOperations(session);
  const emergencyEnd = new Promise<void>((resolve, reject) => {
    window.setTimeout(() => {
      forceEndSessionNow(session).then(resolve, reject);
    }, timeoutMs);
  });
  return Promise.race([queuedEnd, emergencyEnd]);
}
