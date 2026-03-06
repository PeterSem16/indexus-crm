import { api } from './api';

export interface SipCredentials {
  server: string;
  port: number;
  transport: string;
  extension: string;
  username: string;
  password: string;
  callRecording: boolean;
}

export type SipRegistrationState = 'unregistered' | 'registering' | 'registered' | 'error';
export type SipCallState = 'idle' | 'connecting' | 'ringing' | 'active' | 'on_hold' | 'ended';

export interface SipCallInfo {
  phoneNumber: string;
  direction: 'outbound' | 'inbound';
  startTime: Date | null;
  duration: number;
  isMuted: boolean;
  isOnHold: boolean;
  isSpeaker: boolean;
}

type SipEventCallback = (event: string, data?: any) => void;

class MobileSipEngine {
  private ua: any = null;
  private registerer: any = null;
  private currentSession: any = null;
  private sipModule: any = null;
  private credentials: SipCredentials | null = null;
  private callTimer: ReturnType<typeof setInterval> | null = null;
  private eventCallback: SipEventCallback | null = null;
  private _registrationState: SipRegistrationState = 'unregistered';
  private _callState: SipCallState = 'idle';
  private _callInfo: SipCallInfo = {
    phoneNumber: '',
    direction: 'outbound',
    startTime: null,
    duration: 0,
    isMuted: false,
    isOnHold: false,
    isSpeaker: false,
  };

  get registrationState(): SipRegistrationState { return this._registrationState; }
  get callState(): SipCallState { return this._callState; }
  get callInfo(): SipCallInfo { return { ...this._callInfo }; }
  get isRegistered(): boolean { return this._registrationState === 'registered'; }
  get hasActiveCall(): boolean { return this._callState !== 'idle' && this._callState !== 'ended'; }

  getCredentials(): SipCredentials | null {
    return this.credentials;
  }

  setEventCallback(cb: SipEventCallback) {
    this.eventCallback = cb;
  }

  private emit(event: string, data?: any) {
    this.eventCallback?.(event, data);
  }

  private setRegistrationState(state: SipRegistrationState) {
    this._registrationState = state;
    this.emit('registrationStateChanged', state);
  }

  private setCallState(state: SipCallState) {
    this._callState = state;
    this.emit('callStateChanged', { state, callInfo: this.callInfo });
  }

  private updateCallInfo(updates: Partial<SipCallInfo>) {
    Object.assign(this._callInfo, updates);
    this.emit('callInfoChanged', this.callInfo);
  }

  async fetchCredentials(): Promise<SipCredentials | null> {
    try {
      console.log('[MobileSIP] Fetching credentials from:', api.baseUrl + '/api/mobile/sip/credentials');
      const creds = await api.get<SipCredentials>('/api/mobile/sip/credentials');
      console.log('[MobileSIP] Credentials received:', JSON.stringify({
        server: creds.server,
        port: creds.port,
        extension: creds.extension,
        username: creds.username,
        callRecording: creds.callRecording,
        hasPassword: !!creds.password,
      }));
      this.credentials = creds;
      return creds;
    } catch (error: any) {
      console.error('[MobileSIP] Failed to fetch credentials:', error?.message || error);
      return null;
    }
  }

