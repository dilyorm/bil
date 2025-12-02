import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Pool } from 'pg';
import { DataIntegrationService } from '../service';
import { DataSourceType, DataSourceCredentials, CalendarEvent, FileItem } from '../types';
import { ConnectorRegistry } from '../connectors/registry';
import { PermissionManager } from '../permissions/manager';

// Mock dependencies
vi.mock('../connectors/registry');
vi.mock('../permissions/manager');
vi.mock('pg');

describe('DataIntegrationService', () => {
  let service: DataIntegrationService;
  let mockDb: Pool;
  let mockConnectorRegistry: ConnectorRegistry;
  let mockPermissionManager: PermissionManager;
  let mockConnector: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock database pool
    mockDb = {
      query: vi.fn(),
    } as any;

    // Mock connector registry
    mockConnectorRegistry = {
      createConnectorInstance: vi.fn(),
    } as any;
    vi.mocked(ConnectorRegistry.getInstance).mockReturnValue(mockConnectorRegistry);

    // Mock permission manager
    mockPermissionManager = {
      validateDataAccessRequest: vi.fn(),
      logDataAccess: vi.fn(),
      grantPermission: vi.fn(),
      revokePermission: vi.fn(),
      getUserPermissions: vi.fn(),
      getDataAccessLogs: vi.fn(),
      getPermissionStats: vi.fn(),
      cleanupExpiredPermissions: vi.fn(),
      cleanupOldAccessLogs: vi.fn(),
    } as any;
    vi.mocked(PermissionManager).mockImplementation(() => mockPermissionManager);

    // Mock connector
    mockConnector = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      testConnection: vi.fn(),
      type: DataSourceType.GOOGLE_CALENDAR,
      getEvents: vi.fn(),
      searchFiles: vi.fn(),
      getFileContent: vi.fn(),
    };

    service = new DataIntegrationService(mockDb);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('connectDataSource', () => {
    const userId = 'user-123';
    const sourceType = DataSourceType.GOOGLE_CALENDAR;
    const credentials: DataSourceCredentials = {
      type: sourceType,
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      clientId: 'client-id',
      clientSecret: 'client-secret',
    };

    it('should connect data source successfully and log access', async () => {
      // Mock successful connection
      vi.mocked(mockConnectorRegistry.createConnectorInstance).mockReturnValue(mockConnector);
      vi.mocked(mockConnector.connect).mockResolvedValue(undefined);
      
      // Mock database operations
      const mockDataSource = {
        id: 'source-123',
        user_id: userId,
        type: sourceType,
        name: 'Google Calendar',
        credentials,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
        last_sync_at: null,
      };
      
      vi.mocked(mockDb.query).mockResolvedValue({
        rows: [mockDataSource],
        rowCount: 1,
      } as any);

      const result = await service.connectDataSource(userId, sourceType, credentials);

      expect(mockConnectorRegistry.createConnectorInstance).toHaveBeenCalledWith(sourceType);
      expect(mockConnector.connect).toHaveBeenCalledWith(credentials);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO data_sources'),
        expect.arrayContaining([expect.any(String), userId, sourceType, 'Google Calendar', JSON.stringify(credentials)])
      );
      expect(mockPermissionManager.logDataAccess).toHaveBeenCalledWith({
        userId,
        sourceType,
        operation: 'connect',
        resource: sourceType,
        purpose: 'Data source connection',
        success: true,
        duration: expect.any(Number),
      });
      expect(result).toEqual({
        id: mockDataSource.id,
        userId: mockDataSource.user_id,
        type: mockDataSource.type,
        name: mockDataSource.name,
        credentials: mockDataSource.credentials,
        isActive: mockDataSource.is_active,
        createdAt: mockDataSource.created_at,
        updatedAt: mockDataSource.updated_at,
        lastSyncAt: mockDataSource.last_sync_at,
      });
    });

    it('should handle connection failure and log error', async () => {
      const connectionError = new Error('Invalid credentials');
      
      vi.mocked(mockConnectorRegistry.createConnectorInstance).mockReturnValue(mockConnector);
      vi.mocked(mockConnector.connect).mockRejectedValue(connectionError);

      await expect(service.connectDataSource(userId, sourceType, credentials))
        .rejects.toThrow('Invalid credentials');

      expect(mockPermissionManager.logDataAccess).toHaveBeenCalledWith({
        userId,
        sourceType,
        operation: 'connect',
        resource: sourceType,
        purpose: 'Data source connection',
        success: false,
        error: 'Invalid credentials',
        duration: expect.any(Number),
      });
    });

    it('should use custom name when provided', async () => {
      const customName = 'My Work Calendar';
      
      vi.mocked(mockConnectorRegistry.createConnectorInstance).mockReturnValue(mockConnector);
      vi.mocked(mockConnector.connect).mockResolvedValue(undefined);
      vi.mocked(mockDb.query).mockResolvedValue({
        rows: [{ id: 'source-123', name: customName }],
        rowCount: 1,
      } as any);

      await service.connectDataSource(userId, sourceType, credentials, customName);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO data_sources'),
        expect.arrayContaining([expect.any(String), userId, sourceType, customName, JSON.stringify(credentials)])
      );
    });
  });

  describe('disconnectDataSource', () => {
    const userId = 'user-123';
    const sourceType = DataSourceType.GOOGLE_CALENDAR;

    it('should disconnect data source successfully and log access', async () => {
      vi.mocked(mockDb.query).mockResolvedValue({ rowCount: 1 } as any);
      vi.mocked(mockPermissionManager.revokePermission).mockResolvedValue();

      await service.disconnectDataSource(userId, sourceType);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE data_sources'),
        [userId, sourceType]
      );
      expect(mockPermissionManager.revokePermission).toHaveBeenCalledWith(userId, sourceType);
      expect(mockPermissionManager.logDataAccess).toHaveBeenCalledWith({
        userId,
        sourceType,
        operation: 'disconnect',
        resource: sourceType,
        purpose: 'Data source disconnection',
        success: true,
        duration: expect.any(Number),
      });
    });

    it('should handle disconnection failure and log error', async () => {
      const dbError = new Error('Database error');
      vi.mocked(mockDb.query).mockRejectedValue(dbError);

      await expect(service.disconnectDataSource(userId, sourceType))
        .rejects.toThrow('Database error');

      expect(mockPermissionManager.logDataAccess).toHaveBeenCalledWith({
        userId,
        sourceType,
        operation: 'disconnect',
        resource: sourceType,
        purpose: 'Data source disconnection',
        success: false,
        error: 'Database error',
        duration: expect.any(Number),
      });
    });
  });

  describe('getCalendarEvents', () => {
    const userId = 'user-123';
    const calendarId = 'primary';
    const mockEvents: CalendarEvent[] = [
      {
        id: 'event-1',
        title: 'Meeting',
        description: 'Team meeting',
        startTime: new Date('2024-01-01T10:00:00Z'),
        endTime: new Date('2024-01-01T11:00:00Z'),
        location: 'Conference Room',
        attendees: ['user@example.com'],
        isAllDay: false,
      },
    ];

    it('should get calendar events successfully with permission validation', async () => {
      // Mock permission validation
      vi.mocked(mockPermissionManager.validateDataAccessRequest).mockResolvedValue(true);
      
      // Mock connector retrieval
      vi.mocked(mockDb.query).mockResolvedValue({
        rows: [{ credentials: { accessToken: 'token' } }],
        rowCount: 1,
      } as any);
      vi.mocked(mockConnectorRegistry.createConnectorInstance).mockReturnValue(mockConnector);
      vi.mocked(mockConnector.connect).mockResolvedValue(undefined);
      vi.mocked(mockConnector.getEvents).mockResolvedValue(mockEvents);

      const result = await service.getCalendarEvents(userId, calendarId);

      expect(mockPermissionManager.validateDataAccessRequest).toHaveBeenCalledWith({
        userId,
        sourceType: DataSourceType.GOOGLE_CALENDAR,
        operation: 'read',
        resource: calendarId,
        purpose: 'Retrieve calendar events',
      });
      expect(mockConnector.getEvents).toHaveBeenCalledWith(calendarId, undefined, undefined);
      expect(mockPermissionManager.logDataAccess).toHaveBeenCalledWith({
        userId,
        sourceType: DataSourceType.GOOGLE_CALENDAR,
        operation: 'read',
        resource: calendarId,
        purpose: 'Retrieve calendar events',
        success: true,
        duration: expect.any(Number),
      });
      expect(result).toEqual(mockEvents);
    });

    it('should reject access when permission is denied', async () => {
      vi.mocked(mockPermissionManager.validateDataAccessRequest).mockResolvedValue(false);

      await expect(service.getCalendarEvents(userId, calendarId))
        .rejects.toThrow('Permission denied for calendar access');

      expect(mockPermissionManager.validateDataAccessRequest).toHaveBeenCalled();
      expect(mockConnector.getEvents).not.toHaveBeenCalled();
    });

    it('should handle connector not found error', async () => {
      vi.mocked(mockPermissionManager.validateDataAccessRequest).mockResolvedValue(true);
      vi.mocked(mockDb.query).mockResolvedValue({ rows: [], rowCount: 0 } as any);

      await expect(service.getCalendarEvents(userId, calendarId))
        .rejects.toThrow('Google Calendar not connected');

      expect(mockPermissionManager.logDataAccess).toHaveBeenCalledWith({
        userId,
        sourceType: DataSourceType.GOOGLE_CALENDAR,
        operation: 'read',
        resource: calendarId,
        purpose: 'Retrieve calendar events',
        success: false,
        error: 'Google Calendar not connected',
        duration: expect.any(Number),
      });
    });

    it('should handle API errors and log them', async () => {
      const apiError = new Error('API rate limit exceeded');
      
      vi.mocked(mockPermissionManager.validateDataAccessRequest).mockResolvedValue(true);
      vi.mocked(mockDb.query).mockResolvedValue({
        rows: [{ credentials: { accessToken: 'token' } }],
        rowCount: 1,
      } as any);
      vi.mocked(mockConnectorRegistry.createConnectorInstance).mockReturnValue(mockConnector);
      vi.mocked(mockConnector.connect).mockResolvedValue(undefined);
      vi.mocked(mockConnector.getEvents).mockRejectedValue(apiError);

      await expect(service.getCalendarEvents(userId, calendarId))
        .rejects.toThrow('API rate limit exceeded');

      expect(mockPermissionManager.logDataAccess).toHaveBeenCalledWith({
        userId,
        sourceType: DataSourceType.GOOGLE_CALENDAR,
        operation: 'read',
        resource: calendarId,
        purpose: 'Retrieve calendar events',
        success: false,
        error: 'API rate limit exceeded',
        duration: expect.any(Number),
      });
    });
  });

  describe('searchFiles', () => {
    const userId = 'user-123';
    const sourceType = DataSourceType.GOOGLE_DRIVE;
    const query = 'test document';
    const mockFiles: FileItem[] = [
      {
        id: 'file-1',
        name: 'test-document.pdf',
        path: '/documents',
        type: 'file',
        size: 1024,
        mimeType: 'application/pdf',
        modifiedAt: new Date('2024-01-01T10:00:00Z'),
        createdAt: new Date('2024-01-01T09:00:00Z'),
      },
    ];

    it('should search files successfully with permission validation', async () => {
      vi.mocked(mockPermissionManager.validateDataAccessRequest).mockResolvedValue(true);
      vi.mocked(mockDb.query).mockResolvedValue({
        rows: [{ credentials: { accessToken: 'token' } }],
        rowCount: 1,
      } as any);
      vi.mocked(mockConnectorRegistry.createConnectorInstance).mockReturnValue(mockConnector);
      vi.mocked(mockConnector.connect).mockResolvedValue(undefined);
      vi.mocked(mockConnector.searchFiles).mockResolvedValue(mockFiles);

      const result = await service.searchFiles(userId, sourceType, query);

      expect(mockPermissionManager.validateDataAccessRequest).toHaveBeenCalledWith({
        userId,
        sourceType,
        operation: 'search',
        resource: query,
        purpose: 'Search files',
      });
      expect(mockConnector.searchFiles).toHaveBeenCalledWith(query);
      expect(mockPermissionManager.logDataAccess).toHaveBeenCalledWith({
        userId,
        sourceType,
        operation: 'search',
        resource: query,
        purpose: 'Search files',
        success: true,
        duration: expect.any(Number),
      });
      expect(result).toEqual(mockFiles);
    });

    it('should reject search when permission is denied', async () => {
      vi.mocked(mockPermissionManager.validateDataAccessRequest).mockResolvedValue(false);

      await expect(service.searchFiles(userId, sourceType, query))
        .rejects.toThrow(`Permission denied for ${sourceType} access`);

      expect(mockPermissionManager.validateDataAccessRequest).toHaveBeenCalled();
      expect(mockConnector.searchFiles).not.toHaveBeenCalled();
    });

    it('should handle unsupported search operation', async () => {
      const connectorWithoutSearch = { ...mockConnector };
      delete connectorWithoutSearch.searchFiles;

      vi.mocked(mockPermissionManager.validateDataAccessRequest).mockResolvedValue(true);
      vi.mocked(mockDb.query).mockResolvedValue({
        rows: [{ credentials: { accessToken: 'token' } }],
        rowCount: 1,
      } as any);
      vi.mocked(mockConnectorRegistry.createConnectorInstance).mockReturnValue(connectorWithoutSearch);
      vi.mocked(connectorWithoutSearch.connect).mockResolvedValue(undefined);

      await expect(service.searchFiles(userId, sourceType, query))
        .rejects.toThrow(`Search not supported for ${sourceType}`);

      expect(mockPermissionManager.logDataAccess).toHaveBeenCalledWith({
        userId,
        sourceType,
        operation: 'search',
        resource: query,
        purpose: 'Search files',
        success: false,
        error: `Search not supported for ${sourceType}`,
        duration: expect.any(Number),
      });
    });
  });

  describe('getFileContent', () => {
    const userId = 'user-123';
    const sourceType = DataSourceType.GOOGLE_DRIVE;
    const fileId = 'file-123';
    const mockContent = Buffer.from('file content');

    it('should get file content successfully with permission validation', async () => {
      vi.mocked(mockPermissionManager.validateDataAccessRequest).mockResolvedValue(true);
      vi.mocked(mockDb.query).mockResolvedValue({
        rows: [{ credentials: { accessToken: 'token' } }],
        rowCount: 1,
      } as any);
      vi.mocked(mockConnectorRegistry.createConnectorInstance).mockReturnValue(mockConnector);
      vi.mocked(mockConnector.connect).mockResolvedValue(undefined);
      vi.mocked(mockConnector.getFileContent).mockResolvedValue(mockContent);

      const result = await service.getFileContent(userId, sourceType, fileId);

      expect(mockPermissionManager.validateDataAccessRequest).toHaveBeenCalledWith({
        userId,
        sourceType,
        operation: 'read',
        resource: fileId,
        purpose: 'Read file content',
      });
      expect(mockConnector.getFileContent).toHaveBeenCalledWith(fileId);
      expect(mockPermissionManager.logDataAccess).toHaveBeenCalledWith({
        userId,
        sourceType,
        operation: 'read',
        resource: fileId,
        purpose: 'Read file content',
        success: true,
        duration: expect.any(Number),
      });
      expect(result).toEqual(mockContent);
    });

    it('should reject file access when permission is denied', async () => {
      vi.mocked(mockPermissionManager.validateDataAccessRequest).mockResolvedValue(false);

      await expect(service.getFileContent(userId, sourceType, fileId))
        .rejects.toThrow(`Permission denied for ${sourceType} access`);

      expect(mockPermissionManager.validateDataAccessRequest).toHaveBeenCalled();
      expect(mockConnector.getFileContent).not.toHaveBeenCalled();
    });
  });

  describe('getUserDataSources', () => {
    const userId = 'user-123';

    it('should return user data sources', async () => {
      const mockDataSources = [
        {
          id: 'source-1',
          user_id: userId,
          type: DataSourceType.GOOGLE_CALENDAR,
          name: 'Google Calendar',
          credentials: { accessToken: 'token' },
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
          last_sync_at: null,
        },
      ];

      vi.mocked(mockDb.query).mockResolvedValue({
        rows: mockDataSources,
        rowCount: 1,
      } as any);

      const result = await service.getUserDataSources(userId);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT *'),
        [userId]
      );
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'source-1',
        userId,
        type: DataSourceType.GOOGLE_CALENDAR,
        name: 'Google Calendar',
        credentials: { accessToken: 'token' },
        isActive: true,
        createdAt: mockDataSources[0].created_at,
        updatedAt: mockDataSources[0].updated_at,
        lastSyncAt: null,
      });
    });
  });

  describe('permission management', () => {
    const userId = 'user-123';
    const sourceType = DataSourceType.GOOGLE_CALENDAR;

    it('should grant data permission', async () => {
      const permissions = ['read', 'write'];
      const purpose = 'Access calendar for scheduling';
      const expiresAt = new Date(Date.now() + 86400000);

      await service.grantDataPermission(userId, sourceType, permissions, purpose, expiresAt);

      expect(mockPermissionManager.grantPermission).toHaveBeenCalledWith(
        userId,
        sourceType,
        permissions,
        purpose,
        '1.0',
        expiresAt
      );
    });

    it('should revoke data permission', async () => {
      await service.revokeDataPermission(userId, sourceType);

      expect(mockPermissionManager.revokePermission).toHaveBeenCalledWith(userId, sourceType);
    });

    it('should get user permissions', async () => {
      const mockPermissions = [
        {
          id: 'perm-1',
          userId,
          sourceType,
          permissions: ['read'],
          grantedAt: new Date(),
          isActive: true,
        },
      ];

      vi.mocked(mockPermissionManager.getUserPermissions).mockResolvedValue(mockPermissions as any);

      const result = await service.getUserPermissions(userId);

      expect(mockPermissionManager.getUserPermissions).toHaveBeenCalledWith(userId);
      expect(result).toEqual(mockPermissions);
    });

    it('should get data access logs', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          userId,
          sourceType,
          operation: 'read',
          resource: 'calendar',
          success: true,
          timestamp: new Date(),
        },
      ];

      vi.mocked(mockPermissionManager.getDataAccessLogs).mockResolvedValue(mockLogs as any);

      const result = await service.getDataAccessLogs(userId, sourceType);

      expect(mockPermissionManager.getDataAccessLogs).toHaveBeenCalledWith(userId, sourceType);
      expect(result).toEqual(mockLogs);
    });

    it('should get permission stats', async () => {
      const mockStats = {
        totalPermissions: 5,
        activePermissions: 3,
        expiredPermissions: 2,
        totalAccessLogs: 100,
        successfulAccesses: 95,
        failedAccesses: 5,
      };

      vi.mocked(mockPermissionManager.getPermissionStats).mockResolvedValue(mockStats);

      const result = await service.getPermissionStats(userId);

      expect(mockPermissionManager.getPermissionStats).toHaveBeenCalledWith(userId);
      expect(result).toEqual(mockStats);
    });
  });

  describe('cleanup operations', () => {
    it('should cleanup expired permissions', async () => {
      const expectedCount = 10;
      vi.mocked(mockPermissionManager.cleanupExpiredPermissions).mockResolvedValue(expectedCount);

      const result = await service.cleanupExpiredPermissions();

      expect(mockPermissionManager.cleanupExpiredPermissions).toHaveBeenCalled();
      expect(result).toBe(expectedCount);
    });

    it('should cleanup old access logs', async () => {
      const retentionDays = 30;
      const expectedCount = 50;
      vi.mocked(mockPermissionManager.cleanupOldAccessLogs).mockResolvedValue(expectedCount);

      const result = await service.cleanupOldAccessLogs(retentionDays);

      expect(mockPermissionManager.cleanupOldAccessLogs).toHaveBeenCalledWith(retentionDays);
      expect(result).toBe(expectedCount);
    });
  });
});