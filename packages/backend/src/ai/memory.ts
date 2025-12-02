import { db } from '../database/connection';
import { MemoryEntry, ConversationContext, AIMessage } from './types';
import { v4 as uuidv4 } from 'uuid';

export class MemoryStore {
  async storeInteraction(
    userId: string,
    conversationId: string,
    userMessage: string,
    aiResponse: string,
    deviceId?: string
  ): Promise<void> {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');

      // Store user message
      await client.query(
        `INSERT INTO messages (id, conversation_id, user_id, role, content, device_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [uuidv4(), conversationId, userId, 'user', userMessage, deviceId]
      );

      // Store AI response
      await client.query(
        `INSERT INTO messages (id, conversation_id, user_id, role, content, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [uuidv4(), conversationId, userId, 'assistant', aiResponse]
      );

      // Update conversation timestamp
      await client.query(
        `UPDATE conversations SET updated_at = NOW() WHERE id = $1`,
        [conversationId]
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error storing interaction:', error);
      throw new Error('Failed to store conversation interaction');
    } finally {
      client.release();
    }
  }

  async getRecentMessagesForUser(
    userId: string,
    limit: number = 50
  ): Promise<AIMessage[]> {
    const client = await db.getClient();

    try {
      const result = await client.query(
        `SELECT id, role, content, device_id, created_at, metadata
         FROM messages
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [userId, limit]
      );

      return result.rows.map((row: any) => ({
        id: row.id,
        role: row.role,
        content: row.content,
        timestamp: row.created_at,
        deviceId: row.device_id,
        metadata: row.metadata || {},
      })).reverse();
    } catch (error) {
      console.error('Error retrieving recent messages:', error);
      throw new Error('Failed to retrieve recent messages');
    } finally {
      client.release();
    }
  }

  async getConversationHistory(
    conversationId: string,
    limit: number = 20
  ): Promise<AIMessage[]> {
    const client = await db.getClient();
    
    try {
      const result = await client.query(
        `SELECT id, role, content, device_id, created_at, metadata
         FROM messages 
         WHERE conversation_id = $1 
         ORDER BY created_at DESC 
         LIMIT $2`,
        [conversationId, limit]
      );

      return result.rows.map((row: any) => ({
        id: row.id,
        role: row.role,
        content: row.content,
        timestamp: row.created_at,
        deviceId: row.device_id,
        metadata: row.metadata || {},
      })).reverse(); // Return in chronological order
    } catch (error) {
      console.error('Error retrieving conversation history:', error);
      throw new Error('Failed to retrieve conversation history');
    } finally {
      client.release();
    }
  }

  async createConversation(userId: string): Promise<string> {
    const client = await db.getClient();
    const conversationId = uuidv4();
    
    try {
      await client.query(
        `INSERT INTO conversations (id, user_id, created_at, updated_at)
         VALUES ($1, $2, NOW(), NOW())`,
        [conversationId, userId]
      );

      return conversationId;
    } catch (error) {
      console.error('Error creating conversation:', error);
      throw new Error('Failed to create conversation');
    } finally {
      client.release();
    }
  }

  async getUserConversations(userId: string, limit: number = 10): Promise<any[]> {
    const client = await db.getClient();
    
    try {
      const result = await client.query(
        `SELECT c.id, c.created_at, c.updated_at,
                (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message
         FROM conversations c
         WHERE c.user_id = $1
         ORDER BY c.updated_at DESC
         LIMIT $2`,
        [userId, limit]
      );

      return result.rows;
    } catch (error) {
      console.error('Error retrieving user conversations:', error);
      throw new Error('Failed to retrieve user conversations');
    } finally {
      client.release();
    }
  }

  async storeMemoryEntry(entry: Omit<MemoryEntry, 'id' | 'timestamp'>): Promise<string> {
    const client = await db.getClient();
    const entryId = uuidv4();
    
    try {
      await client.query(
        `INSERT INTO memory_entries (id, user_id, conversation_id, content, type, relevance_score, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [entryId, entry.userId, entry.conversationId, entry.content, entry.type, entry.relevanceScore || 0]
      );

      return entryId;
    } catch (error) {
      console.error('Error storing memory entry:', error);
      throw new Error('Failed to store memory entry');
    } finally {
      client.release();
    }
  }

  async getRelevantMemories(
    userId: string,
    query: string,
    limit: number = 5
  ): Promise<MemoryEntry[]> {
    const client = await db.getClient();
    
    try {
      // Simple text-based relevance for now - could be enhanced with embeddings
      const result = await client.query(
        `SELECT id, user_id, conversation_id, content, type, relevance_score, created_at
         FROM memory_entries
         WHERE user_id = $1 
         AND (content ILIKE $2 OR content ILIKE $3)
         ORDER BY relevance_score DESC, created_at DESC
         LIMIT $4`,
        [userId, `%${query}%`, `%${query.toLowerCase()}%`, limit]
      );

      return result.rows.map((row: any) => ({
        id: row.id,
        userId: row.user_id,
        conversationId: row.conversation_id,
        content: row.content,
        type: row.type,
        timestamp: row.created_at,
        relevanceScore: row.relevance_score,
      }));
    } catch (error) {
      console.error('Error retrieving relevant memories:', error);
      return []; // Return empty array on error to not break the flow
    } finally {
      client.release();
    }
  }

  async updateRelevanceScore(entryId: string, score: number): Promise<void> {
    const client = await db.getClient();
    
    try {
      await client.query(
        `UPDATE memory_entries SET relevance_score = $1 WHERE id = $2`,
        [score, entryId]
      );
    } catch (error) {
      console.error('Error updating relevance score:', error);
      // Don't throw error as this is not critical
    } finally {
      client.release();
    }
  }
}