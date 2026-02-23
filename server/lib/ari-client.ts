import WebSocket from "ws";
import { EventEmitter } from "events";

export interface AriConfig {
  host: string;
  port: number;
  protocol: string;
  username: string;
  password: string;
  appName: string;
  wsProtocol: string;
  wsPort: number;
}

export interface AriChannel {
  id: string;
  name: string;
  state: string;
  caller: { name: string; number: string };
  connected: { name: string; number: string };
  dialplan: { context: string; exten: string; priority: number };
  creationtime: string;
  language: string;
}

export interface AriEvent {
  type: string;
  timestamp: string;
  application: string;
  channel?: AriChannel;
  bridge?: any;
  playback?: any;
  cause?: number;
  cause_txt?: string;
  args?: string[];
  [key: string]: any;
}

export interface AriBridge {
  id: string;
  technology: string;
  bridge_type: string;
  bridge_class: string;
  channels: string[];
}

export class AriClient extends EventEmitter {
  private config: AriConfig;
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;
  private pongTimeout: ReturnType<typeof setTimeout> | null = null;
  private isConnecting = false;
  private _isConnected = false;
  private lastPongTime = 0;
  private reconnectAttempts = 0;
  private intentionalDisconnect = false;

  private static readonly PING_INTERVAL_MS = 30000;
  private static readonly PONG_TIMEOUT_MS = 10000;
  private static readonly HEALTH_CHECK_INTERVAL_MS = 60000;
  private static readonly BASE_RECONNECT_DELAY_MS = 5000;
  private static readonly MAX_RECONNECT_DELAY_MS = 60000;

  constructor(config: AriConfig) {
    super();
    this.config = config;
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  private get baseUrl(): string {
    return `${this.config.protocol}://${this.config.host}:${this.config.port}`;
  }

  private get wsUrl(): string {
    return `${this.config.wsProtocol}://${this.config.host}:${this.config.wsPort}/ari/events?api_key=${this.config.username}:${this.config.password}&app=${this.config.appName}`;
  }

  private get authHeader(): string {
    return `Basic ${Buffer.from(`${this.config.username}:${this.config.password}`).toString("base64")}`;
  }

  async connect(): Promise<void> {
    if (this.isConnecting || this._isConnected) return;
    this.isConnecting = true;
    this.intentionalDisconnect = false;
    this.isDisconnecting = false;

    try {
      await this.testConnection();

      this.ws = new WebSocket(this.wsUrl);

      this.ws.on("open", () => {
        console.log("[ARI] WebSocket connected to Asterisk");
        this._isConnected = true;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.lastPongTime = Date.now();
        this.startPingInterval();
        this.startHealthCheck();
        this.emit("connected");
      });

      this.ws.on("message", (data: WebSocket.Data) => {
        this.lastPongTime = Date.now();
        try {
          const event: AriEvent = JSON.parse(data.toString());
          this.handleEvent(event);
        } catch (err) {
          console.error("[ARI] Failed to parse event:", err);
        }
      });

      this.ws.on("pong", () => {
        this.lastPongTime = Date.now();
        if (this.pongTimeout) {
          clearTimeout(this.pongTimeout);
          this.pongTimeout = null;
        }
      });

      this.ws.on("close", () => {
        console.log("[ARI] WebSocket disconnected");
        this.handleDisconnect();
      });

      this.ws.on("error", (err) => {
        console.error("[ARI] WebSocket error:", err.message);
        if (this.ws) {
          try { this.ws.terminate(); } catch (_) {}
          this.ws = null;
        }
        this.handleDisconnect();
      });
    } catch (err: any) {
      console.error("[ARI] Connection failed:", err.message);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  private isDisconnecting = false;

  private handleDisconnect(): void {
    if (this.isDisconnecting) return;
    this.isDisconnecting = true;
    this._isConnected = false;
    this.isConnecting = false;
    this.stopPingInterval();
    this.stopHealthCheck();
    this.emit("disconnected");
    if (!this.intentionalDisconnect) {
      this.scheduleReconnect();
    }
    setTimeout(() => { this.isDisconnecting = false; }, 100);
  }

  private startPingInterval(): void {
    this.stopPingInterval();
    this.pingInterval = setInterval(() => {
      if (this.ws && this._isConnected && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.ping();
          this.pongTimeout = setTimeout(() => {
            const timeSinceActivity = Date.now() - this.lastPongTime;
            if (timeSinceActivity > AriClient.PING_INTERVAL_MS + AriClient.PONG_TIMEOUT_MS) {
              console.warn(`[ARI] No activity for ${Math.round(timeSinceActivity / 1000)}s and no pong. Forcing reconnect...`);
              this.forceReconnect();
            }
          }, AriClient.PONG_TIMEOUT_MS);
        } catch (err: any) {
          console.error("[ARI] Ping failed:", err.message);
          this.forceReconnect();
        }
      }
    }, AriClient.PING_INTERVAL_MS);
  }

  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.pongTimeout) {
      clearTimeout(this.pongTimeout);
      this.pongTimeout = null;
    }
  }

