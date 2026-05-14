import { create } from 'zustand';
import { mobileSipEngine, SipRegistrationState, SipCallState, SipCallInfo } from '@/lib/sip';
import { mobileAudioRecorder, RecordingState } from '@/lib/audioRecorder';
import { api } from '@/lib/api';

export interface IceStats {
  configuredUrls: string[];
  hasTurn: boolean;
  lastCallAt: string | null;
  gatheringComplete: boolean;
  candidateCounts: { host: number; srflx: number; relay: number };
  connectionState: string;
  usedRelay: boolean;
  relayAddr: string;
  error: string | null;
  /** TURN error from onicecandidateerror — code 702=bad creds, 701=network, 703=timeout */
  turnError: string | null;
}

const defaultIceStats: IceStats = {
  configuredUrls: [],
  hasTurn: false,
  lastCallAt: null,
  gatheringComplete: false,
  candidateCounts: { host: 0, srflx: 0, relay: 0 },
  connectionState: 'new',
  usedRelay: false,
  relayAddr: '',
  error: null,
  turnError: null,
};

interface SipStoreState {
  registrationState: SipRegistrationState;
  callState: SipCallState;
  callInfo: SipCallInfo;
  isConnecting: boolean;
  error: string | null;
  recordingState: RecordingState;
  callRecordingEnabled: boolean;
  debugMessages: string[];
  iceStats: IceStats;

  connect: () => Promise<boolean>;
  disconnect: () => Promise<void>;
  makeCall: (phoneNumber: string) => Promise<boolean>;
  answerCall: () => Promise<boolean>;
  rejectCall: () => Promise<void>;
  hangup: () => void;
  toggleMute: () => void;
  toggleHold: () => Promise<void>;
  toggleSpeaker: () => Promise<void>;
  sendDtmf: (tone: string) => void;
  clearError: () => void;
  clearDebugMessages: () => void;
  forceReconnect: () => Promise<boolean>;
  startRecording: (callLogId?: string) => Promise<void>;
  stopAndUploadRecording: (params: {
    callLogId: string;
    phoneNumber: string;
    direction: string;
    durationSeconds: number;
    collaboratorName: string;
    customerName?: string;
    customerId?: string;
  }) => Promise<any>;
}

export const useSipStore = create<SipStoreState>((set, get) => {
  mobileAudioRecorder.setOnStateChange((state) => {
    set({ recordingState: state });
  });

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
      case 'debug':
        set(state => ({
          debugMessages: [...state.debugMessages.slice(-499), `${new Date().toLocaleTimeString()}: ${data}`],
        }));
        break;
      case 'ice-stats':
        set(state => ({
          iceStats: { ...state.iceStats, ...(data as Partial<IceStats>) },
        }));
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
    recordingState: 'idle',
    callRecordingEnabled: false,
    debugMessages: [],
    iceStats: { ...defaultIceStats },

    connect: async () => {
      set({ isConnecting: true, error: null });
      const success = await mobileSipEngine.connect();
      set({ isConnecting: false });
      if (!success) {
        set({ error: 'SIP connection failed' });
      }
      const creds = mobileSipEngine.getCredentials();
      if (creds) {
        set({ callRecordingEnabled: creds.callRecording });
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

    toggleSpeaker: async () => {
      await mobileSipEngine.toggleSpeaker();
    },

    sendDtmf: (tone: string) => {
      mobileSipEngine.sendDtmf(tone);
    },

    clearError: () => set({ error: null }),

    clearDebugMessages: () => set({ debugMessages: [], iceStats: { ...defaultIceStats } }),

    forceReconnect: async () => {
      await mobileSipEngine.disconnect();
      await new Promise(r => setTimeout(r, 1200));
      const success = await mobileSipEngine.connect();
      if (!success) set({ error: 'SIP re-connect failed' });
      const creds = mobileSipEngine.getCredentials();
      if (creds) set({ callRecordingEnabled: creds.callRecording });
      return success;
    },

    startRecording: async (callLogId?: string) => {
      await mobileAudioRecorder.startRecording();

      if (callLogId) {
        try {
          const result = await api.post<{ success: boolean; message: string }>(
            `/api/mobile/call-log/${callLogId}/trigger-server-recording`,
            {}
          );
          if (result?.success) {
            console.log('[SipStore] Server-side ARI recording started:', result.message);
          } else {
            console.log('[SipStore] Server-side recording not started, mic-only fallback active. Reason:', result?.message);
          }
        } catch (e: any) {
          console.warn('[SipStore] Server recording trigger failed (mic-only fallback):', e?.message);
        }
      }
    },

    stopAndUploadRecording: async (params) => {
      await mobileAudioRecorder.stopRecording();
      return mobileAudioRecorder.uploadRecording(params);
    },
  };
});
