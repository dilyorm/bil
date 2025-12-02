import OpenAI from 'openai';
import { OpenAIClient } from './client';
import { GeminiClient } from './gemini-client';
import { MemoryStore } from './memory';
import { ContextManager } from './context';
import { ConversationService } from './conversation';
import { 
  ProcessMessageRequest, 
  AIResponse, 
  ConversationContext,
  AIMessage 
} from './types';
import { v4 as uuidv4 } from 'uuid';
import { AIProcessingError, ValidationError } from '../errors/types';
import { aiServiceRecovery } from '../errors/recovery';
import { applicationMetrics } from '../monitoring/metrics';
import { aiLogger } from '../utils/logger';

// Type for unified AI client interface
type AIClientType = OpenAIClient | GeminiClient;

export class AIAgent {
  private aiClient: AIClientType;
  private memoryStore: MemoryStore;
  private contextManager: ContextManager;
  private conversationService: ConversationService;

  constructor() {
    // Use Gemini if API key is available, otherwise fall back to OpenAI
    // Both will read from .env automatically
    if (process.env.GEMINI_API_KEY) {
      aiLogger.info('Initializing AI Agent with Gemini');
      this.aiClient = new GeminiClient(); // Will read from .env
    } else {
      aiLogger.info('Initializing AI Agent with OpenAI');
      this.aiClient = new OpenAIClient();
    }
    
    this.memoryStore = new MemoryStore();
    this.contextManager = new ContextManager();
    this.conversationService = new ConversationService();
  }