  private startHealthCheck(): void {
    this.stopHealthCheck();
    this.healthCheckInterval = setInterval(async () => {
      if (!this._isConnected) return;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(`${this.baseUrl}/ari/asterisk/info`, {
          signal: controller.signal,
          headers: { Authorization: this.authHeader },
        });
        clearTimeout(timeout);
        if (!res.ok) {
          console.warn(`[ARI] Health check failed: HTTP ${res.status}`);
          this.forceReconnect();
        }
      } catch (err: any) {
        console.warn(`[ARI] Health check failed: ${err.message}`);
        this.forceReconnect();
      }
    }, AriClient.HEALTH_CHECK_INTERVAL_MS);
  }

  private stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  private forceReconnect(): void {
    console.log("[ARI] Force-reconnecting...");
    this.stopPingInterval();
    this.stopHealthCheck();
    this._isConnected = false;
    this.isConnecting = false;
    if (this.ws) {
      try { this.ws.terminate(); } catch (_) {}
      this.ws = null;
    }
    this.emit("disconnected");
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer || this.intentionalDisconnect) return;
    const delay = Math.min(
      AriClient.BASE_RECONNECT_DELAY_MS * Math.pow(1.5, this.reconnectAttempts),
      AriClient.MAX_RECONNECT_DELAY_MS,
    );
    this.reconnectAttempts++;
    console.log(`[ARI] Scheduling reconnect in ${Math.round(delay / 1000)}s (attempt ${this.reconnectAttempts})...`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      console.log("[ARI] Attempting reconnect...");
      this.connect().catch(() => {});
    }, delay);
  }

  disconnect(): void {
    this.intentionalDisconnect = true;
    this.stopPingInterval();
    this.stopHealthCheck();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this._isConnected = false;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
  }

  private handleEvent(event: AriEvent): void {
    switch (event.type) {
      case "StasisStart":
        this.emit("stasis-start", event);
        break;
      case "StasisEnd":
        this.emit("stasis-end", event);
        break;
      case "ChannelStateChange":
        this.emit("channel-state-change", event);
        break;
      case "ChannelDestroyed":
        this.emit("channel-destroyed", event);
        break;
      case "ChannelHangupRequest":
        this.emit("channel-hangup-request", event);
        break;
      case "ChannelDtmfReceived":
        this.emit("channel-dtmf", event);
        break;
      case "PlaybackFinished":
        this.emit("playback-finished", event);
        break;
      case "BridgeCreated":
        this.emit("bridge-created", event);
        break;
      case "ChannelEnteredBridge":
        this.emit("channel-entered-bridge", event);
        break;
      case "ChannelLeftBridge":
        this.emit("channel-left-bridge", event);
        break;
      default:
        this.emit("event", event);
    }
  }

  async testConnection(): Promise<{ success: boolean; error?: string; message?: string }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const fetchOpts = { signal: controller.signal };

    try {
      console.log(`[ARI] Testing connection to: ${this.baseUrl}`);

      // Step 1: Basic connectivity check via /httpstatus (no auth needed)
      try {
        const httpStatusRes = await fetch(`${this.baseUrl}/httpstatus`, fetchOpts);
        console.log(`[ARI] /httpstatus returned: ${httpStatusRes.status}`);
      } catch (connErr: any) {
        clearTimeout(timeout);
        if (connErr.name === "AbortError") {
          return { success: false, error: `Cannot reach ${this.config.host}:${this.config.port} - connection timed out` };
        }
        return { success: false, error: `Cannot reach ${this.config.host}:${this.config.port} - ${connErr.message}` };
      }

      // Step 2: Try ARI with Basic auth
      try {
        const url = `${this.baseUrl}/ari/asterisk/info`;
        console.log(`[ARI] Testing ARI endpoint: ${url}`);
        const response = await fetch(url, {
          ...fetchOpts,
          headers: { Authorization: this.authHeader },
        });
        console.log(`[ARI] Basic auth response: ${response.status}`);

        if (response.ok) {
          clearTimeout(timeout);
          const info = await response.json();
          return { success: true, message: `Connected to Asterisk ${info?.system?.version || ""}` };
        }

        // If 401, auth is wrong
        if (response.status === 401) {
          clearTimeout(timeout);
          return { success: false, error: "Authentication failed - check username and password in ari.conf" };
        }

        // If 404, try api_key approach
        if (response.status === 404) {
          console.log(`[ARI] Basic auth got 404, trying api_key parameter...`);
        }
      } catch (err: any) {
        console.log(`[ARI] Basic auth failed: ${err.message}`);
      }

      // Step 3: Try ARI with api_key query param (some Asterisk versions prefer this)
      try {
        const apiKeyUrl = `${this.baseUrl}/ari/asterisk/info?api_key=${encodeURIComponent(this.config.username)}:${encodeURIComponent(this.config.password)}`;
        console.log(`[ARI] Trying api_key auth...`);
        const response2 = await fetch(apiKeyUrl, fetchOpts);
        console.log(`[ARI] api_key auth response: ${response2.status}`);

        if (response2.ok) {
          clearTimeout(timeout);
          const info = await response2.json();
          return { success: true, message: `Connected to Asterisk ${info?.system?.version || ""}` };
        }

        clearTimeout(timeout);
        const text = await response2.text();
        return { success: false, error: `Server reachable but ARI returned HTTP ${response2.status}: ${text}. Verify ARI is enabled and user "${this.config.username}" exists in ari.conf` };
      } catch (err: any) {
        clearTimeout(timeout);
        return { success: false, error: `Server reachable but ARI request failed: ${err.message}` };
      }

    } catch (err: any) {
      clearTimeout(timeout);
      if (err.name === "AbortError") {
        return { success: false, error: "Connection timed out after 10 seconds" };
      }
      return { success: false, error: err.message };
    }
  }

  private async ariRequest(method: string, path: string, body?: any): Promise<any> {
    const url = `${this.baseUrl}/ari${path}`;
    const options: RequestInit = {
      method,
      headers: {
        Authorization: this.authHeader,
        "Content-Type": "application/json",
      },
    };
    if (body) options.body = JSON.stringify(body);

    const response = await fetch(url, options);
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`ARI ${method} ${path} failed: ${response.status} ${text}`);
    }

    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      return response.json();
    }
    return null;
  }

  async answerChannel(channelId: string): Promise<void> {
    await this.ariRequest("POST", `/channels/${channelId}/answer`);
  }

  async hangupChannel(channelId: string, reason: string = "normal"): Promise<void> {
    await this.ariRequest("DELETE", `/channels/${channelId}?reason=${reason}`);
  }

  async playMedia(channelId: string, media: string, playbackId?: string): Promise<any> {
    const params = new URLSearchParams({ media });
    if (playbackId) params.set("playbackId", playbackId);
    return this.ariRequest("POST", `/channels/${channelId}/play?${params}`);
  }

  async stopPlayback(playbackId: string): Promise<void> {
    await this.ariRequest("DELETE", `/playbacks/${playbackId}`);
  }

  async createBridge(type: string = "mixing"): Promise<AriBridge> {
    return this.ariRequest("POST", `/bridges?type=${type}`);
  }

  async addChannelToBridge(bridgeId: string, channelId: string): Promise<void> {
    await this.ariRequest("POST", `/bridges/${bridgeId}/addChannel?channel=${channelId}`);
  }

  async removeChannelFromBridge(bridgeId: string, channelId: string): Promise<void> {
    await this.ariRequest("POST", `/bridges/${bridgeId}/removeChannel?channel=${channelId}`);
  }

  async destroyBridge(bridgeId: string): Promise<void> {
    await this.ariRequest("DELETE", `/bridges/${bridgeId}`);
  }

  async getChannel(channelId: string): Promise<AriChannel> {
    return this.ariRequest("GET", `/channels/${channelId}`);
  }

  async listChannels(): Promise<AriChannel[]> {
    return this.ariRequest("GET", "/channels");
  }

  async setChannelVariable(channelId: string, variable: string, value: string): Promise<void> {
    await this.ariRequest("POST", `/channels/${channelId}/variable?variable=${variable}&value=${encodeURIComponent(value)}`);
  }

  async muteChannel(channelId: string, direction: string = "in"): Promise<void> {
    await this.ariRequest("POST", `/channels/${channelId}/mute?direction=${direction}`);
  }

  async unmuteChannel(channelId: string, direction: string = "in"): Promise<void> {
    await this.ariRequest("DELETE", `/channels/${channelId}/mute?direction=${direction}`);
  }

  async holdChannel(channelId: string): Promise<void> {
    await this.ariRequest("POST", `/channels/${channelId}/hold`);
  }

  async unholdChannel(channelId: string): Promise<void> {
    await this.ariRequest("DELETE", `/channels/${channelId}/hold`);
  }

  async startMoh(channelId: string, mohClass?: string): Promise<void> {
    const params = mohClass ? `?mohClass=${mohClass}` : "";
    await this.ariRequest("POST", `/channels/${channelId}/moh${params}`);
  }

  async stopMoh(channelId: string): Promise<void> {
    await this.ariRequest("DELETE", `/channels/${channelId}/moh`);
  }

  async startRecording(channelId: string, name: string, format: string = "wav"): Promise<any> {
    return this.ariRequest("POST", `/channels/${channelId}/record?name=${name}&format=${format}&ifExists=overwrite`);
  }

  async stopRecording(recordingName: string): Promise<void> {
    await this.ariRequest("POST", `/recordings/live/${recordingName}/stop`);
  }

  async downloadStoredRecording(recordingName: string): Promise<Buffer> {
    const url = `${this.baseUrl}/ari/recordings/stored/${recordingName}/file`;
    const response = await fetch(url, {
      method: "GET",
      headers: { Authorization: this.authHeader },
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`ARI download recording failed: ${response.status} ${text}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async deleteStoredRecording(recordingName: string): Promise<void> {
    const url = `${this.baseUrl}/ari/recordings/stored/${recordingName}`;
    const response = await fetch(url, {
      method: "DELETE",
      headers: { Authorization: this.authHeader },
    });
    if (!response.ok) {
      console.warn(`[ARI] Failed to delete stored recording ${recordingName}: ${response.status}`);
    }
  }

  async originateChannel(endpoint: string, extension: string, context: string = "default", callerId?: string, appArgs?: string): Promise<AriChannel> {
    const params: any = {
      endpoint,
      extension,
      context,
      app: this.config.appName,
    };
    if (callerId) params.callerId = callerId;
    if (appArgs) params.appArgs = appArgs;
    const query = new URLSearchParams(params).toString();
    console.log(`[ARI] Originating channel: endpoint=${endpoint}, app=${this.config.appName}, appArgs=${appArgs || 'none'}, callerId=${callerId || 'none'}`);
    return this.ariRequest("POST", `/channels?${query}`);
  }

  async redirectChannel(channelId: string, endpoint: string): Promise<void> {
    await this.ariRequest("POST", `/channels/${channelId}/redirect?endpoint=${endpoint}`);
  }

  async continueDialplan(channelId: string, context?: string, extension?: string, priority?: number): Promise<void> {
    const params = new URLSearchParams();
    if (context) params.set("context", context);
    if (extension) params.set("extension", extension);
    if (priority) params.set("priority", String(priority));
    console.log(`[ARI] continueDialplan: channelId=${channelId}, context=${context}, extension=${extension}, priority=${priority}`);
    await this.ariRequest("POST", `/channels/${channelId}/continue?${params}`);
  }

  async getEndpointStatus(tech: string, resource: string): Promise<{ state: string; technology: string; resource: string; channel_ids: string[] } | null> {
    try {
      const result = await this.ariRequest("GET", `/endpoints/${tech}/${resource}`);
      console.log(`[ARI] Endpoint ${tech}/${resource} status: state=${result.state}, channels=${(result.channel_ids || []).length}`);
      return result;
    } catch (err: any) {
      console.error(`[ARI] Failed to get endpoint ${tech}/${resource} status:`, err.message);
      return null;
    }
  }

  async setChannelVar(channelId: string, variable: string, value: string): Promise<void> {
    await this.ariRequest("POST", `/channels/${channelId}/variable?variable=${encodeURIComponent(variable)}&value=${encodeURIComponent(value)}`);
  }
}

let ariClientInstance: AriClient | null = null;

export function getAriClient(): AriClient | null {
  return ariClientInstance;
}

export function initializeAriClient(config: AriConfig): AriClient {
  if (ariClientInstance) {
    ariClientInstance.disconnect();
  }
  ariClientInstance = new AriClient(config);
  return ariClientInstance;
}

export function destroyAriClient(): void {
  if (ariClientInstance) {
    ariClientInstance.disconnect();
    ariClientInstance = null;
  }
}
