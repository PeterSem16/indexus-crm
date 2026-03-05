import { create } from 'zustand';
import { mobileSipEngine, SipRegistrationState, SipCallState, SipCallInfo } from '@/lib/sip';

interface SipStoreState {
  registrationState: SipRegistrationState;
  callState: SipCallState;
  callInfo: SipCallInfo;
  isConnecting: boolean;
  error: string | null;

  connect: () => Promise<boolean>;
  disconnect: () => Promise<void>;
  makeCall: (phoneNumber: string) => Promise<boolean>;
  answerCall: () => Promise<boolean>;
  rejectCall: () => Promise<void>;
  hangup: () => void;
  toggleMute: () => void;
  toggleHold: () => Promise<void>;
  sendDtmf: (tone: string) => void;
  clearError: () => void;
}

export const useSipStore = create<SipStoreState>((set, get) => {
  mobileSipEngine.setEventCallback((event, data) => {
    switch (event) {
      case 'registrationStateChanged':
        set({ registrationState: data as SipRegistrationState });
        break;
      case 'callStateChanged':
        set({ callState: data.state, callInfo: data.callInfo });
        break;
      case 'callInfoChanged':
        set({ callInfo: { ...data } });
        break;
      case 'callEnded':
        set({
          callState: 'idle',
          callInfo: {
            phoneNumber: '',
            direction: 'outbound',
            startTime: null,
            duration: 0,
            isMuted: false,
            isOnHold: false,
            isSpeaker: false,
          },
        });
        break;
    }
  });

  return {
    registrationState: 'unregistered',
    callState: 'idle',
    callInfo: {
      phoneNumber: '',
      direction: 'outbound',
      startTime: null,
      duration: 0,
      isMuted: false,
      isOnHold: false,
      isSpeaker: false,
    },
    isConnecting: false,
    error: null,

    connect: async () => {
      set({ isConnecting: true, error: null });
      const success = await mobileSipEngine.connect();
      set({ isConnecting: false });
      if (!success) {
        set({ error: 'SIP connection failed' });
      }
      return success;
    },

    disconnect: async () => {
      await mobileSipEngine.disconnect();
    },

    makeCall: async (phoneNumber: string) => {
      return mobileSipEngine.makeCall(phoneNumber);
    },

    answerCall: async () => {
      return mobileSipEngine.answerCall();
    },

    rejectCall: async () => {
      await mobileSipEngine.rejectCall();
    },

    hangup: () => {
      mobileSipEngine.hangup();
    },

    toggleMute: () => {
      mobileSipEngine.toggleMute();
    },

    toggleHold: async () => {
      await mobileSipEngine.toggleHold();
    },

    sendDtmf: (tone: string) => {
      mobileSipEngine.sendDtmf(tone);
    },

    clearError: () => set({ error: null }),
  };
});