  async connect(): Promise<boolean> {
    if (!this.credentials) {
      console.log('[MobileSIP] No credentials cached, fetching...');
      const creds = await this.fetchCredentials();
      if (!creds) {
        console.error('[MobileSIP] No credentials available, setting state to error');
        this.setRegistrationState('error');
        return false;
      }
    }

    try {
      this.setRegistrationState('registering');

      this.sipModule = await import('sip.js');
      const { UserAgent, Registerer, RegistererState } = this.sipModule;

      const uri = UserAgent.makeURI(`sip:${this.credentials!.extension}@${this.credentials!.server}`);
      if (!uri) {
        throw new Error('Invalid SIP URI');
      }

      this.ua = new UserAgent({
        uri,
        transportOptions: {
          server: `wss://${this.credentials!.server}:${this.credentials!.port}/ws`,
        },
        authorizationUsername: this.credentials!.username,
        authorizationPassword: this.credentials!.password,
        logLevel: 'warn',
      });

      this.ua.delegate = {
        onInvite: (invitation: any) => {
          this.handleIncomingCall(invitation);
        },
      };

      await this.ua.start();

      this.registerer = new Registerer(this.ua);

      this.registerer.stateChange.addListener((state: any) => {
        switch (state) {
          case RegistererState.Registered:
            this.setRegistrationState('registered');
            break;
          case RegistererState.Unregistered:
            this.setRegistrationState('unregistered');
            break;
          default:
            break;
        }
      });

      await this.registerer.register();
      return true;
    } catch (error) {
      console.error('[MobileSIP] Connection failed:', error);
      this.setRegistrationState('error');
      return false;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.currentSession) {
        this.hangup();
      }
      if (this.registerer) {
        await this.registerer.unregister();
        this.registerer = null;
      }
      if (this.ua) {
        await this.ua.stop();
        this.ua = null;
      }
      this.setRegistrationState('unregistered');
    } catch (error) {
      console.error('[MobileSIP] Disconnect error:', error);
    }
  }

  async makeCall(phoneNumber: string): Promise<boolean> {
    if (!this.ua || !this.isRegistered) {
      console.error('[MobileSIP] Not registered, cannot make call');
      return false;
    }

    try {
      if (!this.sipModule) this.sipModule = await import('sip.js');
      const { Inviter, UserAgent: UA } = this.sipModule;
      const target = UA.makeURI(`sip:${phoneNumber}@${this.credentials!.server}`);
      if (!target) {
        throw new Error('Invalid target URI');
      }

      const inviter = new Inviter(this.ua, target);
      this.currentSession = inviter;

      this.updateCallInfo({
        phoneNumber,
        direction: 'outbound',
        startTime: null,
        duration: 0,
        isMuted: false,
        isOnHold: false,
        isSpeaker: false,
      });

      this.setCallState('connecting');

      this.setupSessionListeners(inviter);

      await inviter.invite();
      return true;
    } catch (error) {
      console.error('[MobileSIP] Failed to make call:', error);
      this.setCallState('idle');
      return false;
    }
  }

  private handleIncomingCall(invitation: any) {
    this.currentSession = invitation;

    const fromUri = invitation.remoteIdentity?.uri?.toString() || 'Unknown';
    const phoneNumber = fromUri.replace('sip:', '').split('@')[0];

    this.updateCallInfo({
      phoneNumber,
      direction: 'inbound',
      startTime: null,
      duration: 0,
      isMuted: false,
      isOnHold: false,
      isSpeaker: false,
    });

    this.setCallState('ringing');
    this.setupSessionListeners(invitation);
    this.emit('incomingCall', { phoneNumber });
  }

  async answerCall(): Promise<boolean> {
    if (!this.currentSession || this._callState !== 'ringing') {
      return false;
    }

    try {
      await this.currentSession.accept();
      return true;
    } catch (error) {
      console.error('[MobileSIP] Failed to answer call:', error);
      return false;
    }
  }

  async rejectCall(): Promise<void> {
    if (!this.currentSession || this._callState !== 'ringing') return;

    try {
      await this.currentSession.reject();
    } catch (error) {
      console.error('[MobileSIP] Failed to reject call:', error);
    }
    this.cleanupSession();
  }

  hangup(): void {
    if (!this.currentSession) return;

    try {
      const state = this.currentSession.state;
      const SessionState = this.sipModule?.SessionState;

      if (state === SessionState.Established) {
        this.currentSession.bye();
      } else if (state === SessionState.Establishing || state === SessionState.Initial) {
        this.currentSession.cancel();
      }
    } catch (error) {
      console.error('[MobileSIP] Hangup error:', error);
    }
    this.cleanupSession();
  }

  toggleMute(): boolean {
    if (!this.currentSession) return false;

    try {
      const sdh = this.currentSession.sessionDescriptionHandler;
      if (!sdh || !sdh.peerConnection) return false;

      const pc = sdh.peerConnection as RTCPeerConnection;
      const newMuted = !this._callInfo.isMuted;

      pc.getSenders().forEach((sender: any) => {
        if (sender?.track?.kind === 'audio') {
          sender.track.enabled = !newMuted;
        }
      });

      this.updateCallInfo({ isMuted: newMuted });
      return newMuted;
    } catch (error) {
      console.error('[MobileSIP] Toggle mute error:', error);
      return this._callInfo.isMuted;
    }
  }

  async toggleHold(): Promise<boolean> {
    if (!this.currentSession) return false;

    try {
      const newHold = !this._callInfo.isOnHold;
      const sessionAny = this.currentSession as any;

      if (typeof sessionAny.invite !== 'function') {
        console.error('[MobileSIP] Session does not support re-INVITE');
        return this._callInfo.isOnHold;
      }

      if (newHold) {
        const sdh = this.currentSession.sessionDescriptionHandler;
        if (sdh?.peerConnection) {
          (sdh.peerConnection as RTCPeerConnection).getSenders().forEach((sender: any) => {
            if (sender?.track?.kind === 'audio') sender.track.enabled = false;
          });
        }

        await sessionAny.invite({
          sessionDescriptionHandlerModifiers: [
            (desc: any) => {
              if (desc?.sdp) {
                desc.sdp = desc.sdp.replace(/a=sendrecv/g, 'a=sendonly');
              }
              return Promise.resolve(desc);
            }
          ]
        });
      } else {
        await sessionAny.invite({
          sessionDescriptionHandlerModifiers: [
            (desc: any) => {
              if (desc?.sdp) {
                desc.sdp = desc.sdp.replace(/a=sendonly|a=inactive|a=recvonly/g, 'a=sendrecv');
              }
              return Promise.resolve(desc);
            }
          ]
        });

        const sdh = this.currentSession.sessionDescriptionHandler;
        if (sdh?.peerConnection) {
          (sdh.peerConnection as RTCPeerConnection).getSenders().forEach((sender: any) => {
            if (sender?.track?.kind === 'audio') sender.track.enabled = true;
          });
        }
      }

      this.updateCallInfo({ isOnHold: newHold });
      this.setCallState(newHold ? 'on_hold' : 'active');
      return newHold;
    } catch (error) {
      console.error('[MobileSIP] Toggle hold error:', error);
      return this._callInfo.isOnHold;
    }
  }

  sendDtmf(tone: string): void {
    if (!this.currentSession) return;

    try {
      const sdh = this.currentSession.sessionDescriptionHandler;
      if (sdh?.peerConnection) {
        const pc = sdh.peerConnection as RTCPeerConnection;
        const sender = pc.getSenders().find((s: any) => s?.track?.kind === 'audio');
        if (sender) {
          (sender as any).dtmf?.insertDTMF(tone, 100, 70);
        }
      }
    } catch (error) {
      console.error('[MobileSIP] DTMF error:', error);
    }
  }

  private setupSessionListeners(session: any) {
    const SessionState = this.sipModule?.SessionState;

    session.stateChange.addListener((state: any) => {
      switch (state) {
        case SessionState.Establishing:
          this.setCallState('connecting');
          break;
        case SessionState.Established:
          this.setCallState('active');
          this.updateCallInfo({ startTime: new Date() });
          this.startCallTimer();
          this.setupRemoteAudio(session);
          break;
        case SessionState.Terminating:
        case SessionState.Terminated:
          this.cleanupSession();
          break;
      }
    });
  }

  private setupRemoteAudio(session: any) {
    try {
      const sdh = session.sessionDescriptionHandler;
      if (!sdh?.peerConnection) return;

      const pc = sdh.peerConnection as RTCPeerConnection;
      pc.getReceivers().forEach((receiver: any) => {
        if (receiver?.track?.kind === 'audio') {
          console.log('[MobileSIP] Remote audio track received');
        }
      });
    } catch (error) {
      console.error('[MobileSIP] Setup remote audio error:', error);
    }
  }

  private startCallTimer() {
    this.stopCallTimer();
    this.callTimer = setInterval(() => {
      if (this._callInfo.startTime) {
        const duration = Math.floor((Date.now() - this._callInfo.startTime.getTime()) / 1000);
        this.updateCallInfo({ duration });
      }
    }, 1000);
  }

  private stopCallTimer() {
    if (this.callTimer) {
      clearInterval(this.callTimer);
      this.callTimer = null;
    }
  }

  private cleanupSession() {
    this.stopCallTimer();
    const finalDuration = this._callInfo.duration;
    const phoneNumber = this._callInfo.phoneNumber;
    const direction = this._callInfo.direction;

    this.emit('callEnded', { phoneNumber, direction, duration: finalDuration });

    this.currentSession = null;
    this.updateCallInfo({
      phoneNumber: '',
      direction: 'outbound',
      startTime: null,
      duration: 0,
      isMuted: false,
      isOnHold: false,
      isSpeaker: false,
    });
    this.setCallState('idle');
  }
}

export const mobileSipEngine = new MobileSipEngine();
