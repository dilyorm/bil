import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';

export interface VoiceRecordingOptions {
  onStart?: () => void;
  onStop?: () => void;
  onError?: (error: string) => void;
  onTranscript?: (transcript: string) => void;
}

export interface VoicePlaybackOptions {
  onStart?: () => void;
  onDone?: () => void;
  onError?: (error: string) => void;
}

class VoiceService {
  private recording: Audio.Recording | null = null;
  private isRecording = false;
  private isSpeaking = false;

  async initialize(): Promise<void> {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
    } catch (error) {
      console.error('Failed to initialize audio:', error);
      throw new Error('Failed to initialize audio permissions');
    }
  }

  async startRecording(options?: VoiceRecordingOptions): Promise<void> {
    try {
      if (this.isRecording) {
        throw new Error('Already recording');
      }

      // Stop any current speech playback
      if (this.isSpeaking) {
        await this.stopSpeaking();
      }

      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Audio recording permission not granted');
      }

      this.recording = new Audio.Recording();
      await this.recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await this.recording.startAsync();
      
      this.isRecording = true;
      options?.onStart?.();
    } catch (error) {
      console.error('Failed to start recording:', error);
      options?.onError?.(error instanceof Error ? error.message : 'Failed to start recording');
      throw error;
    }
  }

  async stopRecording(): Promise<string | null> {
    try {
      if (!this.recording || !this.isRecording) {
        return null;
      }

      await this.recording.stopAndUnloadAsync();
      const uri = this.recording.getURI();
      this.recording = null;
      this.isRecording = false;

      if (uri) {
        // In a real implementation, you would send this audio file to your backend
        // for speech-to-text processing. For now, we'll return a placeholder.
        return uri;
      }

      return null;
    } catch (error) {
      console.error('Failed to stop recording:', error);
      throw error;
    }
  }

  async speak(text: string, options?: VoicePlaybackOptions): Promise<void> {
    try {
      if (this.isSpeaking) {
        await this.stopSpeaking();
      }

      this.isSpeaking = true;
      options?.onStart?.();

      await Speech.speak(text, {
        language: 'en-US',
        pitch: 1.0,
        rate: 0.9,
        onStart: () => {
          this.isSpeaking = true;
        },
        onDone: () => {
          this.isSpeaking = false;
          options?.onDone?.();
        },
        onError: (error) => {
          this.isSpeaking = false;
          options?.onError?.(error.toString());
        },
      });
    } catch (error) {
      this.isSpeaking = false;
      console.error('Failed to speak:', error);
      options?.onError?.(error instanceof Error ? error.message : 'Failed to speak');
      throw error;
    }
  }

  async stopSpeaking(): Promise<void> {
    try {
      await Speech.stop();
      this.isSpeaking = false;
    } catch (error) {
      console.error('Failed to stop speaking:', error);
    }
  }

  getIsRecording(): boolean {
    return this.isRecording;
  }

  getIsSpeaking(): boolean {
    return this.isSpeaking;
  }

  // Simple wake word detection placeholder
  // In a real implementation, this would use more sophisticated audio processing
  detectWakeWord(audioUri: string): Promise<boolean> {
    // This is a placeholder - in reality you'd process the audio
    // to detect "Hey BIL" wake word
    return Promise.resolve(false);
  }
}

export const voiceService = new VoiceService();