import OpenAI from 'openai';
import { config } from '../config';

export class OpenAIClient {
  private client: OpenAI;
  private maxRetries: number = 3;
  private retryDelay: number = 1000; // 1 second

  constructor() {
    if (!config.openai.apiKey) {
      throw new Error('OpenAI API key is required');
    }

    this.client = new OpenAI({
      apiKey: config.openai.apiKey,
      maxRetries: this.maxRetries,
    });
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
      const completion = await this.client.chat.completions.create({
        model: options?.model || config.openai.model || 'gpt-3.5-turbo',
        messages,
        temperature: options?.temperature || 0.7,
        max_tokens: options?.maxTokens || 1000,
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        throw new Error('No response generated from OpenAI');
      }

      const processingTime = Date.now() - startTime;
      console.log(`OpenAI response generated in ${processingTime}ms`);

      return response;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`OpenAI API error after ${processingTime}ms:`, error);
      
      if (error instanceof OpenAI.APIError) {
        if (error.status === 429) {
          throw new Error('Rate limit exceeded. Please try again later.');
        } else if (error.status === 401) {
          throw new Error('Invalid OpenAI API key');
        } else if (error.status >= 500) {
          throw new Error('OpenAI service temporarily unavailable');
        }
      }
      
      throw new Error(`Failed to generate AI response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.client.embeddings.create({
        model: 'text-embedding-ada-002',
        input: text,
      });

      return response.data[0]?.embedding || [];
    } catch (error) {
      console.error('OpenAI embedding error:', error);
      throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async moderateContent(text: string): Promise<boolean> {
    try {
      const response = await this.client.moderations.create({
        input: text,
      });

      return response.results[0]?.flagged || false;
    } catch (error) {
      console.error('OpenAI moderation error:', error);
      // If moderation fails, err on the side of caution
      return false;
    }
  }
}