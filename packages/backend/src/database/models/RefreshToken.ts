import { db } from '../connection';
import bcrypt from 'bcryptjs';

export interface RefreshToken {
  id: string;
  user_id: string;
  device_id?: string;
  token_hash: string;
  expires_at: Date;
  created_at: Date;
  revoked_at?: Date;
}

export interface CreateRefreshTokenData {
  user_id: string;
  device_id?: string;
  token: string;
  expires_at: Date;
}

export class RefreshTokenModel {
  static async create(tokenData: CreateRefreshTokenData): Promise<RefreshToken> {
    // Hash the token before storing
    const tokenHash = await bcrypt.hash(tokenData.token, 10);

    const query = `
      INSERT INTO refresh_tokens (user_id, device_id, token_hash, expires_at)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    
    const values = [
      tokenData.user_id,
      tokenData.device_id || null,
      tokenHash,
      tokenData.expires_at
    ];

    const result = await db.query(query, values);
    return result.rows[0];
  }

  static async findByToken(token: string, userId: string): Promise<RefreshToken | null> {
    // Get all non-revoked tokens for the user
    const query = `
      SELECT * FROM refresh_tokens 
      WHERE user_id = $1 
        AND expires_at > NOW() 
        AND revoked_at IS NULL
      ORDER BY created_at DESC
    `;
    
    const result = await db.query(query, [userId]);
    
    // Check each token hash to find a match
    for (const tokenRecord of result.rows) {
      const isMatch = await bcrypt.compare(token, tokenRecord.token_hash);
      if (isMatch) {
        return tokenRecord;
      }
    }
    
    return null;
  }

  static async revokeToken(id: string): Promise<boolean> {
    const query = `
      UPDATE refresh_tokens 
      SET revoked_at = NOW() 
      WHERE id = $1 AND revoked_at IS NULL
    `;
    
    const result = await db.query(query, [id]);
    return result.rowCount > 0;
  }

  static async revokeAllUserTokens(userId: string): Promise<number> {
    const query = `
      UPDATE refresh_tokens 
      SET revoked_at = NOW() 
      WHERE user_id = $1 AND revoked_at IS NULL
    `;
    
    const result = await db.query(query, [userId]);
    return result.rowCount;
  }

  static async revokeDeviceTokens(deviceId: string): Promise<number> {
    const query = `
      UPDATE refresh_tokens 
      SET revoked_at = NOW() 
      WHERE device_id = $1 AND revoked_at IS NULL
    `;
    
    const result = await db.query(query, [deviceId]);
    return result.rowCount;
  }

  static async cleanupExpiredTokens(): Promise<number> {
    const query = `
      DELETE FROM refresh_tokens 
      WHERE expires_at < NOW() OR revoked_at < NOW() - INTERVAL '30 days'
    `;
    
    const result = await db.query(query);
    return result.rowCount;
  }

  static async getUserActiveTokens(userId: string): Promise<RefreshToken[]> {
    const query = `
      SELECT * FROM refresh_tokens 
      WHERE user_id = $1 
        AND expires_at > NOW() 
        AND revoked_at IS NULL
      ORDER BY created_at DESC
    `;
    
    const result = await db.query(query, [userId]);
    return result.rows;
  }
}