  async processMessage(request: ProcessMessageRequest): Promise<AIResponse> {
    const startTime = Date.now();
    const messageId = uuidv4();

    try {
      // Input validation
      if (!request.message?.trim()) {
        throw new ValidationError('Message content is required', {
          timestamp: new Date(),
          userId: request.userId,
          deviceId: request.deviceContext?.deviceId
        }, 'message');
      }

      if (!request.userId) {
        throw new ValidationError('User ID is required', {
          timestamp: new Date(),
          deviceId: request.deviceContext?.deviceId
        }, 'userId');
      }

      // Content moderation
      const isFlagged = await this.aiClient.moderateContent(request.message);
      if (isFlagged) {
        return {
          content: "I can't help with that request. Please keep our conversation respectful and appropriate.",
          conversationId: request.conversationId || '',
          messageId,
          timestamp: new Date(),
          processingTime: Date.now() - startTime,
          error: true,
          errorMessage: 'Content flagged by moderation',
        };
      }

      // Get or create conversation
      let conversationId = request.conversationId;
      if (!conversationId) {
        conversationId = await this.memoryStore.createConversation(request.userId);
      }

      // Build enhanced context with conversation analysis
      const context = await this.conversationService.getEnhancedContext(
        request.userId,
        conversationId,
        request.message
      );

      // Get conversation history
      const history = await this.memoryStore.getConversationHistory(conversationId, 10);

      // Build messages for OpenAI
      const messages = await this.buildOpenAIMessages(request.message, context, history);

      // Generate AI response with recovery
      const aiResponse = await aiServiceRecovery.processWithRecovery(
        () => this.aiClient.generateResponse(messages, {
          temperature: 0.7,
          maxTokens: 1000,
        }),
        'openai-chat'
      );

      // Store the interaction
      await this.memoryStore.storeInteraction(
        request.userId,
        conversationId,
        request.message,
        aiResponse,
        request.deviceContext?.deviceId
      );

      // Update context based on the interaction
      await this.updateContextFromInteraction(
        request.userId,
        conversationId,
        request.message,
        aiResponse
      );

      const processingTime = Date.now() - startTime;

      // Record metrics
      applicationMetrics.recordAIProcessing('chat', processingTime, true);
      aiLogger.info('AI message processed successfully', {
        userId: request.userId,
        conversationId,
        processingTime,
        messageLength: request.message.length
      });

      return {
        content: aiResponse,
        conversationId,
        messageId,
        timestamp: new Date(),
        processingTime,
        error: false,
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      // Record metrics
      applicationMetrics.recordAIProcessing('chat', processingTime, false);
      
      // Log error
      aiLogger.error('AI Agent processing error', {
        userId: request.userId,
        conversationId: request.conversationId,
        processingTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, error instanceof Error ? error : undefined);

      // Convert to AIProcessingError if not already a BILError
      if (!(error instanceof AIProcessingError)) {
        throw new AIProcessingError(
          error instanceof Error ? error.message : 'AI processing failed',
          {
            timestamp: new Date(),
            userId: request.userId,
            deviceId: request.deviceContext?.deviceId,
            conversationId: request.conversationId
          },
          error instanceof Error ? error : undefined
        );
      }

      throw error;
    }
  }

  private async buildOpenAIMessages(
    userMessage: string,
    context: ConversationContext,
    history: AIMessage[]
  ): Promise<OpenAI.Chat.Completions.ChatCompletionMessageParam[]> {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

    // System message with context
    const systemPrompt = this.buildSystemPrompt(context);
    messages.push({
      role: 'system',
      content: systemPrompt,
    });

    // Add relevant conversation history
    const recentHistory = history.slice(-6); // Last 6 messages for context
    recentHistory.forEach(msg => {
      if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({
          role: msg.role,
          content: msg.content,
        });
      }
    });

    // Add current user message
    messages.push({
      role: 'user',
      content: userMessage,
    });

    return messages;
  }

  private buildSystemPrompt(context: ConversationContext): string {
    let prompt = `You are BIL, a helpful personal AI assistant. You are conversational, friendly, and aim to be genuinely helpful.

Key guidelines:
- Be concise but thorough in your responses
- Maintain a warm, approachable tone
- Remember context from our conversation
- If you're unsure about something, say so rather than guessing
- Respect user privacy and data boundaries`;

    // Add device-specific context
    if (context.deviceContext) {
      prompt += `\n\nDevice context: You're currently interacting through a ${context.deviceContext.deviceType} device.`;
      
      if (context.deviceContext.deviceType === 'wearable') {
        prompt += ' Keep responses brief and actionable since the user is on a wearable device.';
      }
      
      if (!context.deviceContext.capabilities.hasVoiceOutput) {
        prompt += ' The device cannot play audio, so avoid suggesting voice-based actions.';
      }
    }

    // Add user context
    if (context.activeTopics.length > 0) {
      prompt += `\n\nRecent conversation topics: ${context.activeTopics.join(', ')}`;
    }

    if (context.userMood && context.userMood !== 'neutral') {
      prompt += `\n\nUser seems to be in a ${context.userMood} mood. Adjust your tone accordingly.`;
    }

    if (context.recentActivities.length > 0) {
      prompt += `\n\nUser's recent activities: ${context.recentActivities.join(', ')}`;
    }

    return prompt;
  }

  private async updateContextFromInteraction(
    userId: string,
    conversationId: string,
    userMessage: string,
    aiResponse: string
  ): Promise<void> {
    try {
      // Extract and store preferences if mentioned
      const preferenceIndicators = [
        'i prefer', 'i like', 'i don\'t like', 'i hate', 'my favorite',
        'i usually', 'i always', 'i never', 'remind me to'
      ];

      const lowerMessage = userMessage.toLowerCase();
      const hasPreference = preferenceIndicators.some(indicator => 
        lowerMessage.includes(indicator)
      );

      if (hasPreference) {
        await this.memoryStore.storeMemoryEntry({
          userId,
          conversationId,
          content: `User preference: ${userMessage}`,
          type: 'preference',
          relevanceScore: 0.9,
        });
      }

      // Store important context from AI response
      if (aiResponse.includes('remember') || aiResponse.includes('noted')) {
        await this.memoryStore.storeMemoryEntry({
          userId,
          conversationId,
          content: `Context: ${aiResponse}`,
          type: 'context',
          relevanceScore: 0.7,
        });
      }
    } catch (error) {
      console.error('Error updating context from interaction:', error);
      // Don't throw error as this is not critical for the main flow
    }
  }

  private getFallbackResponse(error: unknown): string {
    if (error instanceof Error) {
      if (error.message.includes('Rate limit')) {
        return "I'm experiencing high demand right now. Please try again in a moment.";
      }
      if (error.message.includes('temporarily unavailable')) {
        return "I'm having some technical difficulties. Please try again shortly.";
      }
      if (error.message.includes('API key')) {
        return "I'm experiencing a configuration issue. Please contact support.";
      }
    }

    return "I'm sorry, I encountered an issue processing your request. Please try again.";
  }

  async getConversationHistory(conversationId: string): Promise<AIMessage[]> {
    return this.memoryStore.getConversationHistory(conversationId);
  }

  async getUserConversations(userId: string): Promise<any[]> {
    return this.memoryStore.getUserConversations(userId);
  }

  async deleteConversation(conversationId: string, userId: string): Promise<void> {
    // Implementation would delete conversation and associated messages
    // For now, just a placeholder
    console.log(`Delete conversation ${conversationId} for user ${userId}`);
  }
}