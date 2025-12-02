import { db } from '../database/connection';
import { MemoryStore } from './memory';
import { ContextManager } from './context';
import { AIMessage, ConversationContext } from './types';
import { v4 as uuidv4 } from 'uuid';

export interface ConversationSearchOptions {
  query?: string;
  userId: string;
  limit?: number;
  offset?: number;
  dateFrom?: Date;
  dateTo?: Date;
  deviceType?: string;
  sortBy?: 'relevance' | 'date' | 'length';
  sortOrder?: 'asc' | 'desc';
}

export interface ConversationSummary {
  id: string;
  title?: string;
  messageCount: number;
  lastMessage: string;
  lastMessageAt: Date;
  createdAt: Date;
  participants: string[];
  topics: string[];
  sentiment?: 'positive' | 'negative' | 'neutral';
}

export interface ConversationAnalytics {
  totalConversations: number;
  totalMessages: number;
  averageMessagesPerConversation: number;
  mostActiveDevice: string;
  topTopics: Array<{ topic: string; count: number }>;
  conversationLengthDistribution: Array<{ range: string; count: number }>;
  timeDistribution: Array<{ hour: number; count: number }>;
}

export class ConversationService {
  private memoryStore: MemoryStore;
  private contextManager: ContextManager;

  constructor() {
    this.memoryStore = new MemoryStore();
    this.contextManager = new ContextManager();
  }

