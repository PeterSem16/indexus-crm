import { useState, useCallback } from 'react';
import { startRecording, stopRecording, cancelRecording, isRecording, uploadVoiceNote, playAudio } from '@/lib/audio';
import { Audio } from 'expo-av';

export function useVoiceNote() {
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentSound, setCurrentSound] = useState<Audio.Sound | null>(null);

  const start = useCallback(async () => {
    setError(null);
    const success = await startRecording();
    if (success) {
      setRecording(true);
      setDuration(0);
    } else {
      setError('Could not start recording');
    }
    return success;
  }, []);

  const stop = useCallback(async () => {
    const result = await stopRecording();
    setRecording(false);
    if (result) {
      setDuration(result.duration);
    }
    return result;
  }, []);

  const cancel = useCallback(async () => {
    await cancelRecording();
    setRecording(false);
    setDuration(0);
  }, []);

  const upload = useCallback(async (visitEventId: string, fileUri: string, fileDuration: number) => {
    setUploading(true);
    setError(null);
    
    try {
      const result = await uploadVoiceNote(visitEventId, fileUri, fileDuration);
      setUploading(false);
      return result;
    } catch (e) {
      setError('Upload failed');
      setUploading(false);
      return null;
    }
  }, []);

  const play = useCallback(async (uri: string) => {
    if (currentSound) {
      await currentSound.unloadAsync();
    }
    const sound = await playAudio(uri);
    if (sound) {
      setCurrentSound(sound);
      sound.setOnPlaybackStatusUpdate((status) => {
        if ('didJustFinish' in status && status.didJustFinish) {
          setCurrentSound(null);
        }
      });
    }
    return sound;
  }, [currentSound]);

  const stopPlayback = useCallback(async () => {
    if (currentSound) {
      await currentSound.stopAsync();
      await currentSound.unloadAsync();
      setCurrentSound(null);
    }
  }, [currentSound]);

  return {
    recording,
    isRecording: isRecording(),
    duration,
    uploading,
    error,
    isPlaying: currentSound !== null,
    start,
    stop,
    cancel,
    upload,
    play,
    stopPlayback,
  };
}
