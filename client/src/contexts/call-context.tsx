import { createContext, useContext, useState, useRef, useCallback, type ReactNode } from "react";

export type CallState = "idle" | "connecting" | "ringing" | "active" | "on_hold" | "ended";

interface CallInfo {
  phoneNumber: string;
  callerName?: string;
  customerId?: string;
  campaignId?: string;
  direction: "inbound" | "outbound";
  callLogId?: number;
  leadScore?: number;
  clientStatus?: string;
}

export interface CallTimingMeta {
  ringStartTime: number | null;
  callStartTime: number | null;
  callEndTime: number | null;
  ringDurationSeconds: number | null;
  talkDurationSeconds: number | null;
  hungUpBy: "user" | "customer" | null;
}

interface CallContextType {
  callState: CallState;
  callInfo: CallInfo | null;
  callDuration: number;
  isMuted: boolean;
  isOnHold: boolean;
  volume: number;
  micVolume: number;
  callTiming: CallTimingMeta;
  setCallState: (state: CallState) => void;
  setCallInfo: (info: CallInfo | null) => void;
  setCallDuration: (duration: number) => void;
  setIsMuted: (muted: boolean) => void;
  setIsOnHold: (hold: boolean) => void;
  setVolume: (vol: number) => void;
  setMicVolume: (vol: number) => void;
  setCallTiming: (timing: Partial<CallTimingMeta>) => void;
  resetCallTiming: () => void;
  endCallFn: React.MutableRefObject<(() => void) | null>;
  forceResetCallFn: React.MutableRefObject<(() => void) | null>;
  toggleMuteFn: React.MutableRefObject<(() => void) | null>;
  toggleHoldFn: React.MutableRefObject<(() => void) | null>;
  openDialpadFn: React.MutableRefObject<(() => void) | null>;
  onVolumeChangeFn: React.MutableRefObject<((vol: number) => void) | null>;
  onMicVolumeChangeFn: React.MutableRefObject<((vol: number) => void) | null>;
  sendDtmfFn: React.MutableRefObject<((digit: string) => void) | null>;
}

const defaultTiming: CallTimingMeta = {
  ringStartTime: null,
  callStartTime: null,
  callEndTime: null,
  ringDurationSeconds: null,
  talkDurationSeconds: null,
  hungUpBy: null,
};

const CallContext = createContext<CallContextType | undefined>(undefined);

export function CallProvider({ children }: { children: ReactNode }) {
  const [callState, setCallState] = useState<CallState>("idle");
  const [callInfo, setCallInfo] = useState<CallInfo | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);
  const [volume, setVolume] = useState(80);
  const [micVolume, setMicVolume] = useState(100);
  const [callTiming, setCallTimingState] = useState<CallTimingMeta>({ ...defaultTiming });
  
  const endCallFn = useRef<(() => void) | null>(null);
  const forceResetCallFn = useRef<(() => void) | null>(null);
  const toggleMuteFn = useRef<(() => void) | null>(null);
  const toggleHoldFn = useRef<(() => void) | null>(null);
  const openDialpadFn = useRef<(() => void) | null>(null);
  const onVolumeChangeFn = useRef<((vol: number) => void) | null>(null);
  const onMicVolumeChangeFn = useRef<((vol: number) => void) | null>(null);
  const sendDtmfFn = useRef<((digit: string) => void) | null>(null);

  const setCallTiming = useCallback((partial: Partial<CallTimingMeta>) => {
    setCallTimingState(prev => ({ ...prev, ...partial }));
  }, []);

  const resetCallTiming = useCallback(() => {
    setCallTimingState({ ...defaultTiming });
  }, []);

  return (
    <CallContext.Provider value={{
      callState,
      callInfo,
      callDuration,
      isMuted,
      isOnHold,
      volume,
      micVolume,
      callTiming,
      setCallState,
      setCallInfo,
      setCallDuration,
      setIsMuted,
      setIsOnHold,
      setVolume,
      setMicVolume,
      setCallTiming,
      resetCallTiming,
      endCallFn,
      forceResetCallFn,
      toggleMuteFn,
      toggleHoldFn,
      openDialpadFn,
      onVolumeChangeFn,
      onMicVolumeChangeFn,
      sendDtmfFn,
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
