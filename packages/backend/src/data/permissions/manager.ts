import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { DataSourceType, DataAccessRequest, DataAccessLog, PermissionGrant } from '../types';
import { DataSourcePermission } from '../../database/models/DataSource';

export class PermissionManager {
  constructor(private db: Pool) {}

  async grantPermission(
    userId: string,
    sourceType: DataSourceType,
    permissions: string[],
    purpose: string,
    consentVersion: string,
    expiresAt?: Date
  ): Promise<PermissionGrant> {
    const id = uuidv4();
    const grantedAt = new Date();

    const query = `
      INSERT INTO data_source_permissions 
      (id, user_id, source_type, permissions, granted_at, expires_at, purpose, consent_version)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const values = [
      id,
      userId,
      sourceType,
      permissions,
      grantedAt,
      expiresAt,
      purpose,
      consentVersion,
    ];

    const result = await this.db.query(query, values);
    const row = result.rows[0];

    return {
      id: row.id,
      userId: row.user_id,
      sourceType: row.source_type,
      permissions: row.permissions,
      grantedAt: row.granted_at,
      expiresAt: row.expires_at,
      isActive: row.is_active,
      consentVersion: row.consent_version,
    };
  }

  async revokePermission(userId: string, sourceType: DataSourceType): Promise<void> {
    const query = `
      UPDATE data_source_permissions 
      SET is_active = false, updated_at = NOW()
      WHERE user_id = $1 AND source_type = $2 AND is_active = true
    `;

    await this.db.query(query, [userId, sourceType]);
  }

  async revokeAllPermissions(userId: string): Promise<void> {
    const query = `
      UPDATE data_source_permissions 
      SET is_active = false, updated_at = NOW()
      WHERE user_id = $1 AND is_active = true
    `;

    await this.db.query(query, [userId]);
  }

  async hasPermission(
    userId: string,
    sourceType: DataSourceType,
    operation: string
  ): Promise<boolean> {
    const query = `
      SELECT permissions, expires_at
      FROM data_source_permissions
      WHERE user_id = $1 
        AND source_type = $2 
        AND is_active = true
        AND (expires_at IS NULL OR expires_at > NOW())
    `;

    const result = await this.db.query(query, [userId, sourceType]);
    
    if (result.rows.length === 0) {
      return false;
    }

    const permissions = result.rows[0].permissions;
    return permissions.includes(operation) || permissions.includes('*');
  }

  async getUserPermissions(userId: string): Promise<DataSourcePermission[]> {
    const query = `
      SELECT *
      FROM data_source_permissions
      WHERE user_id = $1 AND is_active = true
      ORDER BY granted_at DESC
    `;

    const result = await this.db.query(query, [userId]);
    
    return result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      sourceType: row.source_type,
      permissions: row.permissions,
      grantedAt: row.granted_at,
      expiresAt: row.expires_at,
      isActive: row.is_active,
      consentVersion: row.consent_version,
      purpose: row.purpose,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async getPermissionsBySourceType(
    userId: string,
    sourceType: DataSourceType
  ): Promise<DataSourcePermission | null> {
    const query = `
      SELECT *
      FROM data_source_permissions
      WHERE user_id = $1 
        AND source_type = $2 
        AND is_active = true
        AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY granted_at DESC
      LIMIT 1
    `;

    const result = await this.db.query(query, [userId, sourceType]);
    
    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      sourceType: row.source_type,
      permissions: row.permissions,
      grantedAt: row.granted_at,
      expiresAt: row.expires_at,
      isActive: row.is_active,
      consentVersion: row.consent_version,
      purpose: row.purpose,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async validateDataAccessRequest(request: DataAccessRequest): Promise<boolean> {
    // Check if user has permission for this operation
    const hasPermission = await this.hasPermission(
      request.userId,
      request.sourceType,
      request.operation
    );

    if (!hasPermission) {
      await this.logDataAccess({
        ...request,
        success: false,
        error: 'Permission denied',
      });
      return false;
    }

    return true;
  }

  async logDataAccess(
    request: DataAccessRequest & { 
      success: boolean; 
      error?: string; 
      ipAddress?: string; 
      userAgent?: string;
      duration?: number;
    }
  ): Promise<void> {
    const query = `
      INSERT INTO data_access_logs 
      (user_id, source_type, operation, resource, success, ip_address, user_agent, error, duration)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `;

    const values = [
      request.userId,
      request.sourceType,
      request.operation,
      request.resource,
      request.success,
      request.ipAddress,
      request.userAgent,
      request.error,
      request.duration,
    ];

    await this.db.query(query, values);
  }

  async getDataAccessLogs(
    userId: string,
    sourceType?: DataSourceType,
    limit: number = 100,
    offset: number = 0
  ): Promise<DataAccessLog[]> {
    let query = `
      SELECT *
      FROM data_access_logs
      WHERE user_id = $1
    `;
    
    const values: any[] = [userId];

    if (sourceType) {
      query += ` AND source_type = $2`;
      values.push(sourceType);
    }

    query += ` ORDER BY timestamp DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
    values.push(limit, offset);

    const result = await this.db.query(query, values);
    
    return result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      sourceType: row.source_type,
      operation: row.operation,
      resource: row.resource,
      success: row.success,
      timestamp: row.timestamp,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      error: row.error,
    }));
  }

  async cleanupExpiredPermissions(): Promise<number> {
    const query = `
      UPDATE data_source_permissions 
      SET is_active = false, updated_at = NOW()
      WHERE expires_at < NOW() AND is_active = true
      RETURNING id
    `;

    const result = await this.db.query(query);
    return result.rowCount || 0;
  }

  async cleanupOldAccessLogs(retentionDays: number = 90): Promise<number> {
    const query = `
      DELETE FROM data_access_logs
      WHERE timestamp < NOW() - INTERVAL '${retentionDays} days'
    `;

    const result = await this.db.query(query);
    return result.rowCount || 0;
  }

  async getPermissionStats(userId: string): Promise<{
    totalPermissions: number;
    activePermissions: number;
    expiredPermissions: number;
    totalAccessLogs: number;
    successfulAccesses: number;
    failedAccesses: number;
  }> {
    const permissionsQuery = `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN is_active = true AND (expires_at IS NULL OR expires_at > NOW()) THEN 1 END) as active,
        COUNT(CASE WHEN expires_at < NOW() THEN 1 END) as expired
      FROM data_source_permissions
      WHERE user_id = $1
    `;

    const logsQuery = `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN success = true THEN 1 END) as successful,
        COUNT(CASE WHEN success = false THEN 1 END) as failed
      FROM data_access_logs
      WHERE user_id = $1
    `;

    const [permissionsResult, logsResult] = await Promise.all([
      this.db.query(permissionsQuery, [userId]),
      this.db.query(logsQuery, [userId]),
    ]);

    const permissions = permissionsResult.rows[0];
    const logs = logsResult.rows[0];

    return {
      totalPermissions: parseInt(permissions.total),
      activePermissions: parseInt(permissions.active),
      expiredPermissions: parseInt(permissions.expired),
      totalAccessLogs: parseInt(logs.total),
      successfulAccesses: parseInt(logs.successful),
      failedAccesses: parseInt(logs.failed),
    };
  }
}