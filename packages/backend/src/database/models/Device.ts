import { db } from '../connection';

export type DeviceType = 'mobile' | 'desktop' | 'wearable' | 'web';

export interface Device {
  id: string;
  user_id: string;
  type: DeviceType;
  name: string;
  capabilities: Record<string, any>;
  connection_info: Record<string, any>;
  is_active: boolean;
  last_seen: Date;
  created_at: Date;
  updated_at: Date;
}

export interface CreateDeviceData {
  user_id: string;
  type: DeviceType;
  name: string;
  capabilities?: Record<string, any>;
  connection_info?: Record<string, any>;
}

export interface UpdateDeviceData {
  name?: string;
  capabilities?: Record<string, any>;
  connection_info?: Record<string, any>;
  is_active?: boolean;
  last_seen?: Date;
}

export class DeviceModel {
  static async create(deviceData: CreateDeviceData): Promise<Device> {
    const query = `
      INSERT INTO devices (user_id, type, name, capabilities, connection_info)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    
    const values = [
      deviceData.user_id,
      deviceData.type,
      deviceData.name,
      JSON.stringify(deviceData.capabilities || {}),
      JSON.stringify(deviceData.connection_info || {})
    ];

    const result = await db.query(query, values);
    return result.rows[0];
  }

  static async findById(id: string): Promise<Device | null> {
    const query = 'SELECT * FROM devices WHERE id = $1';
    const result = await db.query(query, [id]);
    return result.rows[0] || null;
  }

  static async findByUserId(userId: string): Promise<Device[]> {
    const query = 'SELECT * FROM devices WHERE user_id = $1 ORDER BY last_seen DESC';
    const result = await db.query(query, [userId]);
    return result.rows;
  }

  static async findActiveByUserId(userId: string): Promise<Device[]> {
    const query = `
      SELECT * FROM devices 
      WHERE user_id = $1 AND is_active = true 
      ORDER BY last_seen DESC
    `;
    const result = await db.query(query, [userId]);
    return result.rows;
  }

  static async update(id: string, updateData: UpdateDeviceData): Promise<Device | null> {
    const fields = [];
    const values = [];
    let paramCount = 1;

    if (updateData.name !== undefined) {
      fields.push(`name = $${paramCount++}`);
      values.push(updateData.name);
    }

    if (updateData.capabilities !== undefined) {
      fields.push(`capabilities = $${paramCount++}`);
      values.push(JSON.stringify(updateData.capabilities));
    }

    if (updateData.connection_info !== undefined) {
      fields.push(`connection_info = $${paramCount++}`);
      values.push(JSON.stringify(updateData.connection_info));
    }

    if (updateData.is_active !== undefined) {
      fields.push(`is_active = $${paramCount++}`);
      values.push(updateData.is_active);
    }

    if (updateData.last_seen !== undefined) {
      fields.push(`last_seen = $${paramCount++}`);
      values.push(updateData.last_seen);
    }

    if (fields.length === 0) {
      return await this.findById(id);
    }

    values.push(id);
    const query = `
      UPDATE devices 
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await db.query(query, values);
    return result.rows[0] || null;
  }

  static async updateLastSeen(id: string): Promise<void> {
    const query = 'UPDATE devices SET last_seen = NOW() WHERE id = $1';
    await db.query(query, [id]);
  }

  static async deactivate(id: string): Promise<boolean> {
    const query = 'UPDATE devices SET is_active = false WHERE id = $1';
    const result = await db.query(query, [id]);
    return result.rowCount > 0;
  }

  static async delete(id: string): Promise<boolean> {
    const query = 'DELETE FROM devices WHERE id = $1';
    const result = await db.query(query, [id]);
    return result.rowCount > 0;
  }

  static async deleteByUserId(userId: string): Promise<number> {
    const query = 'DELETE FROM devices WHERE user_id = $1';
    const result = await db.query(query, [userId]);
    return result.rowCount;
  }
}