import { api } from './api';
import { API_BASE_URL } from '@/constants/config';

let webrtcInitialized = false;

async function initWebRTC(): Promise<boolean> {
  if (webrtcInitialized) return true;
  try {
    console.log('[MobileSIP] Initializing WebRTC polyfills...');
    const webrtc = await import('react-native-webrtc');
    console.log('[MobileSIP] react-native-webrtc imported, keys:', Object.keys(webrtc).join(', '));

    if (typeof webrtc.registerGlobals === 'function') {
      webrtc.registerGlobals();
      console.log('[MobileSIP] registerGlobals() called');
    } else {
      (globalThis as any).RTCPeerConnection = webrtc.RTCPeerConnection;
      (globalThis as any).RTCSessionDescription = webrtc.RTCSessionDescription;
      (globalThis as any).RTCIceCandidate = webrtc.RTCIceCandidate;
      (globalThis as any).MediaStream = webrtc.MediaStream;
      (globalThis as any).MediaStreamTrack = webrtc.MediaStreamTrack;
      (globalThis as any).RTCView = webrtc.RTCView;
      (globalThis as any).navigator = (globalThis as any).navigator || {};
      (globalThis as any).navigator.mediaDevices = webrtc.mediaDevices;
    }

    if (!(globalThis as any).MediaStream) {
      (globalThis as any).MediaStream = webrtc.MediaStream;
    }
    if (!(globalThis as any).navigator?.mediaDevices) {
      (globalThis as any).navigator = (globalThis as any).navigator || {};
      (globalThis as any).navigator.mediaDevices = webrtc.mediaDevices;
    }

    webrtcInitialized = true;
    console.log('[MobileSIP] WebRTC polyfills initialized. MediaStream:', typeof (globalThis as any).MediaStream, 'getUserMedia:', typeof (globalThis as any).navigator?.mediaDevices?.getUserMedia);
    return true;
  } catch (error: any) {
    console.error('[MobileSIP] Failed to initialize WebRTC:', error?.message || error);
    return false;
  }
}

export interface SipCredentials {
  server: string;
  port: number;
  wsPort?: number;
  wsPath?: string;
  transport: string;
  realm?: string;
  extension: string;
  username: string;
  password: string;
  callRecording: boolean;
  stunServers?: string[];
  turnServers?: { urls: string; username?: string; credential?: string }[];
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

const KEEPALIVE_INTERVAL = 25000;
const RECONNECT_DELAY = 3000;
const MAX_RECONNECT_ATTEMPTS = 10;

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
  private _iceServers: any[] = [];
  private get _hasTurn(): boolean {
    return this._iceServers.some(s => {
      const urls = Array.isArray(s.urls) ? s.urls : [s.urls];
      return urls.some((u: string) => u && u.startsWith('turn'));
    });
  }
  private _callInfo: SipCallInfo = {
    phoneNumber: '',
    direction: 'outbound',
    startTime: null,
    duration: 0,
    isMuted: false,
    isOnHold: false,
    isSpeaker: false,
  };

  private keepaliveTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts: number = 0;
  private intentionalDisconnect: boolean = false;
  private isRingbackPlaying: boolean = false;
  private inCallManagerRef: any = null;
  private speakerApplyTimer: ReturnType<typeof setTimeout> | null = null;
  private audioEnforceInterval: ReturnType<typeof setInterval> | null = null;
  private audioSessionStarted: boolean = false;
  // ICE diagnostics — per-call, reset on each new call
  private _iceCandidateTypes: string[] = [];
  private _iceHandlersSet: boolean = false;

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

    if (state === 'connecting' && this._callInfo.direction === 'outbound') {
      this.startRingback();
    } else if (state === 'active' || state === 'idle' || state === 'ended') {
      this.stopRingback();
    }
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
    console.log('[MobileSIP] connect() called');
    this.intentionalDisconnect = false;
    this.reconnectAttempts = 0;

    const webrtcReady = await initWebRTC();
    if (!webrtcReady) {
      console.error('[MobileSIP] WebRTC initialization failed, cannot connect');
      this.setRegistrationState('error');
      return false;
    }

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

      console.log('[MobileSIP] Importing sip.js module...');
      this.sipModule = await import('sip.js');
      const { UserAgent, Registerer, RegistererState } = this.sipModule;
      console.log('[MobileSIP] sip.js imported successfully');

      const sipDomain = this.credentials!.realm || this.credentials!.server;
      const sipUri = `sip:${this.credentials!.extension}@${sipDomain}`;
      console.log('[MobileSIP] Creating URI:', sipUri);
      const uri = UserAgent.makeURI(sipUri);
      if (!uri) {
        throw new Error('Invalid SIP URI');
      }

