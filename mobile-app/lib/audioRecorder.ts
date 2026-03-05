import { Audio } from 'expo-av';
import { api } from './api';
import * as FileSystem from 'expo-file-system';

export type RecordingState = 'idle' | 'recording' | 'uploading' | 'completed' | 'failed';

class MobileAudioRecorder {
  private recording: Audio.Recording | null = null;
  private _state: RecordingState = 'idle';
  private _uri: string | null = null;
  private onStateChange: ((state: RecordingState) => void) | null = null;

  get state(): RecordingState { return this._state; }
  get isRecording(): boolean { return this._state === 'recording'; }

  setOnStateChange(cb: ((state: RecordingState) => void) | null) {
    this.onStateChange = cb;
  }

  private setState(state: RecordingState) {
    this._state = state;
    this.onStateChange?.(state);
  }

  async startRecording(): Promise<boolean> {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        console.error('[AudioRecorder] Microphone permission not granted');
        return false;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        {
          android: {
            extension: '.m4a',
            outputFormat: Audio.AndroidOutputFormat.MPEG_4,
            audioEncoder: Audio.AndroidAudioEncoder.AAC,
            sampleRate: 44100,
            numberOfChannels: 1,
            bitRate: 128000,
          },
          ios: {
            extension: '.m4a',
            outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
            audioQuality: Audio.IOSAudioQuality.HIGH,
            sampleRate: 44100,
            numberOfChannels: 1,
            bitRate: 128000,
          },
          web: {
            mimeType: 'audio/webm',
            bitsPerSecond: 128000,
          },
        }
      );

      this.recording = recording;
      this.setState('recording');
      console.log('[AudioRecorder] Recording started');
      return true;
    } catch (error) {
      console.error('[AudioRecorder] Failed to start recording:', error);
      this.setState('failed');
      return false;
    }
  }

  async stopRecording(): Promise<string | null> {
    if (!this.recording) return null;

    try {
      await this.recording.stopAndUnloadAsync();
      const uri = this.recording.getURI();
      this._uri = uri;
      this.recording = null;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      console.log('[AudioRecorder] Recording stopped, URI:', uri);
      this.setState('idle');
      return uri;
    } catch (error) {
      console.error('[AudioRecorder] Failed to stop recording:', error);
      this.recording = null;
      this.setState('failed');
      return null;
    }
  }

  async uploadRecording(params: {
    callLogId: string;
    phoneNumber: string;
    direction: string;
    durationSeconds: number;
    collaboratorName: string;
    customerName?: string;
    customerId?: string;
  }): Promise<any> {
    const uri = this._uri;
    if (!uri) {
      console.error('[AudioRecorder] No recording URI to upload');
      return null;
    }

    try {
      this.setState('uploading');

      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists) {
        console.error('[AudioRecorder] Recording file not found:', uri);
        this.setState('failed');
        return null;
      }

      const token = await this.getToken();
      const formData = new FormData();

      const filename = `mobile_${params.collaboratorName.replace(/\s+/g, '_')}_${Date.now()}.m4a`;
      formData.append('recording', {
        uri,
        name: filename,
        type: 'audio/mp4',
      } as any);

      formData.append('callLogId', params.callLogId);
      formData.append('phoneNumber', params.phoneNumber);
      formData.append('direction', params.direction);
      formData.append('durationSeconds', String(params.durationSeconds));
      formData.append('agentName', params.collaboratorName);
      if (params.customerName) formData.append('customerName', params.customerName);
      if (params.customerId) formData.append('customerId', params.customerId);

      const response = await fetch(`${api.baseUrl}/api/mobile/call-recording`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Upload failed: HTTP ${response.status}`);
      }

      const result = await response.json();
      console.log('[AudioRecorder] Recording uploaded successfully:', result.id);
      this.setState('completed');

      try {
        await FileSystem.deleteAsync(uri, { idempotent: true });
      } catch (e) {}

      this._uri = null;
      return result;
    } catch (error) {
      console.error('[AudioRecorder] Upload failed:', error);
      this.setState('failed');
      return null;
    }
  }

  private async getToken(): Promise<string | null> {
    try {
      const SecureStore = await import('expo-secure-store');
      return await SecureStore.getItemAsync('auth_token');
    } catch {
      return null;
    }
  }

  async cleanup(): Promise<void> {
    if (this.recording) {
      try {
        await this.recording.stopAndUnloadAsync();
      } catch (e) {}
      this.recording = null;
    }
    if (this._uri) {
      try {
        const FileSystem2 = await import('expo-file-system');
        await FileSystem2.deleteAsync(this._uri, { idempotent: true });
      } catch (e) {}
      this._uri = null;
    }
    this.setState('idle');
  }
}

export const mobileAudioRecorder = new MobileAudioRecorder();
