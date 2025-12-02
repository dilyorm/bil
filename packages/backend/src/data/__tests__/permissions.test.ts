import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Pool } from 'pg';
import { PermissionManager } from '../permissions/manager';
import { DataSourceType, DataAccessRequest } from '../types';

// Mock pg
vi.mock('pg');

describe('PermissionManager', () => {
  let permissionManager: PermissionManager;
  let mockDb: Pool;

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb = {
      query: vi.fn(),
    } as any;

    permissionManager = new PermissionManager(mockDb);
  });

  describe('grantPermission', () => {
    const userId = 'user-123';
    const sourceType = DataSourceType.GOOGLE_CALENDAR;
    const permissions = ['read', 'write'];
    const purpose = 'Access calendar for scheduling';
    const consentVersion = '1.0';

    it('should grant permission successfully', async () => {
      const mockPermissionGrant = {
        id: 'perm-123',
        user_id: userId,
        source_type: sourceType,
        permissions,
        granted_at: new Date(),
        expires_at: null,
        is_active: true,
        consent_version: consentVersion,
      };

      vi.mocked(mockDb.query).mockResolvedValue({
        rows: [mockPermissionGrant],
        rowCount: 1,
      } as any);

      const result = await permissionManager.grantPermission(
        userId,
        sourceType,
        permissions,
        purpose,
        consentVersion
      );

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO data_source_permissions'),
        expect.arrayContaining([
          expect.any(String), // id
          userId,
          sourceType,
          permissions,
          expect.any(Date), // grantedAt
          undefined, // expiresAt
          purpose,
          consentVersion,
        ])
      );

      expect(result).toEqual({
        id: mockPermissionGrant.id,
        userId: mockPermissionGrant.user_id,
        sourceType: mockPermissionGrant.source_type,
        permissions: mockPermissionGrant.permissions,
        grantedAt: mockPermissionGrant.granted_at,
        expiresAt: mockPermissionGrant.expires_at,
        isActive: mockPermissionGrant.is_active,
        consentVersion: mockPermissionGrant.consent_version,
      });
    });

    it('should grant permission with expiration date', async () => {
      const expiresAt = new Date(Date.now() + 86400000); // 1 day from now
      const mockPermissionGrant = {
        id: 'perm-123',
        user_id: userId,
        source_type: sourceType,
        permissions,
        granted_at: new Date(),
        expires_at: expiresAt,
        is_active: true,
        consent_version: consentVersion,
      };

      vi.mocked(mockDb.query).mockResolvedValue({
        rows: [mockPermissionGrant],
        rowCount: 1,
      } as any);

      await permissionManager.grantPermission(
        userId,
        sourceType,
        permissions,
        purpose,
        consentVersion,
        expiresAt
      );

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO data_source_permissions'),
        expect.arrayContaining([
          expect.any(String),
          userId,
          sourceType,
          permissions,
          expect.any(Date),
          expiresAt,
          purpose,
          consentVersion,
        ])
      );
    });
  });

  describe('revokePermission', () => {
    const userId = 'user-123';
    const sourceType = DataSourceType.GOOGLE_CALENDAR;

    it('should revoke permission successfully', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({ rowCount: 1 } as any);

      await permissionManager.revokePermission(userId, sourceType);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE data_source_permissions'),
        [userId, sourceType]
      );
    });
  });

  describe('revokeAllPermissions', () => {
    const userId = 'user-123';

    it('should revoke all user permissions', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({ rowCount: 3 } as any);

      await permissionManager.revokeAllPermissions(userId);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE data_source_permissions'),
        [userId]
      );
    });
  });

  describe('hasPermission', () => {
    const userId = 'user-123';
    const sourceType = DataSourceType.GOOGLE_CALENDAR;
    const operation = 'read';

    it('should return true when user has specific permission', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({
        rows: [{ permissions: ['read', 'write'], expires_at: null }],
        rowCount: 1,
      } as any);

      const result = await permissionManager.hasPermission(userId, sourceType, operation);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT permissions, expires_at'),
        [userId, sourceType]
      );
      expect(result).toBe(true);
    });

    it('should return true when user has wildcard permission', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({
        rows: [{ permissions: ['*'], expires_at: null }],
        rowCount: 1,
      } as any);

      const result = await permissionManager.hasPermission(userId, sourceType, operation);

      expect(result).toBe(true);
    });

    it('should return false when user does not have permission', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({
        rows: [{ permissions: ['write'], expires_at: null }],
        rowCount: 1,
      } as any);

      const result = await permissionManager.hasPermission(userId, sourceType, operation);

      expect(result).toBe(false);
    });

    it('should return false when no permissions exist', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({
        rows: [],
        rowCount: 0,
      } as any);

      const result = await permissionManager.hasPermission(userId, sourceType, operation);

      expect(result).toBe(false);
    });

    it('should return false when permission is expired', async () => {
      // The query already filters out expired permissions, so this should return no rows
      vi.mocked(mockDb.query).mockResolvedValue({
        rows: [],
        rowCount: 0,
      } as any);

      const result = await permissionManager.hasPermission(userId, sourceType, operation);

      expect(result).toBe(false);
    });
  });

  describe('getUserPermissions', () => {
    const userId = 'user-123';

    it('should return user permissions', async () => {
      const mockPermissions = [
        {
          id: 'perm-1',
          user_id: userId,
          source_type: DataSourceType.GOOGLE_CALENDAR,
          permissions: ['read'],
          granted_at: new Date(),
          expires_at: null,
          is_active: true,
          consent_version: '1.0',
          purpose: 'Calendar access',
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 'perm-2',
          user_id: userId,
          source_type: DataSourceType.GOOGLE_DRIVE,
          permissions: ['read', 'write'],
          granted_at: new Date(),
          expires_at: new Date(Date.now() + 86400000),
          is_active: true,
          consent_version: '1.0',
          purpose: 'File access',
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      vi.mocked(mockDb.query).mockResolvedValue({
        rows: mockPermissions,
        rowCount: 2,
      } as any);

      const result = await permissionManager.getUserPermissions(userId);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT *'),
        [userId]
      );
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'perm-1',
        userId,
        sourceType: DataSourceType.GOOGLE_CALENDAR,
        permissions: ['read'],
        grantedAt: mockPermissions[0].granted_at,
        expiresAt: null,
        isActive: true,
        consentVersion: '1.0',
        purpose: 'Calendar access',
        createdAt: mockPermissions[0].created_at,
        updatedAt: mockPermissions[0].updated_at,
      });
    });
  });

  describe('getPermissionsBySourceType', () => {
    const userId = 'user-123';
    const sourceType = DataSourceType.GOOGLE_CALENDAR;

    it('should return permission for specific source type', async () => {
      const mockPermission = {
        id: 'perm-1',
        user_id: userId,
        source_type: sourceType,
        permissions: ['read'],
        granted_at: new Date(),
        expires_at: null,
        is_active: true,
        consent_version: '1.0',
        purpose: 'Calendar access',
        created_at: new Date(),
        updated_at: new Date(),
      };

      vi.mocked(mockDb.query).mockResolvedValue({
        rows: [mockPermission],
        rowCount: 1,
      } as any);

      const result = await permissionManager.getPermissionsBySourceType(userId, sourceType);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE user_id = $1'),
        [userId, sourceType]
      );
      expect(result).toEqual({
        id: 'perm-1',
        userId,
        sourceType,
        permissions: ['read'],
        grantedAt: mockPermission.granted_at,
        expiresAt: null,
        isActive: true,
        consentVersion: '1.0',
        purpose: 'Calendar access',
        createdAt: mockPermission.created_at,
        updatedAt: mockPermission.updated_at,
      });
    });

    it('should return null when no permission exists', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({
        rows: [],
        rowCount: 0,
      } as any);

      const result = await permissionManager.getPermissionsBySourceType(userId, sourceType);

      expect(result).toBeNull();
    });
  });

  describe('validateDataAccessRequest', () => {
    const request: DataAccessRequest = {
      userId: 'user-123',
      sourceType: DataSourceType.GOOGLE_CALENDAR,
      operation: 'read',
      resource: 'calendar',
      purpose: 'Get calendar events',
    };

    it('should validate request successfully when permission exists', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({
        rows: [{ permissions: ['read'], expires_at: null }],
        rowCount: 1,
      } as any);

      const result = await permissionManager.validateDataAccessRequest(request);

      expect(result).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT permissions, expires_at'),
        [request.userId, request.sourceType]
      );
    });

    it('should reject request and log when permission is denied', async () => {
      vi.mocked(mockDb.query)
        .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any) // hasPermission query
        .mockResolvedValueOnce({ rowCount: 1 } as any); // logDataAccess query

      const result = await permissionManager.validateDataAccessRequest(request);

      expect(result).toBe(false);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO data_access_logs'),
        expect.arrayContaining([
          request.userId,
          request.sourceType,
          request.operation,
          request.resource,
          false, // success
          undefined, // ipAddress
          undefined, // userAgent
          'Permission denied',
          undefined, // duration
        ])
      );
    });
  });

  describe('logDataAccess', () => {
    const logRequest = {
      userId: 'user-123',
      sourceType: DataSourceType.GOOGLE_CALENDAR,
      operation: 'read',
      resource: 'calendar',
      success: true,
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
      duration: 150,
    };

    it('should log data access successfully', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({ rowCount: 1 } as any);

      await permissionManager.logDataAccess(logRequest);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO data_access_logs'),
        [
          logRequest.userId,
          logRequest.sourceType,
          logRequest.operation,
          logRequest.resource,
          logRequest.success,
          logRequest.ipAddress,
          logRequest.userAgent,
          undefined, // error
          logRequest.duration,
        ]
      );
    });

    it('should log failed access with error message', async () => {
      const failedRequest = {
        ...logRequest,
        success: false,
        error: 'API rate limit exceeded',
      };

      vi.mocked(mockDb.query).mockResolvedValue({ rowCount: 1 } as any);

      await permissionManager.logDataAccess(failedRequest);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO data_access_logs'),
        expect.arrayContaining([
          failedRequest.userId,
          failedRequest.sourceType,
          failedRequest.operation,
          failedRequest.resource,
          false,
          failedRequest.ipAddress,
          failedRequest.userAgent,
          'API rate limit exceeded',
          failedRequest.duration,
        ])
      );
    });
  });

  describe('getDataAccessLogs', () => {
    const userId = 'user-123';

    it('should return data access logs for user', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          user_id: userId,
          source_type: DataSourceType.GOOGLE_CALENDAR,
          operation: 'read',
          resource: 'calendar',
          success: true,
          timestamp: new Date(),
          ip_address: '192.168.1.1',
          user_agent: 'Mozilla/5.0',
          error: null,
        },
        {
          id: 'log-2',
          user_id: userId,
          source_type: DataSourceType.GOOGLE_DRIVE,
          operation: 'search',
          resource: 'documents',
          success: false,
          timestamp: new Date(),
          ip_address: '192.168.1.1',
          user_agent: 'Mozilla/5.0',
          error: 'Permission denied',
        },
      ];

      vi.mocked(mockDb.query).mockResolvedValue({
        rows: mockLogs,
        rowCount: 2,
      } as any);

      const result = await permissionManager.getDataAccessLogs(userId);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT *'),
        [userId, 100, 0]
      );
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'log-1',
        userId,
        sourceType: DataSourceType.GOOGLE_CALENDAR,
        operation: 'read',
        resource: 'calendar',
        success: true,
        timestamp: mockLogs[0].timestamp,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        error: null,
      });
    });

    it('should filter logs by source type', async () => {
      const sourceType = DataSourceType.GOOGLE_CALENDAR;
      const mockLogs = [
        {
          id: 'log-1',
          user_id: userId,
          source_type: sourceType,
          operation: 'read',
          resource: 'calendar',
          success: true,
          timestamp: new Date(),
          ip_address: '192.168.1.1',
          user_agent: 'Mozilla/5.0',
          error: null,
        },
      ];

      vi.mocked(mockDb.query).mockResolvedValue({
        rows: mockLogs,
        rowCount: 1,
      } as any);

      const result = await permissionManager.getDataAccessLogs(userId, sourceType);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE user_id = $1'),
        [userId, sourceType, 100, 0]
      );
      expect(result).toHaveLength(1);
    });

    it('should support pagination', async () => {
      const limit = 50;
      const offset = 100;

      vi.mocked(mockDb.query).mockResolvedValue({
        rows: [],
        rowCount: 0,
      } as any);

      await permissionManager.getDataAccessLogs(userId, undefined, limit, offset);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT $2 OFFSET $3'),
        [userId, limit, offset]
      );
    });
  });

  describe('cleanupExpiredPermissions', () => {
    it('should cleanup expired permissions and return count', async () => {
      const expectedCount = 5;
      vi.mocked(mockDb.query).mockResolvedValue({ rowCount: expectedCount } as any);

      const result = await permissionManager.cleanupExpiredPermissions();

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE data_source_permissions')
      );
      expect(result).toBe(expectedCount);
    });

    it('should handle case when no permissions are expired', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({ rowCount: 0 } as any);

      const result = await permissionManager.cleanupExpiredPermissions();

      expect(result).toBe(0);
    });
  });

  describe('cleanupOldAccessLogs', () => {
    it('should cleanup old access logs with default retention', async () => {
      const expectedCount = 100;
      vi.mocked(mockDb.query).mockResolvedValue({ rowCount: expectedCount } as any);

      const result = await permissionManager.cleanupOldAccessLogs();

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM data_access_logs")
      );
      expect(result).toBe(expectedCount);
    });

    it('should cleanup old access logs with custom retention', async () => {
      const retentionDays = 30;
      const expectedCount = 50;
      vi.mocked(mockDb.query).mockResolvedValue({ rowCount: expectedCount } as any);

      const result = await permissionManager.cleanupOldAccessLogs(retentionDays);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM data_access_logs")
      );
      expect(result).toBe(expectedCount);
    });
  });

  describe('getPermissionStats', () => {
    const userId = 'user-123';

    it('should return permission statistics', async () => {
      const mockPermissionStats = {
        total: '10',
        active: '7',
        expired: '3',
      };
      const mockLogStats = {
        total: '500',
        successful: '450',
        failed: '50',
      };

      vi.mocked(mockDb.query)
        .mockResolvedValueOnce({ rows: [mockPermissionStats] } as any)
        .mockResolvedValueOnce({ rows: [mockLogStats] } as any);

      const result = await permissionManager.getPermissionStats(userId);

      expect(mockDb.query).toHaveBeenCalledTimes(2);
      expect(mockDb.query).toHaveBeenNthCalledWith(1,
        expect.stringContaining('SELECT'),
        [userId]
      );
      expect(mockDb.query).toHaveBeenNthCalledWith(2,
        expect.stringContaining('SELECT'),
        [userId]
      );

      expect(result).toEqual({
        totalPermissions: 10,
        activePermissions: 7,
        expiredPermissions: 3,
        totalAccessLogs: 500,
        successfulAccesses: 450,
        failedAccesses: 50,
      });
    });

    it('should handle empty statistics', async () => {
      const emptyStats = {
        total: '0',
        active: '0',
        expired: '0',
        successful: '0',
        failed: '0',
      };

      vi.mocked(mockDb.query)
        .mockResolvedValueOnce({ rows: [emptyStats] } as any)
        .mockResolvedValueOnce({ rows: [emptyStats] } as any);

      const result = await permissionManager.getPermissionStats(userId);

      expect(result).toEqual({
        totalPermissions: 0,
        activePermissions: 0,
        expiredPermissions: 0,
        totalAccessLogs: 0,
        successfulAccesses: 0,
        failedAccesses: 0,
      });
    });
  });
});