      const wsPort = this.credentials!.wsPort || this.credentials!.port || 8089;
      const wsPath = this.credentials!.wsPath || '/ws';
      const wsServer = `wss://${this.credentials!.server}:${wsPort}${wsPath}`;
      console.log('[MobileSIP] Connecting to WebSocket:', wsServer);

      const iceServers: any[] = [];
      if (this.credentials!.stunServers?.length) {
        this.credentials!.stunServers.forEach(s => iceServers.push({ urls: s }));
      } else {
        iceServers.push({ urls: 'stun:stun.l.google.com:19302' });
        iceServers.push({ urls: 'stun:stun1.l.google.com:19302' });
      }
      if (this.credentials!.turnServers?.length) {
        this.credentials!.turnServers.forEach(t => iceServers.push(t));
      }
      this._iceServers = iceServers;
      const allUrls = iceServers.flatMap(s => Array.isArray(s.urls) ? s.urls : [s.urls]);
      const hasTurn = allUrls.some(u => u && u.startsWith('turn'));
      // Log ICE servers WITH credential presence (not the actual password)
      const iceDebug = iceServers.map(s => {
        const urls = Array.isArray(s.urls) ? s.urls.join(',') : s.urls;
        const hasCred = s.username ? `user=${s.username?.substring(0, 8)}... cred=${s.credential ? 'YES' : 'MISSING'}` : 'no-auth(STUN)';
        return `${urls} [${hasCred}]`;
      }).join(' | ');
      this.emit('debug', `ICE servers (${iceServers.length}): ${iceDebug}`);
      this.emit('ice-stats', {
        configuredUrls: allUrls,
        hasTurn,
        gatheringComplete: false,
        candidateCounts: { host: 0, srflx: 0, relay: 0 },
        connectionState: 'new',
        usedRelay: false,
        relayAddr: '',
        error: null,
        lastCallAt: new Date().toLocaleTimeString(),
      });

      // iceTransportPolicy intentionally NOT set to 'relay' — relay-only mode blocks calls
      // when TURN auth fails (error 702) because 0 candidates are gathered.
      // Using 'all' (default): host+srflx+relay gathered; relay preferred when TURN works.
      this.emit('debug', `ICE mode: all (host+srflx+relay), hasTurn=${this._hasTurn}`);
      this.ua = new UserAgent({
        uri,
        transportOptions: {
          server: wsServer,
          keepAliveInterval: 10,
        },
        authorizationUsername: this.credentials!.username,
        authorizationPassword: this.credentials!.password,
        logLevel: 'debug',
        sessionDescriptionHandlerFactoryOptions: {
          iceGatheringTimeout: 8000,
          peerConnectionConfiguration: {
            iceServers,
            bundlePolicy: 'max-bundle',
            rtcpMuxPolicy: 'require',
            iceCandidatePoolSize: 4,
          },
        },
      });

      this.ua.delegate = {
        onInvite: (invitation: any) => {
          this.handleIncomingCall(invitation);
        },
      };

      this.ua.transport.onConnect = () => {
        this.emit('debug', 'Transport: WebSocket CONNECTED');
        this.reconnectAttempts = 0;
      };
      this.ua.transport.onDisconnect = (err: any) => {
        this.emit('debug', `Transport: WebSocket DISCONNECTED ${err?.message || ''}`);
        if (!this.intentionalDisconnect) {
          this.scheduleReconnect();
        }
      };
      this.ua.transport.stateChange.addListener((state: any) => {
        this.emit('debug', `Transport state: ${state}`);
      });

      this.emit('debug', 'Starting UserAgent...');
      await this.ua.start();
      this.emit('debug', `UA started, transport.state=${this.ua.transport.state}`);

      this.registerer = new Registerer(this.ua, {
        expires: 120,
      });

      this.registerer.stateChange.addListener((state: any) => {
        this.emit('debug', `Registerer state: ${state}`);
        switch (state) {
          case RegistererState.Registered:
            this.setRegistrationState('registered');
            this.reconnectAttempts = 0;
            break;
          case RegistererState.Unregistered:
            if (!this.intentionalDisconnect) {
              this.setRegistrationState('unregistered');
              this.scheduleReconnect();
            } else {
              this.setRegistrationState('unregistered');
            }
            break;
          default:
            break;
        }
      });

