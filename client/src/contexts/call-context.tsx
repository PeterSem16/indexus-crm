import { createContext, useContext, useState, useRef, useCallback, type ReactNode } from "react";

export type CallState = "idle" | "connecting" | "ringing" | "active" | "on_hold" | "ended";

interface CallInfo {
  phoneNumber: string;
  callerName?: string;
  customerId?: string;
  campaignId?: string;
  direction: "inbound" | "outbound";
  callLogId?: number;
}

interface CallContextType {
  callState: CallState;
  callInfo: CallInfo | null;
  callDuration: number;
  isMuted: boolean;
  isOnHold: boolean;
  volume: number;
  micVolume: number;
  setCallState: (state: CallState) => void;
  setCallInfo: (info: CallInfo | null) => void;
  setCallDuration: (duration: number) => void;
  setIsMuted: (muted: boolean) => void;
  setIsOnHold: (hold: boolean) => void;
  setVolume: (vol: number) => void;
  setMicVolume: (vol: number) => void;
  endCallFn: React.MutableRefObject<(() => void) | null>;
  toggleMuteFn: React.MutableRefObject<(() => void) | null>;
  toggleHoldFn: React.MutableRefObject<(() => void) | null>;
  openDialpadFn: React.MutableRefObject<(() => void) | null>;
  onVolumeChangeFn: React.MutableRefObject<((vol: number) => void) | null>;
  onMicVolumeChangeFn: React.MutableRefObject<((vol: number) => void) | null>;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export function CallProvider({ children }: { children: ReactNode }) {
  const [callState, setCallState] = useState<CallState>("idle");
  const [callInfo, setCallInfo] = useState<CallInfo | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);
  const [volume, setVolume] = useState(80);
  const [micVolume, setMicVolume] = useState(100);
  
  const endCallFn = useRef<(() => void) | null>(null);
  const toggleMuteFn = useRef<(() => void) | null>(null);
  const toggleHoldFn = useRef<(() => void) | null>(null);
  const openDialpadFn = useRef<(() => void) | null>(null);
  const onVolumeChangeFn = useRef<((vol: number) => void) | null>(null);
  const onMicVolumeChangeFn = useRef<((vol: number) => void) | null>(null);

  return (
    <CallContext.Provider value={{
      callState,
      callInfo,
      callDuration,
      isMuted,
      isOnHold,
      volume,
      micVolume,
      setCallState,
      setCallInfo,
      setCallDuration,
      setIsMuted,
      setIsOnHold,
      setVolume,
      setMicVolume,
      endCallFn,
      toggleMuteFn,
      toggleHoldFn,
      openDialpadFn,
      onVolumeChangeFn,
      onMicVolumeChangeFn,
    }}>
      {children}
    </CallContext.Provider>
  );
}

export function useCall() {
  const context = useContext(CallContext);
  if (context === undefined) {
    throw new Error("useCall must be used within a CallProvider");
  }
  return context;
}
