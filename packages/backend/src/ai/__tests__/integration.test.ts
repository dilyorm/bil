import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AIAgent } from '../agent';
import { SpeechService } from '../speech';
import { ProcessMessageRequest } from '../types';

// Mock dependencies
vi.mock('../client');
vi.mock('../memory');
vi.mock('../context');
vi.mock('../conversation');
vi.mock('../speech');

import { OpenAIClient } from '../client';
import { MemoryStore } from '../memory';
import { ContextManager } from '../context';
import { ConversationService } from '../conversation';

describe('AI Processing Integration', () => {
  let agent: AIAgent;
  let speechService: SpeechService;
  let mockOpenAIClient: any;
  let mockMemoryStore: any;
  let mockContextManager: any;
  let mockConversationService: any;
  let mockSpeechService: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock OpenAI Client
    mockOpenAIClient = {
      moderateContent: vi.fn(),
      generateResponse: vi.fn()
    };

    // Mock Memory Store
    mockMemoryStore = {
      createConversation: vi.fn(),
      getConversationHistory: vi.fn(),
      storeInteraction: vi.fn(),
      storeMemoryEntry: vi.fn(),
      getUserConversations: vi.fn()
    };

    // Mock Context Manager
    mockContextManager = {
      getContext: vi.fn()
    };

    // Mock Conversation Service
    mockConversationService = {
      getEnhancedContext: vi.fn()
    };

    // Mock Speech Service
    mockSpeechService = {
      speechToText: vi.fn(),
      textToSpeech: vi.fn(),
      validateAndConvertAudio: vi.fn(),
      healthCheck: vi.fn()
    };

    vi.mocked(OpenAIClient).mockImplementation(() => mockOpenAIClient);
    vi.mocked(MemoryStore).mockImplementation(() => mockMemoryStore);
    vi.mocked(ContextManager).mockImplementation(() => mockContextManager);
    vi.mocked(ConversationService).mockImplementation(() => mockConversationService);
    vi.mocked(SpeechService).mockImplementation(() => mockSpeechService);

    agent = new AIAgent();
    speechService = new SpeechService();
  });

  describe('Voice Processing Pipeline', () => {
    it('should process complete voice interaction flow', async () => {
      // Mock audio buffer
      const audioBuffer = Buffer.from('mock audio data');
      
      // Mock speech-to-text conversion
      mockSpeechService.speechToText.mockResolvedValue({
        text: 'Hello, how are you today?',
        confidence: 0.95,
        language: 'en',
        duration: 2.5
      });

      // Mock AI processing
      mockOpenAIClient.moderateContent.mockResolvedValue(false);
      mockConversationService.getEnhancedContext.mockResolvedValue({
        userId: 'user-123',
        conversationId: 'conv-123',
        activeTopics: ['greeting'],
        recentActivities: [],
        relevantFiles: []
      });
      mockMemoryStore.getConversationHistory.mockResolvedValue([]);
      mockOpenAIClient.generateResponse.mockResolvedValue('Hello! I\'m doing well, thank you for asking.');
      mockMemoryStore.storeInteraction.mockResolvedValue();

      // Mock text-to-speech conversion
      mockSpeechService.textToSpeech.mockResolvedValue({
        success: true,
        data: Buffer.from('mock audio response'),
        metadata: {
          format: 'mp3',
          size: 1024
        }
      });

      // Step 1: Convert speech to text
      const speechResult = await speechService.speechToText(audioBuffer);
      expect(speechResult.text).toBe('Hello, how are you today?');

      // Step 2: Process message through AI agent
      const request: ProcessMessageRequest = {
        userId: 'user-123',
        message: speechResult.text,
        conversationId: 'conv-123',
        deviceContext: {
          deviceId: 'device-123',
          deviceType: 'mobile',
          capabilities: {
            hasVoiceInput: true,
            hasVoiceOutput: true,
            hasHapticFeedback: false,
            hasFileAccess: false,
            hasCalendarAccess: false,
            supportsGestures: false
          }
        }
      };

      const aiResponse = await agent.processMessage(request);
      expect(aiResponse.content).toBe('Hello! I\'m doing well, thank you for asking.');
      expect(aiResponse.error).toBe(false);

      // Step 3: Convert response to speech
      const ttsResult = await speechService.textToSpeech(aiResponse.content);
      expect(ttsResult.success).toBe(true);
      expect(ttsResult.data).toBeInstanceOf(Buffer);

      // Verify the complete pipeline
      expect(mockSpeechService.speechToText).toHaveBeenCalledWith(audioBuffer);
      expect(mockOpenAIClient.generateResponse).toHaveBeenCalled();
      expect(mockSpeechService.textToSpeech).toHaveBeenCalledWith('Hello! I\'m doing well, thank you for asking.');
    });

    it('should handle speech recognition errors gracefully', async () => {
      const audioBuffer = Buffer.from('invalid audio data');

      mockSpeechService.speechToText.mockRejectedValue(
        new Error('Invalid audio format. Please provide a valid audio file.')
      );

      await expect(speechService.speechToText(audioBuffer)).rejects.toThrow(
        'Invalid audio format. Please provide a valid audio file.'
      );
    });

    it('should handle TTS errors in voice pipeline', async () => {
      mockSpeechService.textToSpeech.mockResolvedValue({
        success: false,
        error: 'Text-to-speech conversion failed: Rate limit exceeded'
      });

      const result = await speechService.textToSpeech('Hello world');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Rate limit exceeded');
    });
  });

  describe('Context Management Integration', () => {
    it('should maintain context across multiple voice interactions', async () => {
      const userId = 'user-123';
      const conversationId = 'conv-123';

      // First interaction
      mockOpenAIClient.moderateContent.mockResolvedValue(false);
      mockConversationService.getEnhancedContext.mockResolvedValue({
        userId,
        conversationId,
        activeTopics: [],
        recentActivities: [],
        relevantFiles: []
      });
      mockMemoryStore.getConversationHistory.mockResolvedValue([]);
      mockOpenAIClient.generateResponse.mockResolvedValue('Hello! How can I help you?');
      mockMemoryStore.storeInteraction.mockResolvedValue();

      const firstRequest: ProcessMessageRequest = {
        userId,
        message: 'Hello',
        conversationId
      };

      await agent.processMessage(firstRequest);

      // Second interaction with context
      mockMemoryStore.getConversationHistory.mockResolvedValue([
        {
          id: 'msg-1',
          role: 'user',
          content: 'Hello',
          timestamp: new Date()
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: 'Hello! How can I help you?',
          timestamp: new Date()
        }
      ]);
      mockConversationService.getEnhancedContext.mockResolvedValue({
        userId,
        conversationId,
        activeTopics: ['greeting'],
        recentActivities: [],
        relevantFiles: []
      });
      mockOpenAIClient.generateResponse.mockResolvedValue('I can help you with various tasks. What would you like to do?');

      const secondRequest: ProcessMessageRequest = {
        userId,
        message: 'What can you do?',
        conversationId
      };

      const result = await agent.processMessage(secondRequest);

      expect(result.content).toBe('I can help you with various tasks. What would you like to do?');
      expect(mockMemoryStore.getConversationHistory).toHaveBeenCalledWith(conversationId, 10);
    });

    it('should adapt responses based on device capabilities', async () => {
      const wearableRequest: ProcessMessageRequest = {
        userId: 'user-123',
        message: 'What\'s the weather like?',
        conversationId: 'conv-123',
        deviceContext: {
          deviceId: 'wearable-123',
          deviceType: 'wearable',
          capabilities: {
            hasVoiceInput: true,
            hasVoiceOutput: false, // No voice output
            hasHapticFeedback: true,
            hasFileAccess: false,
            hasCalendarAccess: false,
            supportsGestures: true
          }
        }
      };

      mockOpenAIClient.moderateContent.mockResolvedValue(false);
      mockConversationService.getEnhancedContext.mockResolvedValue({
        userId: 'user-123',
        conversationId: 'conv-123',
        activeTopics: ['weather'],
        recentActivities: [],
        relevantFiles: [],
        deviceContext: wearableRequest.deviceContext
      });
      mockMemoryStore.getConversationHistory.mockResolvedValue([]);
      mockOpenAIClient.generateResponse.mockResolvedValue('Sunny, 72°F');
      mockMemoryStore.storeInteraction.mockResolvedValue();

      await agent.processMessage(wearableRequest);

      // Verify that the system prompt includes device-specific instructions
      expect(mockOpenAIClient.generateResponse).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            role: 'system',
            content: expect.stringMatching(/wearable device.*brief and actionable.*cannot play audio/s)
          })
        ]),
        expect.any(Object)
      );
    });
  });

  describe('Error Recovery and Fallbacks', () => {
    it('should provide fallback when OpenAI API is unavailable', async () => {
      const request: ProcessMessageRequest = {
        userId: 'user-123',
        message: 'Hello',
        conversationId: 'conv-123'
      };

      mockOpenAIClient.moderateContent.mockResolvedValue(false);
      mockConversationService.getEnhancedContext.mockResolvedValue({
        userId: 'user-123',
        conversationId: 'conv-123',
        activeTopics: [],
        recentActivities: [],
        relevantFiles: []
      });
      mockMemoryStore.getConversationHistory.mockResolvedValue([]);
      mockOpenAIClient.generateResponse.mockRejectedValue(
        new Error('OpenAI service temporarily unavailable')
      );

      const result = await agent.processMessage(request);

      expect(result.error).toBe(true);
      expect(result.content).toContain('technical difficulties');
      expect(result.errorMessage).toBe('OpenAI service temporarily unavailable');
    });

    it('should handle speech service health check', async () => {
      mockSpeechService.healthCheck.mockResolvedValue({
        whisper: true,
        tts: false,
        error: 'TTS service unavailable'
      });

      const healthStatus = await speechService.healthCheck();

      expect(healthStatus.whisper).toBe(true);
      expect(healthStatus.tts).toBe(false);
      expect(healthStatus.error).toBe('TTS service unavailable');
    });
  });

  describe('Performance and Monitoring', () => {
    it('should track processing times for voice interactions', async () => {
      const startTime = Date.now();

      mockSpeechService.speechToText.mockImplementation(async () => {
        // Simulate processing delay
        await new Promise(resolve => setTimeout(resolve, 100));
        return {
          text: 'Test message',
          confidence: 0.95,
          language: 'en',
          duration: 2.0
        };
      });

      const result = await speechService.speechToText(Buffer.from('audio'));

      expect(result.text).toBe('Test message');
      expect(Date.now() - startTime).toBeGreaterThanOrEqual(100);
    });

    it('should measure AI response processing time', async () => {
      const request: ProcessMessageRequest = {
        userId: 'user-123',
        message: 'Hello',
        conversationId: 'conv-123'
      };

      mockOpenAIClient.moderateContent.mockResolvedValue(false);
      mockConversationService.getEnhancedContext.mockResolvedValue({
        userId: 'user-123',
        conversationId: 'conv-123',
        activeTopics: [],
        recentActivities: [],
        relevantFiles: []
      });
      mockMemoryStore.getConversationHistory.mockResolvedValue([]);
      mockOpenAIClient.generateResponse.mockResolvedValue('Hello!');
      mockMemoryStore.storeInteraction.mockResolvedValue();

      const result = await agent.processMessage(request);

      expect(result.processingTime).toBeGreaterThanOrEqual(0);
      expect(typeof result.processingTime).toBe('number');
    });
  });
});