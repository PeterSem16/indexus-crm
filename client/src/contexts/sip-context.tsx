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

export function SipProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [isRegistered, setIsRegistered] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [pendingCall, setPendingCall] = useState<PendingCall | null>(null);
  
  const userAgentRef = useRef<any>(null);
  const registererRef = useRef<any>(null);

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

  const register = useCallback(async () => {
    if (!canRegister()) {
      return;
    }

    if (isRegistered || isRegistering) {
      return;
    }

    setIsRegistering(true);
    setRegistrationError(null);

    try {
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
        server: `${wsProtocol}://${serverHost}:${serverPort}${wsPath}`
      };

      const userAgentOptions = {
        authorizationPassword: sipPassword,
        authorizationUsername: sipExtension,
        displayName: sipDisplayName,
        transportOptions,
        uri
      };

      const userAgent = new UserAgent(userAgentOptions);
      await userAgent.start();
      userAgentRef.current = userAgent;

      const registerer = new Registerer(userAgent);
      registererRef.current = registerer;

      registerer.stateChange.addListener((newState: any) => {
        if (newState === RegistererState.Registered) {
          setIsRegistered(true);
          setIsRegistering(false);
        } else if (newState === RegistererState.Unregistered) {
          setIsRegistered(false);
        } else if (newState === RegistererState.Terminated) {
          setIsRegistered(false);
          setIsRegistering(false);
        }
      });

      await registerer.register();
      
    } catch (error: any) {
      console.error("SIP registration failed:", error);
      setRegistrationError(error.message || "Registration failed");
      setIsRegistered(false);
      setIsRegistering(false);
    }
  }, [canRegister, sipSettings, user, isRegistered, isRegistering]);

  const unregister = useCallback(async () => {
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
      console.error("SIP unregister error:", error);
    }
    setIsRegistered(false);
    setIsRegistering(false);
  }, []);

  useEffect(() => {
    if (user && canRegister() && !isRegistered && !isRegistering) {
      register();
    }
  }, [user, sipSettings, canRegister, register, isRegistered, isRegistering]);

  useEffect(() => {
    if (!user) {
      unregister();
    }
  }, [user, unregister]);

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
