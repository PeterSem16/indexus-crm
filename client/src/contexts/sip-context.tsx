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

interface SipContextType {
  isRegistered: boolean;
  isRegistering: boolean;
  registrationError: string | null;
  register: () => Promise<void>;
  unregister: () => Promise<void>;
  userAgentRef: React.MutableRefObject<any>;
  registererRef: React.MutableRefObject<any>;
  pendingCall: PendingCall | null;
  makeCall: (call: PendingCall) => void;
  clearPendingCall: () => void;
}

const SipContext = createContext<SipContextType | undefined>(undefined);

const REGISTER_EXPIRES = 120;
const RE_REGISTER_INTERVAL = 45_000;
const RECONNECT_BASE_DELAY = 2_000;
const RECONNECT_MAX_DELAY = 30_000;
const KEEPALIVE_INTERVAL = 25_000;

export function SipProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [isRegistered, setIsRegistered] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [pendingCall, setPendingCall] = useState<PendingCall | null>(null);

  const userAgentRef = useRef<any>(null);
  const registererRef = useRef<any>(null);
  const reRegisterTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keepaliveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const intentionalDisconnectRef = useRef(false);
  const isConnectingRef = useRef(false);

  const makeCall = useCallback((call: PendingCall) => {
    setPendingCall(call);
  }, []);

  const clearPendingCall = useCallback(() => {
    setPendingCall(null);
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
      } catch (e) {
        // ignore keepalive errors
      }
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
        console.log(`[SIP] Reconnect attempt ${attempt + 1}...`);

        if (userAgentRef.current) {
          const transport = userAgentRef.current.transport;
          if (transport && !transport.isConnected()) {
            await transport.connect();
          }

          if (registererRef.current) {
            await registererRef.current.register();
            reconnectAttemptRef.current = 0;
            console.log("[SIP] Reconnected and re-registered successfully");
          }
        } else {
          reconnectAttemptRef.current = 0;
        }
      } catch (e: any) {
        console.warn(`[SIP] Reconnect attempt ${attempt + 1} failed:`, e.message);
        reconnectAttemptRef.current = attempt + 1;
        scheduleReconnect();
      } finally {
        isConnectingRef.current = false;
      }
    }, delay);
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
      };

      const userAgent = new UserAgent(userAgentOptions);
      userAgentRef.current = userAgent;

      userAgent.transport.onConnect = () => {
        console.log("[SIP] Transport connected");
        reconnectAttemptRef.current = 0;
        startKeepalive();
      };

      userAgent.transport.onDisconnect = (error?: Error) => {
        console.warn("[SIP] Transport disconnected", error?.message || "");
        setIsRegistered(false);
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
          setIsRegistered(true);
          setIsRegistering(false);
          setRegistrationError(null);
          reconnectAttemptRef.current = 0;
        } else if (newState === RegistererState.Unregistered) {
          setIsRegistered(false);
          if (!intentionalDisconnectRef.current) {
            scheduleReconnect();
          }
        } else if (newState === RegistererState.Terminated) {
          setIsRegistered(false);
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
      setIsRegistered(false);
      setIsRegistering(false);
      if (!intentionalDisconnectRef.current) {
        scheduleReconnect();
      }
    } finally {
      isConnectingRef.current = false;
    }
  }, [canRegister, sipSettings, user, clearTimers, startReRegisterTimer, startKeepalive, scheduleReconnect]);

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
    setIsRegistered(false);
    setIsRegistering(false);
  }, [clearTimers]);

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
    <SipContext.Provider value={{ isRegistered, isRegistering, registrationError, register, unregister, userAgentRef, registererRef, pendingCall, makeCall, clearPendingCall }}>
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