      this.emit('debug', `Creds: ext=${this.credentials!.extension} user=${this.credentials!.username} srv=${this.credentials!.server} pwd=${this.credentials!.password ? this.credentials!.password.substring(0, 3) + '***' : 'EMPTY'}`);
      this.emit('debug', 'Sending REGISTER...');
      try {
        await this.registerer.register();
        this.emit('debug', 'REGISTER sent OK');
      } catch (regError: any) {
        this.emit('debug', `REGISTER error: ${regError?.message || regError}`);
      }

      this.startKeepalive();
      return true;
    } catch (error: any) {
      console.error('[MobileSIP] Connection failed:', error?.message || error);
      console.error('[MobileSIP] Error stack:', error?.stack);
      this.setRegistrationState('error');
      return false;
    }
  }

  private scheduleReconnect() {
    if (this.intentionalDisconnect || this.hasActiveCall) return;
    if (this.reconnectTimer) return;
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this.emit('debug', `Max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached`);
      this.setRegistrationState('error');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(RECONNECT_DELAY * this.reconnectAttempts, 30000);
    this.emit('debug', `Scheduling reconnect attempt ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${delay}ms`);

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      if (this.intentionalDisconnect) return;

      this.emit('debug', `Reconnect attempt ${this.reconnectAttempts}...`);
      try {
        if (this.ua) {
          try {
            const transportState = this.ua.transport?.state;
            if (transportState === 'Disconnected' || transportState === 'Disconnecting') {
              await this.ua.reconnect();
              this.emit('debug', 'UA reconnected');
            }
            if (this.registerer) {
              await this.registerer.register();
              this.emit('debug', 'Re-REGISTER sent after reconnect');
            }
          } catch (e: any) {
            this.emit('debug', `Reconnect via UA failed: ${e?.message}, doing full connect`);
            await this.fullReconnect();
          }
        } else {
          await this.fullReconnect();
        }
      } catch (err: any) {
        this.emit('debug', `Reconnect failed: ${err?.message}`);
        this.scheduleReconnect();
      }
    }, delay);
  }

  private async fullReconnect() {
    try {
      if (this.registerer) {
        try { await this.registerer.unregister(); } catch (_) {}
        this.registerer = null;
      }
      if (this.ua) {
        try { await this.ua.stop(); } catch (_) {}
        this.ua = null;
      }
    } catch (_) {}
    await this.connect();
  }

  private startKeepalive() {
    this.stopKeepalive();
    this.keepaliveTimer = setInterval(() => {
      if (this.intentionalDisconnect) {
        this.stopKeepalive();
        return;
      }

      if (!this.ua || !this.registerer) {
        this.emit('debug', 'Keepalive: no UA/registerer, triggering reconnect');
        this.scheduleReconnect();
        return;
      }

      const transportState = this.ua.transport?.state;
      if (transportState !== 'Connected') {
        this.emit('debug', `Keepalive: transport=${transportState}, triggering reconnect`);
        this.scheduleReconnect();
        return;
      }

      if (this._registrationState !== 'registered' && this._registrationState !== 'registering') {
        this.emit('debug', 'Keepalive: not registered, sending REGISTER...');
        try {
          this.registerer.register().catch((e: any) => {
            this.emit('debug', `Keepalive re-register error: ${e?.message}`);
          });
        } catch (e: any) {
          this.emit('debug', `Keepalive register call error: ${e?.message}`);
        }
      }
    }, KEEPALIVE_INTERVAL);
  }

  private stopKeepalive() {
    if (this.keepaliveTimer) {
      clearInterval(this.keepaliveTimer);
      this.keepaliveTimer = null;
    }
  }

  async ensureRegistered(): Promise<boolean> {
    if (this.isRegistered && this.ua?.transport?.state === 'Connected') {
      return true;
    }

    this.emit('debug', 'ensureRegistered: not ready, attempting reconnect...');

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    try {
      if (this.ua && this.registerer) {
        const transportState = this.ua.transport?.state;
        if (transportState === 'Connected') {
          await this.registerer.register();
          await new Promise(resolve => setTimeout(resolve, 2000));
          if (this.isRegistered) return true;
        }
      }

      this.reconnectAttempts = 0;
      await this.fullReconnect();
      await new Promise(resolve => setTimeout(resolve, 3000));
      return this.isRegistered;
    } catch (e: any) {
      this.emit('debug', `ensureRegistered failed: ${e?.message}`);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    this.intentionalDisconnect = true;
    this.stopKeepalive();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
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
    this.emit('debug', `makeCall(${phoneNumber}) ua=${!!this.ua} registered=${this.isRegistered} regState=${this._registrationState}`);

    if (!this.isRegistered) {
      this.emit('debug', 'Not registered, calling ensureRegistered...');
      const ready = await this.ensureRegistered();
      if (!ready) {
        this.emit('debug', 'ensureRegistered failed, cannot make call');
        return false;
      }
    }

    if (!this.ua) {
      this.emit('debug', 'Cannot call: no UA');
      return false;
    }

    try {
      await this.startAudioSession(false);

      if (!this.sipModule) this.sipModule = await import('sip.js');
      const { Inviter, UserAgent: UA } = this.sipModule;
      const sipDomain = this.credentials!.realm || this.credentials!.server;
      const targetUri = `sip:${phoneNumber}@${sipDomain}`;
      this.emit('debug', `INVITE target: ${targetUri}`);
      const target = UA.makeURI(targetUri);
      if (!target) {
        throw new Error('Invalid target URI');
      }

      this._iceCandidateTypes = [];
      this._iceHandlersSet = false;

      const inviter = new Inviter(this.ua, target, {
        sessionDescriptionHandlerOptions: {
          constraints: { audio: true, video: false },
          iceGatheringTimeout: 8000,
        },
        sessionDescriptionHandlerFactoryOptions: {
          iceGatheringTimeout: 8000,
          peerConnectionConfiguration: {
            iceServers: this._iceServers.length ? this._iceServers : [{ urls: 'stun:stun.l.google.com:19302' }],
            bundlePolicy: 'max-bundle',
            rtcpMuxPolicy: 'require',
            iceCandidatePoolSize: 0,
          },
        },
      });

      // Hook ICE handlers as early as possible — fires when SDH/peerConnection is created
      // BEFORE ICE starts gathering, so we catch all candidates and connection events
      inviter.delegate = {
        onSessionDescriptionHandler: (sdh: any) => {
          if (sdh?.peerConnection) {
            this.setupIceHandlers(sdh.peerConnection);
          }
        },
      };

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

      this.emit('debug', 'Sending INVITE...');
      await inviter.invite();
      this.emit('debug', 'INVITE sent OK');
      return true;
    } catch (error: any) {
      this.emit('debug', `makeCall error: ${error?.message || error}`);
      this.setCallState('idle');
      return false;
    }
  }

  private handleIncomingCall(invitation: any) {
    this.currentSession = invitation;
    this._iceCandidateTypes = [];
    this._iceHandlersSet = false;

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

    // Hook ICE handlers as early as possible — fires when SDH/peerConnection is created
    invitation.delegate = {
      ...(invitation.delegate || {}),
      onSessionDescriptionHandler: (sdh: any) => {
        if (sdh?.peerConnection) {
          this.setupIceHandlers(sdh.peerConnection);
        }
      },
    };

    this.setCallState('ringing');
    this.setupSessionListeners(invitation);
    this.emit('incomingCall', { phoneNumber });
  }

  async answerCall(): Promise<boolean> {
    if (!this.currentSession || this._callState !== 'ringing') {
      return false;
    }

    // Immediately leave 'ringing' state — on mobile data, audio arrives before
    // SessionState.Established fires, so UI must not show ringing once user answers
    this.setCallState('connecting');

    try {
      await this.startAudioSession(false);
      await this.currentSession.accept({
        sessionDescriptionHandlerOptions: {
          constraints: { audio: true, video: false },
          iceGatheringTimeout: 8000,
        },
        sessionDescriptionHandlerFactoryOptions: {
          iceGatheringTimeout: 8000,
          peerConnectionConfiguration: {
            iceServers: this._iceServers.length ? this._iceServers : [{ urls: 'stun:stun.l.google.com:19302' }],
            bundlePolicy: 'max-bundle',
            rtcpMuxPolicy: 'require',
            iceCandidatePoolSize: 4,
          },
        },
      });
      return true;
    } catch (error) {
      console.error('[MobileSIP] Failed to answer call:', error);
      this.setCallState('idle');
      return false;
    }
  }

  getPeerConnection(): any | null {
    try {
      const sdh = this.currentSession?.sessionDescriptionHandler;
      return sdh?.peerConnection ?? null;
    } catch {
      return null;
    }
  }

  getSipExtension(): string {
    return this.credentials?.extension ?? '';
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
        const pc = sdh.peerConnection as any;
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
          // Only set startTime / timer if not already started by the ICE-connected fast path
          if (!this._callInfo.startTime) {
            this.updateCallInfo({ startTime: new Date() });
          }
          if (!this.callTimer) {
            this.startCallTimer();
          }
          this.setupRemoteAudio(session);
          break;
        case SessionState.Terminating:
        case SessionState.Terminated:
          this.cleanupSession();
          break;
      }
    });
  }

  private async getInCallManager(): Promise<any> {
    if (!this.inCallManagerRef) {
      this.inCallManagerRef = (await import('react-native-incall-manager')).default;
    }
    return this.inCallManagerRef;
  }

  private async startRingback() {
    if (this.isRingbackPlaying) return;
    try {
      const InCallManager = await this.getInCallManager();
      InCallManager.startRingback('_BUNDLE_');
      this.isRingbackPlaying = true;
      this.emit('debug', 'Ringback tone started');
    } catch (e: any) {
      this.emit('debug', `Ringback start error: ${e?.message}`);
    }
  }

  private async stopRingback() {
    if (!this.isRingbackPlaying) return;
    try {
      const InCallManager = await this.getInCallManager();
      InCallManager.stopRingback();
      this.isRingbackPlaying = false;
      this.emit('debug', 'Ringback tone stopped');
    } catch (e: any) {
      this.emit('debug', `Ringback stop error: ${e?.message}`);
    }
  }

  private stopAudioEnforce() {
    if (this.audioEnforceInterval) {
      clearInterval(this.audioEnforceInterval);
      this.audioEnforceInterval = null;
    }
    if (this.speakerApplyTimer) {
      clearTimeout(this.speakerApplyTimer);
      this.speakerApplyTimer = null;
    }
  }

  private async forceAudioRoute(speaker: boolean) {
    const InCallManager = await this.getInCallManager();
    if (speaker) {
      InCallManager.setForceSpeakerphoneOn(true);
      InCallManager.setSpeakerphoneOn(true);
    } else {
      InCallManager.setForceSpeakerphoneOn(false);
      InCallManager.setSpeakerphoneOn(false);
    }
  }

  async toggleSpeaker(): Promise<boolean> {
    try {
      const newSpeaker = !this._callInfo.isSpeaker;

      this.stopAudioEnforce();

      await this.forceAudioRoute(newSpeaker);

      this.speakerApplyTimer = setTimeout(async () => {
        await this.forceAudioRoute(newSpeaker);
        this.emit('debug', `Speaker ${newSpeaker ? 'ON' : 'OFF'} confirmed (2nd apply)`);
      }, 300);

      this.updateCallInfo({ isSpeaker: newSpeaker });
      this.emit('debug', `Speaker toggled: ${newSpeaker ? 'SPEAKER' : 'EARPIECE'}`);
      return newSpeaker;
    } catch (e: any) {
      this.emit('debug', `toggleSpeaker error: ${e?.message}`);
      return this._callInfo.isSpeaker;
    }
  }

  private async startAudioSession(speaker: boolean = false) {
    try {
      const InCallManager = await this.getInCallManager();

      if (!this.audioSessionStarted) {
        // auto:true = InCallManager manages audio focus + proximity on Android/iOS
        InCallManager.start({ media: 'audio', auto: true, ringback: '' });
        this.audioSessionStarted = true;
        this.emit('debug', 'InCallManager.start() called (auto:true)');
      }

      this.updateCallInfo({ isSpeaker: speaker });
    } catch (e: any) {
      this.emit('debug', `InCallManager start error: ${e?.message}`);
    }
  }

  private startEarpieceEnforcement() {
    this.stopAudioEnforce();

    let count = 0;
    const maxAttempts = 10;

    this.audioEnforceInterval = setInterval(async () => {
      count++;
      if (count > maxAttempts || this._callInfo.isSpeaker) {
        this.stopAudioEnforce();
        this.emit('debug', `Earpiece enforcement ended after ${count} attempts (speaker=${this._callInfo.isSpeaker})`);
        return;
      }
      try {
        await this.forceAudioRoute(false);
        this.emit('debug', `Earpiece enforce #${count}`);
      } catch (e: any) {
        this.emit('debug', `Earpiece enforce error: ${e?.message}`);
      }
    }, 500);
  }

  private async stopAudioSession() {
    try {
      this.stopAudioEnforce();
      this.audioSessionStarted = false;

      const InCallManager = await this.getInCallManager();
      InCallManager.setForceSpeakerphoneOn(false);
      InCallManager.setSpeakerphoneOn(false);
      InCallManager.stop();
      this.emit('debug', 'InCallManager stopped — audio reset to NORMAL');
    } catch (e: any) {
      this.emit('debug', `InCallManager stop error: ${e?.message}`);
    }
  }

  // Called from session.delegate.onSessionDescriptionHandler — runs as soon as
  // the peerConnection is created, BEFORE ICE starts gathering. This ensures
  // we catch every candidate event and connection state change.
  private setupIceHandlers(pc: any) {
    if (this._iceHandlersSet) return;
    this._iceHandlersSet = true;
    const _relayCandidates: string[] = [];
    this.emit('debug', `★ setupIceHandlers: ICE state=${pc.iceConnectionState} gathering=${pc.iceGatheringState}`);

    pc.oniceconnectionstatechange = () => {
      const st = pc.iceConnectionState as string;
      this.emit('debug', `ICE connection state changed: ${st}`);
      this.emit('ice-stats', { connectionState: st });
      if (st === 'failed') {
        this.emit('debug', 'ICE FAILED — no relay candidates found, TURN may be blocked');
        this.emit('ice-stats', { error: 'ICE FAILED — TURN pravdepodobne blokovaný mobilným operátorom' });
      }
      if (st === 'connected' || st === 'completed') {
        const hasRelay = this._iceCandidateTypes.includes('relay');
        this.emit('debug', `★ ICE connected via: ${hasRelay ? 'TURN RELAY ✓' : 'direct/STUN (no relay)'} — re-enabling audio tracks`);
        this.emit('ice-stats', { usedRelay: hasRelay, error: null });

        // On mobile data, audio (RTP) flows as soon as ICE connects — but
        // SessionState.Established may fire later due to SIP signaling latency.
        // Force the call active NOW so the UI stops showing "ringing/connecting"
        // and so recording starts immediately when audio is actually flowing.
        if (this._callState === 'connecting') {
          this.emit('debug', `ICE connected while callState=${this._callState} — forcing active state (SIP Established may lag on mobile data)`);
          this.setCallState('active');
          if (!this._callInfo.startTime) {
            this.updateCallInfo({ startTime: new Date() });
          }
          if (!this.callTimer) {
            this.startCallTimer();
          }
          this.setupRemoteAudio(this.currentSession);
        }
        // Re-enable all tracks after ICE connects to handle any timing races
        try {
          const rcv = pc.getReceivers ? pc.getReceivers() : [];
          rcv.forEach((r: any) => { if (r?.track) r.track.enabled = true; });
          const snd = pc.getSenders ? pc.getSenders() : [];
          snd.forEach((s: any) => { if (s?.track) s.track.enabled = true; });
          this.emit('debug', `Audio tracks re-enabled: rx=${rcv.length} tx=${snd.length}`);
        } catch {}
        // Log negotiated codec from remote SDP
        try {
          const sdp: string = pc.remoteDescription?.sdp || '';
          const sdpLines = sdp.split('\r\n');
          const audioSection = sdpLines.filter((l: string) =>
            l.startsWith('m=audio') || l.startsWith('a=rtpmap') || l.startsWith('a=fmtp')
          ).slice(0, 8).join(' | ');
          if (audioSection) this.emit('debug', `SDP audio codecs: ${audioSection}`);
          // Log DTLS setup attribute — tells us who is client/server in handshake
          const setupLine = sdpLines.find((l: string) => l.startsWith('a=setup:'));
          const fpLine = sdpLines.find((l: string) => l.startsWith('a=fingerprint:'));
          this.emit('debug', `DTLS: ${setupLine || 'no a=setup'} | fp=${fpLine ? 'present' : 'MISSING'}`);
        } catch {}
        // Check DTLS transport state via getStats — confirms if SRTP is working
        try {
          if (pc.getStats) {
            pc.getStats().then((stats: any) => {
              let dtlsState = 'unknown';
              let selectedPair = '';
              stats.forEach((report: any) => {
                if (report.type === 'transport') {
                  dtlsState = report.dtlsState || 'n/a';
                  this.emit('debug', `DTLS transport: state=${report.dtlsState} selected=${report.selectedCandidatePairId?.slice(0,8) || '?'}`);
                }
                if (report.type === 'candidate-pair' && report.selected) {
                  selectedPair = `local=${report.localCandidateId?.slice(0,8)} remote=${report.remoteCandidateId?.slice(0,8)} state=${report.state}`;
                }
              });
              if (selectedPair) this.emit('debug', `ICE selected pair: ${selectedPair}`);
              if (dtlsState === 'connected') {
                this.emit('debug', '★ DTLS connected — SRTP should be flowing');
              } else if (dtlsState === 'failed' || dtlsState === 'closed') {
                this.emit('debug', `✗ DTLS ${dtlsState} — SRTP NOT working, no audio despite ICE connected!`);
              }
            }).catch(() => {});
          }
        } catch {}
      }
      if (st === 'disconnected' || st === 'closed') {
        this.emit('ice-stats', { connectionState: st });
      }
    };

    pc.onicegatheringstatechange = () => {
      this.emit('debug', `ICE gathering state changed: ${pc.iceGatheringState}`);
      if (pc.iceGatheringState === 'complete') {
        const counts = this._iceCandidateTypes.reduce(
          (acc: Record<string, number>, t) => { acc[t] = (acc[t] || 0) + 1; return acc; },
          {}
        );
        const relayCount = counts['relay'] || 0;
        const hasTurnRelay = relayCount > 0;
        this.emit('debug', `ICE gathering complete — candidates: ${JSON.stringify(counts)} ${hasTurnRelay ? '✓ TURN relay OK' : '⚠ NO relay — TURN unreachable!'}`);
        this.emit('ice-stats', {
          gatheringComplete: true,
          candidateCounts: {
            host: counts['host'] || 0,
            srflx: counts['srflx'] || 0,
            relay: relayCount,
          },
        });
      }
    };

    pc.onicecandidate = (event: any) => {
      if (event?.candidate) {
        // react-native-webrtc 118: event.candidate.type is undefined — parse from SDP string
        const candStr: string = event.candidate.candidate || '';
        const typeMatch = candStr.match(/ typ (\w+)/);
        const t: string = event.candidate.type || (typeMatch ? typeMatch[1] : 'unknown');
        this._iceCandidateTypes.push(t);
        if (t === 'relay') {
          // Parse relay address from SDP string: "... IP port typ relay raddr RADDR rport RPORT"
          const addrMatch = candStr.match(/(\S+) (\d+) typ relay/);
          const raddrMatch = candStr.match(/raddr (\S+) rport (\d+)/);
          const addr = addrMatch ? `${event.candidate.protocol?.toUpperCase() || '?'} ${addrMatch[1]}:${addrMatch[2]}` : `${event.candidate.address || '?'}:${event.candidate.port || '?'}`;
          const via = raddrMatch ? `${raddrMatch[1]}:${raddrMatch[2]}` : `${event.candidate.relatedAddress || '?'}:${event.candidate.relatedPort || '?'}`;
          _relayCandidates.push(`${addr} via ${via}`);
          this.emit('debug', `✓ RELAY candidate: ${addr} (relayed via ${via})`);
          this.emit('ice-stats', { relayAddr: _relayCandidates[0] });
        } else if (t === 'srflx') {
          const addrMatch = candStr.match(/(\S+) (\d+) typ srflx/);
          const ip = addrMatch?.[1] || event.candidate.address || '?';
          const port = addrMatch?.[2] || event.candidate.port || '?';
          this.emit('debug', `ICE srflx: ${ip}:${port}`);
        }
      } else if (event?.candidate === null) {
        this.emit('debug', 'ICE gathering finished (null candidate)');
      }
    };

    // TURN error handler — 701=unreachable 702=bad credentials 703=timeout 704=protocol error
    pc.onicecandidateerror = (e: any) => {
      const code = e?.errorCode as number;
      const url = (e?.url || '?').replace(/credential=[^&]+/, 'credential=***').replace(/password=[^&]+/, 'password=***');
      const text = e?.errorText || '';
      const meaning =
        code === 701 ? 'SERVER NEDOSTUPNÝ (sieť/firewall blokuje port)' :
        code === 702 ? '⚠ NESPRÁVNÉ CREDENTIALS' :
        code === 703 ? 'TIMEOUT — coturn neodpovedá' :
        code === 704 ? 'CHYBA PROTOKOLU' :
        code >= 400 && code < 700 ? `STUN/TURN ${code}: ${text}` :
        `ICE err ${code}: ${text}`;
      this.emit('debug', `⚠ TURN ERR [${code}] ${meaning} | ${url}`);
      this.emit('ice-stats', { turnError: `[${code}] ${meaning}` });
    };

    pc.ontrack = (event: any) => {
      const t = event?.track;
      this.emit('debug', `ontrack: kind=${t?.kind} readyState=${t?.readyState} enabled=${t?.enabled} id=${t?.id?.slice(0, 8)}`);
      if (t) t.enabled = true;
      const streams: any[] = event?.streams || [];
      this.emit('debug', `ontrack: streams=${streams.length}`);
      // If no stream attached (common with Asterisk — no a=msid in SDP),
      // create one manually and add the track so react-native-webrtc audio engine activates
      if (streams.length === 0 && t && t.kind === 'audio') {
        try {
          const MS = (globalThis as any).MediaStream;
          if (MS) {
            const syntheticStream = new MS([t]);
            this.emit('debug', `ontrack: created synthetic stream id=${syntheticStream.id?.slice(0, 8)} tracks=${syntheticStream.getTracks?.()?.length}`);
          }
        } catch (e: any) {
          this.emit('debug', `ontrack: synthetic stream error: ${e?.message}`);
        }
      }
    };
  }

  private setupRemoteAudio(session: any) {
    try {
      this.startAudioSession(this._callInfo.isSpeaker);

      if (!this._callInfo.isSpeaker) {
        this.startEarpieceEnforcement();
      }

      const sdh = session.sessionDescriptionHandler;
      if (!sdh?.peerConnection) {
        this.emit('debug', 'setupRemoteAudio: no peerConnection');
        return;
      }

      const pc = sdh.peerConnection as any;

      // ICE handlers should already be set up via setupIceHandlers(). Log current state.
      this.emit('debug', `setupRemoteAudio: ICE=${pc.iceConnectionState} gathering=${pc.iceGatheringState}`);
      if (!this._iceHandlersSet) {
        // Fallback: delegate callback did not fire (sip.js version mismatch?)
        this.emit('debug', 'WARNING: ICE handlers were not set early — setting now (may miss events)');
        this.setupIceHandlers(pc);
      }

      // Log Asterisk's SDP answer — specifically its ICE candidates and audio codec
      // This tells us if Asterisk is sending ICE candidates at all and what IP it uses
      try {
        const remoteSdp: string = pc.remoteDescription?.sdp || '';
        if (remoteSdp) {
          const lines = remoteSdp.split('\r\n');
          const iceCands = lines.filter((l: string) => l.startsWith('a=candidate'));
          const cLine = lines.find((l: string) => l.startsWith('c=IN IP4'));
          const mLine = lines.find((l: string) => l.startsWith('m=audio'));
          const ufrag = lines.find((l: string) => l.startsWith('a=ice-ufrag'));
          this.emit('debug', `Asterisk SDP: ${mLine || 'no m=audio'} | ${cLine || 'no c='}`);
          this.emit('debug', `Asterisk ICE: ufrag=${ufrag ? 'YES' : 'NONE'} candidates=${iceCands.length}`);
          if (iceCands.length > 0) {
            iceCands.slice(0, 4).forEach((c: string) => this.emit('debug', `  Ast cand: ${c}`));
          } else {
            this.emit('debug', '⚠ Asterisk sent NO ICE candidates — plain SDP, no ICE support!');
          }
          const codecs = lines.filter((l: string) => l.startsWith('a=rtpmap')).slice(0, 4);
          if (codecs.length) this.emit('debug', `Asterisk codecs: ${codecs.join(' | ')}`);
        }
      } catch {}

      // Periodic ICE state poll — shows if ICE transitions to connected/failed after checking
      let _pollCount = 0;
      const _pollTimer = setInterval(() => {
        _pollCount++;
        const st = pc.iceConnectionState;
        this.emit('debug', `ICE poll #${_pollCount}: state=${st}`);
        if (st === 'connected' || st === 'completed' || st === 'failed' || st === 'closed' || _pollCount >= 15) {
          clearInterval(_pollTimer);
          if (st === 'connected' || st === 'completed') {
            this.emit('debug', '★ ICE CONNECTED (from poll) — audio should flow');
          } else if (st === 'failed') {
            this.emit('debug', '✗ ICE FAILED — no common candidate pair with Asterisk');
          }
        }
      }, 2000);

      // Enable any already-received audio tracks
      const receivers = pc.getReceivers ? pc.getReceivers() : [];
      this.emit('debug', `Remote receivers: ${receivers.length}`);
      receivers.forEach((receiver: any) => {
        if (receiver?.track) {
          this.emit('debug', `Remote track: kind=${receiver.track.kind} enabled=${receiver.track.enabled} readyState=${receiver.track.readyState}`);
          receiver.track.enabled = true;
        }
      });

      const senders = pc.getSenders ? pc.getSenders() : [];
      this.emit('debug', `Local senders: ${senders.length}`);
      senders.forEach((sender: any) => {
        if (sender?.track) {
          this.emit('debug', `Local track: kind=${sender.track.kind} enabled=${sender.track.enabled} readyState=${sender.track.readyState}`);
          sender.track.enabled = true;
        }
      });

      const remoteStreams = pc.getRemoteStreams ? pc.getRemoteStreams() : [];
      this.emit('debug', `Remote streams: ${remoteStreams.length}`);
      remoteStreams.forEach((stream: any) => {
        stream?.getTracks()?.forEach((track: any) => { track.enabled = true; });
      });

    } catch (error: any) {
      this.emit('debug', `setupRemoteAudio error: ${error?.message}`);
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
    this.stopRingback();
    this.stopAudioSession();
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
