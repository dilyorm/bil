import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import OpenAI from 'openai';
import { config } from '../config';

export class GeminiClient {
  private genAI: GoogleGenerativeAI;
  private modelName: string;
  private maxRetries: number = 3;
  private retryDelay: number = 1000;

  constructor(apiKey?: string) {
    // Use provided API key or get from config/env
    const key = apiKey || process.env.GEMINI_API_KEY || config.openai.apiKey;
    
    if (!key) {
      throw new Error('Gemini API key is required. Set GEMINI_API_KEY in your .env file');
    }

    this.genAI = new GoogleGenerativeAI(key);
    // Use the correct model name - gemini-2.0-flash-exp or gemini-pro
    this.modelName = 'gemini-2.0-flash-exp';
  }

  /**
   * Convert OpenAI message format to Gemini format
   */
  private convertMessages(
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
  ): { history: any[]; prompt: string } {
    let systemPrompt = '';
    const history: any[] = [];
    let lastUserMessage = '';

    for (const msg of messages) {
      if (msg.role === 'system') {
        // Gemini doesn't have system role, prepend to first user message
        systemPrompt += (typeof msg.content === 'string' ? msg.content : '') + '\n\n';
      } else if (msg.role === 'user') {
        const content = typeof msg.content === 'string' ? msg.content : '';
        lastUserMessage = systemPrompt ? systemPrompt + content : content;
        systemPrompt = ''; // Clear after first use
        
        // Add to history if not the last message
        if (messages.indexOf(msg) < messages.length - 1) {
          history.push({
            role: 'user',
            parts: [{ text: lastUserMessage }],
          });
        }
      } else if (msg.role === 'assistant') {
        const content = typeof msg.content === 'string' ? msg.content : '';
        history.push({
          role: 'model',
          parts: [{ text: content }],
        });
      }
    }

    return { history, prompt: lastUserMessage };
  }

  async generateResponse(
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<string> {
    const startTime = Date.now();

    try {
      const { history, prompt } = this.convertMessages(messages);

      console.log('Gemini request:', { 
        model: this.modelName, 
        historyLength: history.length, 
        promptLength: prompt.length 
      });

      // Get the generative model with relaxed safety settings
      const model = this.genAI.getGenerativeModel({ 
        model: this.modelName,
        generationConfig: {
          temperature: options?.temperature || 0.7,
          maxOutputTokens: options?.maxTokens || 1000,
        },
        safetySettings: [
          {
            category: HarmCategory.HARM_CATEGORY_HARASSMENT,
            threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
          },
          {
            category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
            threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
          },
          {
            category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
            threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
          },
          {
            category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
            threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
          },
        ],
      });

      // Start chat with history
      const chat = model.startChat({
        history,
      });

      // Send the last message
      const result = await chat.sendMessage(prompt);
      const response = await result.response;
      const text = response.text();

      console.log('Gemini response:', { 
        textLength: text.length, 
        preview: text.substring(0, 100) 
      });

      if (!text || text.trim().length === 0) {
        throw new Error('No response generated from Gemini');
      }

      const processingTime = Date.now() - startTime;
      console.log(`Gemini response generated in ${processingTime}ms`);

      return text;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`Gemini API error after ${processingTime}ms:`, error);

      // Handle Gemini-specific errors
      if (error instanceof Error) {
        if (error.message.includes('quota')) {
          throw new Error('Gemini API quota exceeded. Please try again later.');
        } else if (error.message.includes('API key') || error.message.includes('API_KEY')) {
          throw new Error('Invalid Gemini API key');
        } else if (error.message.includes('SAFETY')) {
          throw new Error('Content blocked by Gemini safety filters');
        } else if (error.message.includes('models/')) {
          throw new Error(`Model ${this.modelName} not found. Try gemini-pro instead.`);
        }
      }

      throw new Error(
        `Failed to generate AI response: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      // Gemini doesn't have a direct embedding API yet
      // For MVP, we can use a simple hash-based approach or skip embeddings
      console.warn('Gemini embeddings not yet supported. Using placeholder.');
      
      // Return a simple placeholder embedding
      // In production, you might want to use a different service for embeddings
      return new Array(768).fill(0).map(() => Math.random());
    } catch (error) {
      console.error('Gemini embedding error:', error);
      throw new Error(
        `Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async moderateContent(text: string): Promise<boolean> {
    try {
      // For Gemini, we rely on the built-in safety settings during generation
      // Don't pre-moderate simple messages to avoid false positives
      
      // Only flag obviously problematic content patterns
      const lowerText = text.toLowerCase();
      const explicitPatterns = [
        /\b(kill|murder|suicide|bomb|weapon)\b.*\b(how to|instructions|guide)\b/i,
        /\b(hack|crack|steal|fraud)\b.*\b(tutorial|guide|how)\b/i,
      ];
      
      const isExplicitlyHarmful = explicitPatterns.some(pattern => pattern.test(lowerText));
      
      if (isExplicitlyHarmful) {
        console.log('Content flagged by pattern matching:', text.substring(0, 50));
        return true; // Return true if flagged (harmful)
      }
      
      // For normal messages, don't flag - let Gemini's safety settings handle it
      return false; // Return false if safe
    } catch (error) {
      console.error('Gemini moderation error:', error);
      // If there's an error, assume content is safe to avoid false positives
      return false;
    }
  }
}

// Export a unified client that works with both OpenAI and Gemini
export function createAIClient(apiKey?: string, provider: 'openai' | 'gemini' = 'gemini') {
  if (provider === 'gemini') {
    const geminiKey = apiKey || process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      throw new Error('Gemini API key is required');
    }
    return new GeminiClient(geminiKey);
  } else {
    // Return OpenAI client (you'd import and use OpenAIClient here)
    throw new Error('OpenAI client not implemented in this file');
  }
}