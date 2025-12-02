import { db } from '../connection';

export interface User {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  preferences: Record<string, any>;
  created_at: Date;
  updated_at: Date;
  last_active_at: Date;
}

export interface CreateUserData {
  email: string;
  name: string;
  password_hash: string;
  preferences?: Record<string, any>;
}

export interface UpdateUserData {
  name?: string;
  preferences?: Record<string, any>;
  last_active_at?: Date;
}

export class UserModel {
  static async create(userData: CreateUserData): Promise<User> {
    const query = `
      INSERT INTO users (email, name, password_hash, preferences)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    
    const values = [
      userData.email,
      userData.name,
      userData.password_hash,
      JSON.stringify(userData.preferences || {})
    ];

    const result = await db.query(query, values);
    return result.rows[0];
  }

  static async findById(id: string): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE id = $1';
    const result = await db.query(query, [id]);
    return result.rows[0] || null;
  }

  static async findByEmail(email: string): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE email = $1';
    const result = await db.query(query, [email]);
    return result.rows[0] || null;
  }

  static async update(id: string, updateData: UpdateUserData): Promise<User | null> {
    const fields = [];
    const values = [];
    let paramCount = 1;

    if (updateData.name !== undefined) {
      fields.push(`name = $${paramCount++}`);
      values.push(updateData.name);
    }

    if (updateData.preferences !== undefined) {
      fields.push(`preferences = $${paramCount++}`);
      values.push(JSON.stringify(updateData.preferences));
    }

    if (updateData.last_active_at !== undefined) {
      fields.push(`last_active_at = $${paramCount++}`);
      values.push(updateData.last_active_at);
    }

    if (fields.length === 0) {
      return await this.findById(id);
    }

    values.push(id);
    const query = `
      UPDATE users 
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await db.query(query, values);
    return result.rows[0] || null;
  }

  static async delete(id: string): Promise<boolean> {
    const query = 'DELETE FROM users WHERE id = $1';
    const result = await db.query(query, [id]);
    return result.rowCount > 0;
  }

  static async updateLastActive(id: string): Promise<void> {
    const query = 'UPDATE users SET last_active_at = NOW() WHERE id = $1';
    await db.query(query, [id]);
  }

  static async list(limit: number = 50, offset: number = 0): Promise<User[]> {
    const query = `
      SELECT * FROM users 
      ORDER BY created_at DESC 
      LIMIT $1 OFFSET $2
    `;
    const result = await db.query(query, [limit, offset]);
    return result.rows;
  }
}