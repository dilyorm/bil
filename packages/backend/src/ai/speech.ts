import OpenAI from 'openai';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { config } from '../config';
import { createReadStream, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface SpeechToTextResult {
  text: string;
  confidence?: number;
  language?: string;
  duration?: number;
}

export interface TextToSpeechOptions {
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  speed?: number; // 0.25 to 4.0
  format?: 'mp3' | 'opus' | 'aac' | 'flac';
}

export interface AudioProcessingResult {
  success: boolean;
  data?: Buffer | string;
  error?: string;
  metadata?: {
    duration?: number;
    format?: string;
    size?: number;
  };
}

export class SpeechService {
  private provider: 'openai' | 'gemini';
  private openaiClient?: OpenAI;
  private geminiClient?: GoogleGenerativeAI;
  private geminiModelName?: string;
  private tempDir: string;

  constructor() {
    const openaiKey = config.openai.apiKey;
    const geminiKey = process.env.GEMINI_API_KEY || config.gemini?.apiKey;

    if (openaiKey) {
      this.provider = 'openai';
      this.openaiClient = new OpenAI({
        apiKey: openaiKey,
      });
    } else if (geminiKey) {
      this.provider = 'gemini';
      this.geminiClient = new GoogleGenerativeAI(geminiKey);
      this.geminiModelName = config.gemini?.model || 'gemini-1.5-flash';
    } else {
      throw new Error('Speech processing requires GEMINI_API_KEY or OPENAI_API_KEY');
    }

    // Use system temp directory or create one in the project
    this.tempDir = process.env.TEMP || process.env.TMP || '/tmp';
  }

  /**
   * Convert speech to text using OpenAI Whisper API
   */
  async speechToText(
    audioBuffer: Buffer,
    options?: {
      language?: string;
      prompt?: string;
      temperature?: number;
    }
  ): Promise<SpeechToTextResult> {
    const startTime = Date.now();

    try {
      if (this.provider === 'gemini') {
        return await this.transcribeWithGemini(audioBuffer, options);
      }

      if (!this.openaiClient) {
        throw new Error('OpenAI client not configured');
      }

      // Create temporary file for the audio
      const tempFileName = `audio_${uuidv4()}.wav`;
      const tempFilePath = join(this.tempDir, tempFileName);

      // Write buffer to temporary file
      writeFileSync(tempFilePath, audioBuffer);

      try {
        // Create file stream for OpenAI API
        const audioFile = createReadStream(tempFilePath);

        // Call Whisper API
        const transcription = await this.openaiClient.audio.transcriptions.create({
          file: audioFile,
          model: 'whisper-1',
          ...(options?.language && { language: options.language }),
          ...(options?.prompt && { prompt: options.prompt }),
          temperature: options?.temperature || 0,
          response_format: 'verbose_json',
        });

        const processingTime = Date.now() - startTime;

        return {
          text: transcription.text,
          language: transcription.language,
          duration: transcription.duration,
          confidence: 0.95, // Whisper doesn't provide confidence, using default high value
        };

      } finally {
        // Clean up temporary file
        try {
          unlinkSync(tempFilePath);
        } catch (cleanupError) {
          console.warn('Failed to cleanup temp file:', cleanupError);
        }
      }

    } catch (error) {
      console.error('Speech-to-text error:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('audio file is invalid')) {
          throw new Error('Invalid audio format. Please provide a valid audio file.');
        }
        if (error.message.includes('rate limit')) {
          throw new Error('Speech processing rate limit exceeded. Please try again later.');
        }
      }

      throw new Error(`Speech-to-text conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Convert text to speech using OpenAI TTS API
   */
  async textToSpeech(
    text: string,
    options?: TextToSpeechOptions
  ): Promise<AudioProcessingResult> {
    try {
      if (this.provider === 'gemini') {
        return {
          success: false,
          error: 'Text-to-speech is not available with Gemini speech provider yet.',
        };
      }

      if (!this.openaiClient) {
        return {
          success: false,
          error: 'OpenAI client not configured for text-to-speech.',
        };
      }

      if (!text.trim()) {
        return {
          success: false,
          error: 'Text content is required',
        };
      }

      if (text.length > 4096) {
        return {
          success: false,
          error: 'Text is too long. Maximum 4096 characters allowed.',
        };
      }

      const response = await this.openaiClient.audio.speech.create({
        model: 'tts-1',
        voice: options?.voice || 'alloy',
        input: text,
        speed: options?.speed || 1.0,
        response_format: options?.format || 'mp3',
      });

      // Convert response to buffer
      const audioBuffer = Buffer.from(await response.arrayBuffer());

      return {
        success: true,
        data: audioBuffer,
        metadata: {
          format: options?.format || 'mp3',
          size: audioBuffer.length,
        },
      };

    } catch (error) {
      console.error('Text-to-speech error:', error);
      
      return {
        success: false,
        error: `Text-to-speech conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Validate audio format and convert if necessary
   */
  async validateAndConvertAudio(audioBuffer: Buffer): Promise<AudioProcessingResult> {
    try {
      // Basic validation - check if buffer has content
      if (!audioBuffer || audioBuffer.length === 0) {
        return {
          success: false,
          error: 'Empty audio buffer provided',
        };
      }

      // Check minimum size (at least 1KB)
      if (audioBuffer.length < 1024) {
        return {
          success: false,
          error: 'Audio file too small. Minimum 1KB required.',
        };
      }

      // Check maximum size (25MB limit for Whisper)
      const maxSize = 25 * 1024 * 1024; // 25MB
      if (audioBuffer.length > maxSize) {
        return {
          success: false,
          error: 'Audio file too large. Maximum 25MB allowed.',
        };
      }

      // Basic format detection based on file headers
      const format = this.detectAudioFormat(audioBuffer);

      return {
        success: true,
        data: audioBuffer,
        metadata: {
          format,
          size: audioBuffer.length,
        },
      };

    } catch (error) {
      return {
        success: false,
        error: `Audio validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Detect audio format from buffer header
   */
  private detectAudioFormat(buffer: Buffer): string {
    // Check common audio format signatures
    const header = buffer.subarray(0, 12);

    // WAV format
    if (header.subarray(0, 4).toString() === 'RIFF' && 
        header.subarray(8, 12).toString() === 'WAVE') {
      return 'wav';
    }

    // MP3 format
    if (header.length > 1 && header[0] === 0xFF && header[1] !== undefined && (header[1] & 0xE0) === 0xE0) {
      return 'mp3';
    }

    // FLAC format
    if (header.subarray(0, 4).toString() === 'fLaC') {
      return 'flac';
    }

    // OGG format
    if (header.subarray(0, 4).toString() === 'OggS') {
      return 'ogg';
    }

    // M4A/AAC format
    if (header.subarray(4, 8).toString() === 'ftyp') {
      return 'm4a';
    }

    return 'unknown';
  }

  /**
   * Get supported audio formats
   */
  getSupportedFormats(): string[] {
    return [
      'mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm',
      'flac', 'ogg', 'opus', 'aac', '3gp', 'amr', 'wma'
    ];
  }

  /**
   * Get available TTS voices
   */
  getAvailableVoices(): Array<{ id: string; name: string; description: string }> {
    if (this.provider === 'gemini') {
      return [];
    }

    return [
      { id: 'alloy', name: 'Alloy', description: 'Neutral, balanced voice' },
      { id: 'echo', name: 'Echo', description: 'Clear, professional voice' },
      { id: 'fable', name: 'Fable', description: 'Warm, storytelling voice' },
      { id: 'onyx', name: 'Onyx', description: 'Deep, authoritative voice' },
      { id: 'nova', name: 'Nova', description: 'Bright, energetic voice' },
      { id: 'shimmer', name: 'Shimmer', description: 'Soft, gentle voice' },
    ];
  }

  /**
   * Health check for speech services
   */
  async healthCheck(): Promise<{ whisper: boolean; tts: boolean; error?: string }> {
    try {
      if (this.provider === 'gemini') {
        return {
          whisper: !!this.geminiClient,
          tts: false,
        };
      }

      // Test with minimal audio data for Whisper (would need actual audio in production)
      // For now, just check if the API key is configured
      const whisperHealthy = !!config.openai.apiKey;

      // Test TTS with minimal text
      const ttsResult = await this.textToSpeech('test', { voice: 'alloy' });
      const ttsHealthy = ttsResult.success;

      return {
        whisper: whisperHealthy,
        tts: ttsHealthy,
      };

    } catch (error) {
      return {
        whisper: false,
        tts: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async transcribeWithGemini(
    audioBuffer: Buffer,
    options?: {
      language?: string;
      prompt?: string;
      temperature?: number;
    }
  ): Promise<SpeechToTextResult> {
    if (!this.geminiClient) {
      throw new Error('Gemini speech model not initialized');
    }

    const format = this.detectAudioFormat(audioBuffer);
    const mimeType = this.getMimeTypeFromFormat(format);
    const inlineData = {
      mimeType,
      data: audioBuffer.toString('base64'),
    };

    const languagePrompt = options?.language
      ? `Respond in ${options.language}.`
      : 'Respond in the source language.';
    const userPrompt = options?.prompt || `Transcribe the provided audio accurately. ${languagePrompt} Reply with transcript only.`;

    // Get the generative model
    const model = this.geminiClient.getGenerativeModel({
      model: this.geminiModelName || 'gemini-1.5-flash',
      generationConfig: {
        temperature: options?.temperature ?? 0,
      },
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
      ],
    });

    // Generate content with audio
    const result = await model.generateContent([
      { text: userPrompt },
      { inlineData },
    ]);

    const response = await result.response;
    const text = response.text().trim();

    if (!text) {
      throw new Error('Gemini returned an empty transcription');
    }

    return {
      text,
      language: options?.language || undefined,
      confidence: 0.9,
    };
  }

  private getMimeTypeFromFormat(format: string): string {
    switch (format) {
      case 'mp3':
        return 'audio/mpeg';
      case 'flac':
        return 'audio/flac';
      case 'ogg':
        return 'audio/ogg';
      case 'm4a':
        return 'audio/mp4';
      case 'wav':
      default:
        return 'audio/wav';
    }
  }
}