interface AudioConfig {
  sampleRate: number;
  channels: number;
  bitDepth: number;
}

interface VoiceSettings {
  voiceId?: string;
  speed: number;
  pitch: number;
  volume: number;
}

class AudioService {
  private audioContext: AudioContext | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private isRecording = false;
  private currentAudio: HTMLAudioElement | null = null;

  private config: AudioConfig = {
    sampleRate: 44100,
    channels: 1,
    bitDepth: 16,
  };

  private voiceSettings: VoiceSettings = {
    speed: 1.0,
    pitch: 1.0,
    volume: 1.0,
  };

  constructor() {
    this.initializeAudioContext();
  }

  // Initialize audio context
  private async initializeAudioContext(): Promise<void> {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Resume audio context if it's suspended (required by some browsers)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
    } catch (error) {
      console.error('Failed to initialize audio context:', error);
    }
  }

  // Voice recording methods
  async startRecording(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: this.config.sampleRate,
          channelCount: this.config.channels,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });

      this.audioChunks = [];
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: this.getSupportedMimeType(),
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };

      this.mediaRecorder.start(100); // Collect data every 100ms
      this.isRecording = true;
    } catch (error) {
      console.error('Failed to start recording:', error);
      throw new Error('Could not access microphone. Please check your permissions.');
    }
  }

  async stopRecording(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || !this.isRecording) {
        reject(new Error('No active recording'));
        return;
      }

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { 
          type: this.getSupportedMimeType() 
        });
        this.isRecording = false;
        resolve(audioBlob);
      };

      this.mediaRecorder.stop();
    });
  }

  // Text-to-speech methods
  async playTextToSpeech(text: string, settings?: Partial<VoiceSettings>): Promise<void> {
    const finalSettings = { ...this.voiceSettings, ...settings };

    // Stop any currently playing audio
    this.stopCurrentAudio();

    try {
      // Use Web Speech API if available
      if ('speechSynthesis' in window) {
        await this.playWithWebSpeechAPI(text, finalSettings);
      } else {
        // Fallback to server-side TTS
        await this.playWithServerTTS(text, finalSettings);
      }
    } catch (error) {
      console.error('Text-to-speech failed:', error);
      throw error;
    }
  }

  private async playWithWebSpeechAPI(text: string, settings: VoiceSettings): Promise<void> {
    return new Promise((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text);
      
      // Configure voice settings
      utterance.rate = settings.speed;
      utterance.pitch = settings.pitch;
      utterance.volume = settings.volume;

      // Select voice if specified
      if (settings.voiceId) {
        const voices = speechSynthesis.getVoices();
        const selectedVoice = voices.find(voice => voice.voiceURI === settings.voiceId);
        if (selectedVoice) {
          utterance.voice = selectedVoice;
        }
      }

      utterance.onend = () => resolve();
      utterance.onerror = (event) => reject(new Error(`Speech synthesis error: ${event.error}`));

      speechSynthesis.speak(utterance);
    });
  }

  private async playWithServerTTS(text: string, settings: VoiceSettings): Promise<void> {
    // This would integrate with the backend TTS service
    // For now, we'll use a placeholder implementation
    console.log('Server TTS not implemented, falling back to Web Speech API');
    await this.playWithWebSpeechAPI(text, settings);
  }

  // Audio playback methods
  async playAudioBlob(audioBlob: Blob): Promise<void> {
    return new Promise((resolve, reject) => {
      this.stopCurrentAudio();

      const audioUrl = URL.createObjectURL(audioBlob);
      this.currentAudio = new Audio(audioUrl);

      this.currentAudio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        resolve();
      };

      this.currentAudio.onerror = () => {
        URL.revokeObjectURL(audioUrl);
        reject(new Error('Failed to play audio'));
      };

      this.currentAudio.play().catch(reject);
    });
  }

  async playAudioUrl(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.stopCurrentAudio();

      this.currentAudio = new Audio(url);

      this.currentAudio.onended = () => resolve();
      this.currentAudio.onerror = () => reject(new Error('Failed to play audio'));

      this.currentAudio.play().catch(reject);
    });
  }

  // Audio processing methods
  async processAudioBlob(audioBlob: Blob): Promise<ArrayBuffer> {
    if (!this.audioContext) {
      throw new Error('Audio context not initialized');
    }

    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
    
    return this.audioBufferToWav(audioBuffer);
  }

  private audioBufferToWav(audioBuffer: AudioBuffer): ArrayBuffer {
    const length = audioBuffer.length;
    const numberOfChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const arrayBuffer = new ArrayBuffer(44 + length * numberOfChannels * 2);
    const view = new DataView(arrayBuffer);

    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * numberOfChannels * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numberOfChannels * 2, true);
    view.setUint16(32, numberOfChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length * numberOfChannels * 2, true);

    // Convert audio data
    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(channel)[i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
      }
    }

    return arrayBuffer;
  }

  // Utility methods
  stopCurrentAudio(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }

    // Stop speech synthesis
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
    }
  }

  getAvailableVoices(): SpeechSynthesisVoice[] {
    if ('speechSynthesis' in window) {
      return speechSynthesis.getVoices();
    }
    return [];
  }

  updateVoiceSettings(settings: Partial<VoiceSettings>): void {
    this.voiceSettings = { ...this.voiceSettings, ...settings };
  }

  getVoiceSettings(): VoiceSettings {
    return { ...this.voiceSettings };
  }

  isCurrentlyRecording(): boolean {
    return this.isRecording;
  }

  private getSupportedMimeType(): string {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/wav',
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return 'audio/webm'; // Fallback
  }

  // Cleanup
  dispose(): void {
    this.stopCurrentAudio();
    
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

// Create singleton instance
export const audioService = new AudioService();
export default audioService;