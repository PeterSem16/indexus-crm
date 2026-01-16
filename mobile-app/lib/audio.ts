import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { api } from './api';

let recording: Audio.Recording | null = null;

export async function requestAudioPermissions(): Promise<boolean> {
  const { status } = await Audio.requestPermissionsAsync();
  return status === 'granted';
}

export async function startRecording(): Promise<boolean> {
  try {
    const hasPermission = await requestAudioPermissions();
    if (!hasPermission) return false;
    
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });
    
    const { recording: newRecording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    );
    
    recording = newRecording;
    return true;
  } catch (error) {
    return false;
  }
}

export async function stopRecording(): Promise<{ uri: string; duration: number } | null> {
  if (!recording) return null;
  
  try {
    await recording.stopAndUnloadAsync();
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
    });
    
    const uri = recording.getURI();
    const status = await recording.getStatusAsync();
    
    recording = null;
    
    if (!uri) return null;
    
    return {
      uri,
      duration: status.durationMillis || 0,
    };
  } catch (error) {
    recording = null;
    return null;
  }
}

export async function cancelRecording(): Promise<void> {
  if (recording) {
    try {
      await recording.stopAndUnloadAsync();
    } catch {
    }
    recording = null;
  }
}

export function isRecording(): boolean {
  return recording !== null;
}

export async function uploadVoiceNote(
  visitEventId: string,
  fileUri: string,
  duration: number
): Promise<{ id: string; transcription?: string } | null> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    if (!fileInfo.exists) return null;
    
    const formData = new FormData();
    formData.append('audio', {
      uri: fileUri,
      type: 'audio/m4a',
      name: 'voice_note.m4a',
    } as any);
    formData.append('visitEventId', visitEventId);
    formData.append('duration', duration.toString());
    
    const response = await fetch(`${api['baseUrl']}/api/mobile/voice-notes`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${await getToken()}`,
      },
      body: formData,
    });
    
    if (!response.ok) {
      throw new Error('Upload failed');
    }
    
    return await response.json();
  } catch (error) {
    return null;
  }
}

async function getToken(): Promise<string | null> {
  const SecureStore = await import('expo-secure-store');
  const { TOKEN_KEY } = await import('@/constants/config');
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function playAudio(uri: string): Promise<Audio.Sound | null> {
  try {
    const { sound } = await Audio.Sound.createAsync({ uri });
    await sound.playAsync();
    return sound;
  } catch (error) {
    return null;
  }
}
