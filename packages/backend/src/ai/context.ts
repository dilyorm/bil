import { ConversationContext, DeviceContext, AIMessage } from './types';
import { MemoryStore } from './memory';
import { db } from '../database/connection';

export class ContextManager {
  private memoryStore: MemoryStore;

  constructor() {
    this.memoryStore = new MemoryStore();
  }

  async getContext(
    userId: string,
    conversationId?: string,
    deviceContext?: DeviceContext
  ): Promise<ConversationContext> {
    const client = await db.getClient();
    
    try {
      // Get user preferences
      const userResult = await client.query(
        'SELECT preferences FROM users WHERE id = $1',
        [userId]
      );

      const userPreferences = userResult.rows[0]?.preferences || {};

      // Get recent conversation history if conversationId provided
      let recentMessages: AIMessage[] = [];
      if (conversationId) {
        recentMessages = await this.memoryStore.getConversationHistory(conversationId, 10);
      }

      // Extract topics from recent messages
      const activeTopics = this.extractTopics(recentMessages);

      // Get recent activities (simplified - could be enhanced)
      const recentActivities = await this.getRecentActivities(userId);

      // Build context
      const context: ConversationContext = {
        userId,
        conversationId: conversationId || '',
        activeTopics,
        recentActivities,
        relevantFiles: [], // Will be populated by data integration service
        ...(deviceContext && { deviceContext }),
      };

      // Add user mood detection based on recent messages
      if (recentMessages.length > 0) {
        context.userMood = this.detectUserMood(recentMessages);
      }

      return context;
    } catch (error) {
      console.error('Error building context:', error);
      // Return minimal context on error
      return {
        userId,
        conversationId: conversationId || '',
        activeTopics: [],
        recentActivities: [],
        relevantFiles: [],
        ...(deviceContext && { deviceContext }),
      };
    } finally {
      client.release();
    }
  }

  private extractTopics(messages: AIMessage[]): string[] {
    const topics: Set<string> = new Set();
    
    // Simple keyword extraction - could be enhanced with NLP
    const topicKeywords = [
      'work', 'project', 'meeting', 'schedule', 'calendar',
      'weather', 'news', 'email', 'reminder', 'task',
      'health', 'exercise', 'food', 'travel', 'family',
      'music', 'movie', 'book', 'shopping', 'finance'
    ];

    messages.forEach(message => {
      const content = message.content.toLowerCase();
      topicKeywords.forEach(keyword => {
        if (content.includes(keyword)) {
          topics.add(keyword);
        }
      });
    });

    return Array.from(topics).slice(0, 5); // Limit to top 5 topics
  }

  private detectUserMood(messages: AIMessage[]): string {
    // Simple mood detection based on message content
    const recentUserMessages = messages
      .filter(m => m.role === 'user')
      .slice(-3); // Last 3 user messages

    if (recentUserMessages.length === 0) return 'neutral';

    const content = recentUserMessages.map(m => m.content.toLowerCase()).join(' ');

    // Positive indicators
    const positiveWords = ['great', 'good', 'happy', 'excited', 'awesome', 'wonderful', 'thanks', 'perfect'];
    const positiveCount = positiveWords.filter(word => content.includes(word)).length;

    // Negative indicators
    const negativeWords = ['bad', 'terrible', 'frustrated', 'angry', 'sad', 'worried', 'problem', 'issue'];
    const negativeCount = negativeWords.filter(word => content.includes(word)).length;

    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  private async getRecentActivities(userId: string): Promise<string[]> {
    const client = await db.getClient();
    
    try {
      // Get recent conversation topics as activities
      const result = await client.query(
        `SELECT DISTINCT 
           CASE 
             WHEN content ILIKE '%calendar%' OR content ILIKE '%meeting%' THEN 'calendar_management'
             WHEN content ILIKE '%email%' THEN 'email_management'
             WHEN content ILIKE '%file%' OR content ILIKE '%document%' THEN 'file_management'
             WHEN content ILIKE '%reminder%' OR content ILIKE '%task%' THEN 'task_management'
             ELSE 'general_conversation'
           END as activity
         FROM messages 
         WHERE user_id = $1 
         AND created_at > NOW() - INTERVAL '24 hours'
         AND role = 'user'
         LIMIT 5`,
        [userId]
      );

      return result.rows.map((row: any) => row.activity).filter(Boolean);
    } catch (error) {
      console.error('Error getting recent activities:', error);
      return [];
    } finally {
      client.release();
    }
  }

  async updateContext(
    userId: string,
    conversationId: string,
    updates: Partial<ConversationContext>
  ): Promise<void> {
    // Store context updates as memory entries
    if (updates.activeTopics) {
      await this.memoryStore.storeMemoryEntry({
        userId,
        conversationId,
        content: `Active topics: ${updates.activeTopics.join(', ')}`,
        type: 'context',
        relevanceScore: 0.8,
      });
    }

    if (updates.userMood) {
      await this.memoryStore.storeMemoryEntry({
        userId,
        conversationId,
        content: `User mood: ${updates.userMood}`,
        type: 'context',
        relevanceScore: 0.6,
      });
    }
  }

  async getRelevantContext(userId: string, query: string): Promise<string[]> {
    // Get relevant memories based on the query
    const memories = await this.memoryStore.getRelevantMemories(userId, query, 3);
    return memories.map(memory => memory.content);
  }
}