  /**
   * Search conversations with advanced filtering
   */
  async searchConversations(options: ConversationSearchOptions): Promise<{
    conversations: ConversationSummary[];
    total: number;
    hasMore: boolean;
  }> {
    const client = await db.getClient();
    const limit = options.limit || 20;
    const offset = options.offset || 0;

    try {
      let whereClause = 'WHERE c.user_id = $1';
      let params: any[] = [options.userId];
      let paramIndex = 2;

      // Add search query filter
      if (options.query) {
        whereClause += ` AND EXISTS (
          SELECT 1 FROM messages m 
          WHERE m.conversation_id = c.id 
          AND m.content ILIKE $${paramIndex}
        )`;
        params.push(`%${options.query}%`);
        paramIndex++;
      }

      // Add date filters
      if (options.dateFrom) {
        whereClause += ` AND c.created_at >= $${paramIndex}`;
        params.push(options.dateFrom);
        paramIndex++;
      }

      if (options.dateTo) {
        whereClause += ` AND c.created_at <= $${paramIndex}`;
        params.push(options.dateTo);
        paramIndex++;
      }

      // Add device type filter
      if (options.deviceType) {
        whereClause += ` AND EXISTS (
          SELECT 1 FROM messages m 
          JOIN devices d ON m.device_id = d.id 
          WHERE m.conversation_id = c.id 
          AND d.type = $${paramIndex}
        )`;
        params.push(options.deviceType);
        paramIndex++;
      }

      // Build ORDER BY clause
      let orderBy = 'ORDER BY c.updated_at DESC';
      if (options.sortBy === 'date') {
        orderBy = `ORDER BY c.created_at ${options.sortOrder || 'DESC'}`;
      } else if (options.sortBy === 'length') {
        orderBy = `ORDER BY message_count ${options.sortOrder || 'DESC'}`;
      }

      // Main query
      const query = `
        SELECT 
          c.id,
          c.title,
          c.created_at,
          c.updated_at,
          COUNT(m.id) as message_count,
          MAX(m.created_at) as last_message_at,
          (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
          ARRAY_AGG(DISTINCT d.type) FILTER (WHERE d.type IS NOT NULL) as device_types
        FROM conversations c
        LEFT JOIN messages m ON c.id = m.conversation_id
        LEFT JOIN devices d ON m.device_id = d.id
        ${whereClause}
        GROUP BY c.id, c.title, c.created_at, c.updated_at
        ${orderBy}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      params.push(limit, offset);

      const result = await client.query(query, params);

      // Get total count
      const countQuery = `
        SELECT COUNT(DISTINCT c.id) as total
        FROM conversations c
        LEFT JOIN messages m ON c.id = m.conversation_id
        LEFT JOIN devices d ON m.device_id = d.id
        ${whereClause}
      `;

      const countResult = await client.query(countQuery, params.slice(0, -2));
      const total = parseInt(countResult.rows[0].total);

      // Process results
      const conversations: ConversationSummary[] = await Promise.all(
        result.rows.map(async (row: any) => {
          // Extract topics for this conversation
          const topics = await this.extractConversationTopics(row.id);
          
          return {
            id: row.id,
            title: row.title || this.generateConversationTitle(row.last_message),
            messageCount: parseInt(row.message_count),
            lastMessage: row.last_message || '',
            lastMessageAt: row.last_message_at || row.updated_at,
            createdAt: row.created_at,
            participants: ['user', 'assistant'], // For now, always user and assistant
            topics,
            sentiment: await this.analyzeConversationSentiment(row.id),
          };
        })
      );

      return {
        conversations,
        total,
        hasMore: offset + limit < total,
      };

    } catch (error) {
      console.error('Error searching conversations:', error);
      throw new Error('Failed to search conversations');
    } finally {
      client.release();
    }
  }

  /**
   * Get detailed conversation analytics for a user
   */
  async getConversationAnalytics(userId: string, days: number = 30): Promise<ConversationAnalytics> {
    const client = await db.getClient();

    try {
      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - days);

      // Get basic stats
      const statsQuery = `
        SELECT 
          COUNT(DISTINCT c.id) as total_conversations,
          COUNT(m.id) as total_messages,
          AVG(msg_count.count) as avg_messages_per_conversation
        FROM conversations c
        LEFT JOIN messages m ON c.id = m.conversation_id
        LEFT JOIN (
          SELECT conversation_id, COUNT(*) as count
          FROM messages
          GROUP BY conversation_id
        ) msg_count ON c.id = msg_count.conversation_id
        WHERE c.user_id = $1 AND c.created_at >= $2
      `;

      const statsResult = await client.query(statsQuery, [userId, dateFrom]);
      const stats = statsResult.rows[0];

      // Get most active device
      const deviceQuery = `
        SELECT d.type, COUNT(m.id) as message_count
        FROM messages m
        JOIN devices d ON m.device_id = d.id
        JOIN conversations c ON m.conversation_id = c.id
        WHERE c.user_id = $1 AND m.created_at >= $2
        GROUP BY d.type
        ORDER BY message_count DESC
        LIMIT 1
      `;

      const deviceResult = await client.query(deviceQuery, [userId, dateFrom]);
      const mostActiveDevice = deviceResult.rows[0]?.type || 'unknown';

      // Get top topics (simplified - based on keyword frequency)
      const topicsQuery = `
        SELECT 
          unnest(string_to_array(lower(content), ' ')) as word,
          COUNT(*) as frequency
        FROM messages m
        JOIN conversations c ON m.conversation_id = c.id
        WHERE c.user_id = $1 
        AND m.created_at >= $2
        AND m.role = 'user'
        AND length(unnest(string_to_array(lower(content), ' '))) > 3
        GROUP BY word
        HAVING COUNT(*) > 2
        ORDER BY frequency DESC
        LIMIT 10
      `;

      const topicsResult = await client.query(topicsQuery, [userId, dateFrom]);
      const topTopics = topicsResult.rows.map((row: any) => ({
        topic: row.word,
        count: parseInt(row.frequency),
      }));

      // Get conversation length distribution
      const lengthQuery = `
        SELECT 
          CASE 
            WHEN msg_count <= 5 THEN '1-5'
            WHEN msg_count <= 10 THEN '6-10'
            WHEN msg_count <= 20 THEN '11-20'
            WHEN msg_count <= 50 THEN '21-50'
            ELSE '50+'
          END as range,
          COUNT(*) as count
        FROM (
          SELECT conversation_id, COUNT(*) as msg_count
          FROM messages m
          JOIN conversations c ON m.conversation_id = c.id
          WHERE c.user_id = $1 AND c.created_at >= $2
          GROUP BY conversation_id
        ) length_dist
        GROUP BY range
        ORDER BY 
          CASE range
            WHEN '1-5' THEN 1
            WHEN '6-10' THEN 2
            WHEN '11-20' THEN 3
            WHEN '21-50' THEN 4
            ELSE 5
          END
      `;

      const lengthResult = await client.query(lengthQuery, [userId, dateFrom]);
      const conversationLengthDistribution = lengthResult.rows.map((row: any) => ({
        range: row.range,
        count: parseInt(row.count),
      }));

      // Get time distribution (by hour)
      const timeQuery = `
        SELECT 
          EXTRACT(HOUR FROM created_at) as hour,
          COUNT(*) as count
        FROM messages m
        JOIN conversations c ON m.conversation_id = c.id
        WHERE c.user_id = $1 AND m.created_at >= $2
        GROUP BY EXTRACT(HOUR FROM created_at)
        ORDER BY hour
      `;

      const timeResult = await client.query(timeQuery, [userId, dateFrom]);
      const timeDistribution = timeResult.rows.map((row: any) => ({
        hour: parseInt(row.hour),
        count: parseInt(row.count),
      }));

      return {
        totalConversations: parseInt(stats.total_conversations) || 0,
        totalMessages: parseInt(stats.total_messages) || 0,
        averageMessagesPerConversation: parseFloat(stats.avg_messages_per_conversation) || 0,
        mostActiveDevice,
        topTopics,
        conversationLengthDistribution,
        timeDistribution,
      };

    } catch (error) {
      console.error('Error getting conversation analytics:', error);
      throw new Error('Failed to get conversation analytics');
    } finally {
      client.release();
    }
  }

  /**
   * Extract topics from a conversation using keyword analysis
   */
  private async extractConversationTopics(conversationId: string): Promise<string[]> {
    const client = await db.getClient();

    try {
      // Get all user messages from the conversation
      const result = await client.query(
        `SELECT content FROM messages 
         WHERE conversation_id = $1 AND role = 'user'
         ORDER BY created_at`,
        [conversationId]
      );

      if (result.rows.length === 0) return [];

      // Combine all messages
      const allContent = result.rows.map((row: any) => row.content).join(' ').toLowerCase();

      // Simple topic extraction based on common keywords
      const topicKeywords = {
        'work': ['work', 'job', 'office', 'meeting', 'project', 'deadline', 'colleague'],
        'health': ['health', 'doctor', 'medicine', 'exercise', 'diet', 'sleep', 'wellness'],
        'family': ['family', 'parent', 'child', 'spouse', 'sibling', 'relative'],
        'travel': ['travel', 'trip', 'vacation', 'flight', 'hotel', 'destination'],
        'food': ['food', 'restaurant', 'recipe', 'cooking', 'meal', 'dinner', 'lunch'],
        'technology': ['computer', 'software', 'app', 'phone', 'internet', 'tech'],
        'finance': ['money', 'budget', 'bank', 'investment', 'savings', 'expense'],
        'education': ['school', 'study', 'learn', 'course', 'education', 'university'],
        'entertainment': ['movie', 'music', 'game', 'book', 'show', 'entertainment'],
        'shopping': ['buy', 'shop', 'store', 'purchase', 'order', 'delivery'],
      };

      const detectedTopics: string[] = [];

      for (const [topic, keywords] of Object.entries(topicKeywords)) {
        const matchCount = keywords.filter(keyword => allContent.includes(keyword)).length;
        if (matchCount >= 2) { // Require at least 2 keyword matches
          detectedTopics.push(topic);
        }
      }

      return detectedTopics.slice(0, 5); // Return top 5 topics

    } catch (error) {
      console.error('Error extracting conversation topics:', error);
      return [];
    } finally {
      client.release();
    }
  }

  /**
   * Analyze conversation sentiment
   */
  private async analyzeConversationSentiment(conversationId: string): Promise<'positive' | 'negative' | 'neutral'> {
    const client = await db.getClient();

    try {
      // Get recent user messages
      const result = await client.query(
        `SELECT content FROM messages 
         WHERE conversation_id = $1 AND role = 'user'
         ORDER BY created_at DESC
         LIMIT 5`,
        [conversationId]
      );

      if (result.rows.length === 0) return 'neutral';

      const allContent = result.rows.map((row: any) => row.content).join(' ').toLowerCase();

      // Simple sentiment analysis based on keywords
      const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'happy', 'love', 'perfect', 'awesome', 'fantastic'];
      const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'horrible', 'sad', 'angry', 'frustrated', 'disappointed', 'annoying'];

      const positiveCount = positiveWords.filter(word => allContent.includes(word)).length;
      const negativeCount = negativeWords.filter(word => allContent.includes(word)).length;

      if (positiveCount > negativeCount) return 'positive';
      if (negativeCount > positiveCount) return 'negative';
      return 'neutral';

    } catch (error) {
      console.error('Error analyzing conversation sentiment:', error);
      return 'neutral';
    } finally {
      client.release();
    }
  }

  /**
   * Generate a conversation title from the last message
   */
  private generateConversationTitle(lastMessage: string): string {
    if (!lastMessage) return 'New Conversation';

    // Take first 50 characters and add ellipsis if needed
    const title = lastMessage.length > 50 
      ? lastMessage.substring(0, 47) + '...'
      : lastMessage;

    return title;
  }

  /**
   * Update conversation title
   */
  async updateConversationTitle(conversationId: string, userId: string, title: string): Promise<void> {
    const client = await db.getClient();

    try {
      await client.query(
        `UPDATE conversations 
         SET title = $1, updated_at = NOW() 
         WHERE id = $2 AND user_id = $3`,
        [title, conversationId, userId]
      );
    } catch (error) {
      console.error('Error updating conversation title:', error);
      throw new Error('Failed to update conversation title');
    } finally {
      client.release();
    }
  }

  /**
   * Delete conversation and all associated messages
   */
  async deleteConversation(conversationId: string, userId: string): Promise<void> {
    const client = await db.getClient();

    try {
      await client.query('BEGIN');

      // Delete messages first (due to foreign key constraints)
      await client.query(
        'DELETE FROM messages WHERE conversation_id = $1',
        [conversationId]
      );

      // Delete memory entries
      await client.query(
        'DELETE FROM memory_entries WHERE conversation_id = $1',
        [conversationId]
      );

      // Delete conversation
      const result = await client.query(
        'DELETE FROM conversations WHERE id = $1 AND user_id = $2',
        [conversationId, userId]
      );

      if (result.rowCount === 0) {
        throw new Error('Conversation not found or access denied');
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error deleting conversation:', error);
      throw new Error('Failed to delete conversation');
    } finally {
      client.release();
    }
  }

  /**
   * Get conversation context with enhanced relevance scoring
   */
  async getEnhancedContext(
    userId: string,
    conversationId: string,
    currentMessage: string
  ): Promise<ConversationContext> {
    // Get base context
    const context = await this.contextManager.getContext(userId, conversationId);

    // Enhance with relevant memories based on current message
    const relevantMemories = await this.memoryStore.getRelevantMemories(userId, currentMessage, 5);
    
    // Add relevant context from memories
    const relevantContext = relevantMemories.map(memory => memory.content);
    context.relevantFiles = relevantContext;

    // Update topics based on current message
    const messageTopics = await this.extractTopicsFromText(currentMessage);
    context.activeTopics = [...new Set([...context.activeTopics, ...messageTopics])].slice(0, 5);

    return context;
  }

  /**
   * Extract topics from a single text message
   */
  private async extractTopicsFromText(text: string): Promise<string[]> {
    const lowerText = text.toLowerCase();
    const topicKeywords = {
      'work': ['work', 'job', 'office', 'meeting', 'project'],
      'health': ['health', 'doctor', 'medicine', 'exercise'],
      'family': ['family', 'parent', 'child', 'spouse'],
      'travel': ['travel', 'trip', 'vacation', 'flight'],
      'food': ['food', 'restaurant', 'recipe', 'cooking'],
      'technology': ['computer', 'software', 'app', 'phone'],
      'finance': ['money', 'budget', 'bank', 'investment'],
      'education': ['school', 'study', 'learn', 'course'],
    };

    const detectedTopics: string[] = [];

    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      if (keywords.some(keyword => lowerText.includes(keyword))) {
        detectedTopics.push(topic);
      }
    }

    return detectedTopics;
  }
}