import { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./auth-context";

interface SipSettingsData {
  server?: string;
  port?: number;
  wsPath?: string;
  realm?: string;
  transport?: string;
  isEnabled?: boolean;
}

export interface PendingCall {
  phoneNumber: string;
  customerId?: string;
  campaignId?: string;
  campaignName?: string;
  customerName?: string;
  leadScore?: number;
  clientStatus?: string;
}

export interface IncomingCall {
  invitation: any;
  callerNumber: string;
  callerName: string;
}

interface SipContextType {
  isRegistered: boolean;
  isRegistering: boolean;
  registrationError: string | null;
  register: () => Promise<void>;
  unregister: () => Promise<void>;
  ensureRegistered: () => Promise<boolean>;
  userAgentRef: React.MutableRefObject<any>;
  registererRef: React.MutableRefObject<any>;
  pendingCall: PendingCall | null;
  makeCall: (call: PendingCall) => void;
  clearPendingCall: () => void;
  incomingCall: IncomingCall | null;
  answeredIncomingSession: any;
  clearAnsweredSession: () => void;
  answerIncomingCall: () => Promise<any>;
  rejectIncomingCall: () => void;
}

const SipContext = createContext<SipContextType | undefined>(undefined);

const REGISTER_EXPIRES = 120;
const RE_REGISTER_INTERVAL = 45_000;
const RECONNECT_BASE_DELAY = 1_000;
const RECONNECT_MAX_DELAY = 30_000;
const KEEPALIVE_INTERVAL = 25_000;
const ENSURE_REGISTERED_TIMEOUT = 8_000;

export function SipProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [isRegistered, setIsRegistered] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [pendingCall, setPendingCall] = useState<PendingCall | null>(null);
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [answeredIncomingSession, setAnsweredIncomingSession] = useState<any>(null);

  const incomingCallRef = useRef<IncomingCall | null>(null);
  const userAgentRef = useRef<any>(null);
  const registererRef = useRef<any>(null);
  const reRegisterTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keepaliveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const intentionalDisconnectRef = useRef(false);
  const isConnectingRef = useRef(false);
  const registeredCallbacksRef = useRef<Array<() => void>>([]);
  const isRegisteredRef = useRef(false);

  const makeCall = useCallback((call: PendingCall) => {
    setPendingCall(call);
  }, []);

  const clearPendingCall = useCallback(() => {
    setPendingCall(null);
  }, []);

  const clearAnsweredSession = useCallback(() => {
    setAnsweredIncomingSession(null);
  }, []);

  useEffect(() => {
    incomingCallRef.current = incomingCall;
  }, [incomingCall]);

  const answerIncomingCall = useCallback(async () => {
    const currentIncoming = incomingCallRef.current;
    if (!currentIncoming?.invitation) {
      console.warn("[SIP] answerIncomingCall called but no invitation available (ref check)");
      return null;
    }
    try {
      console.log("[SIP] Answering incoming call...");
      const callerNumber = currentIncoming.callerNumber;
      const callerName = currentIncoming.callerName;
      const invitation = currentIncoming.invitation;
      await invitation.accept({
        sessionDescriptionHandlerOptions: {
          constraints: { audio: true, video: false }
        }
      });
      invitation._inboundCallerNumber = callerNumber;
      invitation._inboundCallerName = callerName;
      incomingCallRef.current = null;
      setIncomingCall(null);
      setAnsweredIncomingSession(invitation);
      return invitation;
    } catch (e: any) {
      console.error("[SIP] Failed to answer incoming call:", e);
      incomingCallRef.current = null;
      setIncomingCall(null);
      return null;
    }
  }, []);

  const rejectIncomingCall = useCallback(() => {
    const currentIncoming = incomingCallRef.current;
    if (!currentIncoming?.invitation) return;
    try {
      console.log("[SIP] Rejecting incoming call...");
      currentIncoming.invitation.reject();
    } catch (e: any) {
      console.error("[SIP] Failed to reject incoming call:", e);
    }
    incomingCallRef.current = null;
    setIncomingCall(null);
  }, []);

  const { data: sipSettings } = useQuery<SipSettingsData | null>({
    queryKey: ["/api/sip-settings"],
    retry: false,
  });

  const canRegister = useCallback(() => {
    return !!(
      sipSettings?.isEnabled &&
      sipSettings?.server &&
      (user as any)?.sipEnabled &&
      (user as any)?.sipExtension &&
      (user as any)?.sipPassword
    );
  }, [sipSettings, user]);

  const clearTimers = useCallback(() => {
    if (reRegisterTimerRef.current) {
      clearInterval(reRegisterTimerRef.current);
      reRegisterTimerRef.current = null;
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (keepaliveTimerRef.current) {
      clearInterval(keepaliveTimerRef.current);
      keepaliveTimerRef.current = null;
    }
  }, []);

  const notifyRegistered = useCallback(() => {
    const cbs = registeredCallbacksRef.current.splice(0);
    for (const cb of cbs) {
      try { cb(); } catch (_) {}
    }
  }, []);

  const setRegisteredState = useCallback((val: boolean) => {
    isRegisteredRef.current = val;
    setIsRegistered(val);
    if (val) {
      notifyRegistered();
    }
  }, [notifyRegistered]);

  const startKeepalive = useCallback(() => {
    if (keepaliveTimerRef.current) {
      clearInterval(keepaliveTimerRef.current);
    }
    keepaliveTimerRef.current = setInterval(() => {
      try {
        const transport = userAgentRef.current?.transport;
        if (transport && (transport as any)._ws?.readyState === WebSocket.OPEN) {
          (transport as any)._ws.send("\r\n\r\n");
        }
      } catch (e) {}
    }, KEEPALIVE_INTERVAL);
  }, []);

  const startReRegisterTimer = useCallback(() => {
    if (reRegisterTimerRef.current) {
      clearInterval(reRegisterTimerRef.current);
    }
    reRegisterTimerRef.current = setInterval(async () => {
      try {
        if (registererRef.current && userAgentRef.current) {
          const transport = userAgentRef.current.transport;
          if (transport && transport.isConnected()) {
            console.log("[SIP] Periodic re-registration...");
            await registererRef.current.register();
          }
        }
      } catch (e) {
        console.warn("[SIP] Re-registration failed:", e);
      }
    }, RE_REGISTER_INTERVAL);
  }, []);

  const doReconnectNow = useCallback(async (): Promise<boolean> => {
    if (!userAgentRef.current || !registererRef.current) return false;
    try {
      const transport = userAgentRef.current.transport;
      if (transport && !transport.isConnected()) {
        console.log("[SIP] Immediate reconnect: connecting transport...");
        await transport.connect();
      }
      console.log("[SIP] Immediate reconnect: sending REGISTER...");
      await registererRef.current.register();
      reconnectAttemptRef.current = 0;
      return true;
    } catch (e: any) {
      console.warn("[SIP] Immediate reconnect failed:", e.message);
      return false;
    }
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (intentionalDisconnectRef.current || isConnectingRef.current) return;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
    }

    const attempt = reconnectAttemptRef.current;
    const delay = Math.min(RECONNECT_BASE_DELAY * Math.pow(1.5, attempt), RECONNECT_MAX_DELAY);
    console.log(`[SIP] Scheduling reconnect attempt ${attempt + 1} in ${delay}ms`);

    reconnectTimerRef.current = setTimeout(async () => {
      reconnectTimerRef.current = null;
      if (intentionalDisconnectRef.current) return;

      try {
        isConnectingRef.current = true;
        const ok = await doReconnectNow();
        if (!ok) {
          reconnectAttemptRef.current = attempt + 1;
          scheduleReconnect();
        }
      } finally {
        isConnectingRef.current = false;
      }
    }, delay);
  }, [doReconnectNow]);

  const handleIncomingInvite = useCallback((invitation: any) => {
    const remoteIdentity = invitation.remoteIdentity;
    const callerNumber = remoteIdentity?.uri?.user || "Unknown";
    const callerName = remoteIdentity?.displayName || callerNumber;
    console.log(`[SIP] Incoming call from ${callerName} <${callerNumber}>`);

    setIncomingCall({
      invitation,
      callerNumber,
      callerName,
    });

    const { SessionState } = require("sip.js");
    invitation.stateChange.addListener((state: any) => {
      if (state === SessionState.Terminated) {
        console.log("[SIP] Incoming call terminated/cancelled");
        setIncomingCall((prev) => {
          if (prev?.invitation === invitation) return null;
          return prev;
        });
      }
    });
  }, []);

  const register = useCallback(async () => {
    if (!canRegister()) return;
    if (isConnectingRef.current) return;

    isConnectingRef.current = true;
    intentionalDisconnectRef.current = false;
    setIsRegistering(true);
    setRegistrationError(null);

    try {
      if (registererRef.current) {
        try { await registererRef.current.unregister(); } catch (_) {}
        registererRef.current = null;
      }
      if (userAgentRef.current) {
        try { await userAgentRef.current.stop(); } catch (_) {}
        userAgentRef.current = null;
      }
      clearTimers();

      const { UserAgent, Registerer, RegistererState } = await import("sip.js");

      const serverHost = sipSettings!.server;
      const serverPort = sipSettings!.port || 443;
      const wsPath = sipSettings!.wsPath || "/ws";
      const realm = sipSettings!.realm || sipSettings!.server;
      const sipExtension = (user as any).sipExtension;
      const sipPassword = (user as any).sipPassword;
      const sipDisplayName = (user as any).sipDisplayName || sipExtension;

      const uri = UserAgent.makeURI(`sip:${sipExtension}@${realm}`);
      if (!uri) {
        throw new Error("Invalid SIP URI");
      }

      const wsProtocol = sipSettings!.transport === "ws" ? "ws" : "wss";
      const transportOptions = {
        server: `${wsProtocol}://${serverHost}:${serverPort}${wsPath}`,
        keepAliveInterval: 30,
        connectionTimeout: 10,
        traceSip: false,
      };

      const userAgentOptions = {
        authorizationPassword: sipPassword,
        authorizationUsername: sipExtension,
        displayName: sipDisplayName,
        transportOptions,
        uri,
        reconnectionAttempts: 0,
        reconnectionDelay: 1,
        noResponseTimeout: 60,
        gracefulShutdown: false,
        sendInitialProvisionalResponse: true,
      };

      const userAgent = new UserAgent(userAgentOptions);
      userAgentRef.current = userAgent;

      userAgent.delegate = {
        onInvite: (invitation: any) => {
          try {
            console.log("[SIP] >>> onInvite delegate triggered!");
            let callerNumber = "Unknown";
            let callerName = "Unknown";
            try {
              const fromHeader = invitation.request?.from;
              if (fromHeader) {
                callerNumber = fromHeader.uri?.user || "Unknown";
                callerName = fromHeader.friendlyName || fromHeader.displayName || callerNumber;
              } else {
                const remoteId = invitation.remoteIdentity;
                callerNumber = remoteId?.uri?.user || "Unknown";
                callerName = remoteId?.displayName || callerNumber;
              }
            } catch (parseErr) {
              console.warn("[SIP] Error parsing caller identity:", parseErr);
            }
            console.log(`[SIP] Incoming call from ${callerName} <${callerNumber}>`);

            setIncomingCall({
              invitation,
              callerNumber,
              callerName,
            });

            invitation.stateChange.addListener((state: any) => {
              console.log("[SIP] Incoming invitation state changed:", state);
              if (state === "Terminated") {
                console.log("[SIP] Incoming call terminated/cancelled");
                setIncomingCall((prev: IncomingCall | null) => {
                  if (prev?.invitation === invitation) return null;
                  return prev;
                });
              }
            });
          } catch (err) {
            console.error("[SIP] CRITICAL: Error in onInvite handler:", err);
          }
        },
      };

      userAgent.transport.onConnect = () => {
        console.log("[SIP] Transport connected");
        reconnectAttemptRef.current = 0;
        startKeepalive();
      };

      userAgent.transport.onDisconnect = (error?: Error) => {
        console.warn("[SIP] Transport disconnected", error?.message || "");
        setRegisteredState(false);
        if (keepaliveTimerRef.current) {
          clearInterval(keepaliveTimerRef.current);
          keepaliveTimerRef.current = null;
        }
        if (!intentionalDisconnectRef.current) {
          scheduleReconnect();
        }
      };

      await userAgent.start();
      console.log("[SIP] UserAgent started");

      const registerer = new Registerer(userAgent, {
        expires: REGISTER_EXPIRES,
        refreshFrequency: 90,
        regId: 1,
        extraHeaders: [
          "X-CRM-Client: indexus",
        ],
      });
      registererRef.current = registerer;

      registerer.stateChange.addListener((newState: any) => {
        console.log("[SIP] Registerer state:", newState);
        if (newState === RegistererState.Registered) {
          setRegisteredState(true);
          setIsRegistering(false);
          setRegistrationError(null);
          reconnectAttemptRef.current = 0;
        } else if (newState === RegistererState.Unregistered) {
          setRegisteredState(false);
          if (!intentionalDisconnectRef.current) {
            scheduleReconnect();
          }
        } else if (newState === RegistererState.Terminated) {
          setRegisteredState(false);
          setIsRegistering(false);
        }
      });

      await registerer.register();
      console.log("[SIP] Initial REGISTER sent");

      startReRegisterTimer();
      startKeepalive();

    } catch (error: any) {
      console.error("[SIP] Registration failed:", error);
      setRegistrationError(error.message || "Registration failed");
      setRegisteredState(false);
      setIsRegistering(false);
      if (!intentionalDisconnectRef.current) {
        scheduleReconnect();
      }
    } finally {
      isConnectingRef.current = false;
    }
  }, [canRegister, sipSettings, user, clearTimers, startReRegisterTimer, startKeepalive, scheduleReconnect, setRegisteredState]);

  const ensureRegistered = useCallback(async (): Promise<boolean> => {
    if (isRegisteredRef.current) {
      const transport = userAgentRef.current?.transport;
      if (transport && transport.isConnected()) {
        console.log("[SIP] ensureRegistered: already registered and connected");
        return true;
      }
    }

    console.log("[SIP] ensureRegistered: not registered, attempting immediate reconnect...");

    if (userAgentRef.current && registererRef.current) {
      const ok = await doReconnectNow();
      if (ok) {
        await new Promise(r => setTimeout(r, 300));
        if (isRegisteredRef.current) return true;
      }
    }

    if (!userAgentRef.current && canRegister()) {
      register();
    }

    return new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => {
        const idx = registeredCallbacksRef.current.indexOf(cb);
        if (idx >= 0) registeredCallbacksRef.current.splice(idx, 1);
        console.warn("[SIP] ensureRegistered: timed out waiting for registration");
        resolve(isRegisteredRef.current);
      }, ENSURE_REGISTERED_TIMEOUT);

      const cb = () => {
        clearTimeout(timeout);
        console.log("[SIP] ensureRegistered: registration confirmed");
        resolve(true);
      };

      registeredCallbacksRef.current.push(cb);
    });
  }, [doReconnectNow, canRegister, register]);

  const unregister = useCallback(async () => {
    intentionalDisconnectRef.current = true;
    clearTimers();

    try {
      if (registererRef.current) {
        await registererRef.current.unregister().catch(() => {});
        registererRef.current = null;
      }
      if (userAgentRef.current) {
        await userAgentRef.current.stop().catch(() => {});
        userAgentRef.current = null;
      }
    } catch (error) {
      console.error("[SIP] Unregister error:", error);
    }
    setRegisteredState(false);
    setIsRegistering(false);
  }, [clearTimers, setRegisteredState]);

  useEffect(() => {
    if (user && canRegister() && !isRegistered && !isRegistering && !isConnectingRef.current) {
      register();
    }
  }, [user, sipSettings]);

  useEffect(() => {
    if (!user) {
      unregister();
    }
  }, [user, unregister]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        console.log("[SIP] Page visible - checking registration...");
        const transport = userAgentRef.current?.transport;
        if (transport && !transport.isConnected() && !intentionalDisconnectRef.current) {
          console.log("[SIP] Transport not connected after page focus, reconnecting...");
          reconnectAttemptRef.current = 0;
          scheduleReconnect();
        } else if (registererRef.current && transport?.isConnected()) {
          registererRef.current.register().catch(() => {});
        }
      }
    };

    const handleOnline = () => {
      console.log("[SIP] Network online - reconnecting...");
      if (!intentionalDisconnectRef.current && userAgentRef.current) {
        reconnectAttemptRef.current = 0;
        scheduleReconnect();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
    };
  }, [scheduleReconnect]);

  useEffect(() => {
    return () => {
      intentionalDisconnectRef.current = true;
      clearTimers();
    };
  }, [clearTimers]);

  return (
    <SipContext.Provider value={{ isRegistered, isRegistering, registrationError, register, unregister, ensureRegistered, userAgentRef, registererRef, pendingCall, makeCall, clearPendingCall, incomingCall, answeredIncomingSession, clearAnsweredSession, answerIncomingCall, rejectIncomingCall }}>
      {children}
    </SipContext.Provider>
  );
}

export function useSip() {
  const context = useContext(SipContext);
  if (context === undefined) {
    throw new Error("useSip must be used within a SipProvider");
  }
  return context;
}
