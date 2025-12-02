import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { ConnectorRegistry } from './connectors/registry';
import { PermissionManager } from './permissions/manager';
import { 
  DataSourceType, 
  DataSourceCredentials, 
  DataAccessRequest,
  CalendarEvent,
  FileItem,
  DataConnector
} from './types';
import { DataSource } from '../database/models/DataSource';

export class DataIntegrationService {
  private connectorRegistry: ConnectorRegistry;
  private permissionManager: PermissionManager;
  private userConnectors: Map<string, Map<DataSourceType, DataConnector>> = new Map();

  constructor(private db: Pool) {
    this.connectorRegistry = ConnectorRegistry.getInstance();
    this.permissionManager = new PermissionManager(db);
  }

  async connectDataSource(
    userId: string,
    sourceType: DataSourceType,
    credentials: DataSourceCredentials,
    name?: string
  ): Promise<DataSource> {
    const startTime = Date.now();
    
    try {
      // Create connector instance
      const connector = this.connectorRegistry.createConnectorInstance(sourceType);
      
      // Test connection
      await connector.connect(credentials);
      
      // Store credentials in database
      const dataSource = await this.storeDataSource(userId, sourceType, credentials, name);
      
      // Cache connector for user
      this.cacheUserConnector(userId, sourceType, connector);
      
      // Log successful connection
      await this.permissionManager.logDataAccess({
        userId,
        sourceType,
        operation: 'connect',
        resource: sourceType,
        purpose: 'Data source connection',
        success: true,
        duration: Date.now() - startTime,
      });

      return dataSource;
    } catch (error) {
      // Log failed connection
      await this.permissionManager.logDataAccess({
        userId,
        sourceType,
        operation: 'connect',
        resource: sourceType,
        purpose: 'Data source connection',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      });
      
      throw error;
    }
  }

  async disconnectDataSource(userId: string, sourceType: DataSourceType): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Remove from cache
      const userConnectors = this.userConnectors.get(userId);
      if (userConnectors) {
        const connector = userConnectors.get(sourceType);
        if (connector) {
          await connector.disconnect();
          userConnectors.delete(sourceType);
        }
      }

      // Deactivate in database
      const query = `
        UPDATE data_sources 
        SET is_active = false, updated_at = NOW()
        WHERE user_id = $1 AND type = $2
      `;
      
      await this.db.query(query, [userId, sourceType]);

      // Revoke permissions
      await this.permissionManager.revokePermission(userId, sourceType);

      // Log successful disconnection
      await this.permissionManager.logDataAccess({
        userId,
        sourceType,
        operation: 'disconnect',
        resource: sourceType,
        purpose: 'Data source disconnection',
        success: true,
        duration: Date.now() - startTime,
      });
    } catch (error) {
      // Log failed disconnection
      await this.permissionManager.logDataAccess({
        userId,
        sourceType,
        operation: 'disconnect',
        resource: sourceType,
        purpose: 'Data source disconnection',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      });
      
      throw error;
    }
  }

  async getCalendarEvents(
    userId: string,
    calendarId?: string,
    timeMin?: Date,
    timeMax?: Date
  ): Promise<CalendarEvent[]> {
    const request: DataAccessRequest = {
      userId,
      sourceType: DataSourceType.GOOGLE_CALENDAR,
      operation: 'read',
      resource: calendarId || 'primary',
      purpose: 'Retrieve calendar events',
    };

    const startTime = Date.now();
    
    try {
      // Validate permissions
      const hasPermission = await this.permissionManager.validateDataAccessRequest(request);
      if (!hasPermission) {
        throw new Error('Permission denied for calendar access');
      }

      // Get connector
      const connector = await this.getUserConnector(userId, DataSourceType.GOOGLE_CALENDAR);
      if (!connector || connector.type !== DataSourceType.GOOGLE_CALENDAR) {
        throw new Error('Google Calendar not connected');
      }

      // Cast to specific connector type and get events
      const calendarConnector = connector as any; // Type assertion needed due to interface limitations
      const events = await calendarConnector.getEvents(calendarId, timeMin, timeMax);

      // Log successful access
      await this.permissionManager.logDataAccess({
        ...request,
        success: true,
        duration: Date.now() - startTime,
      });

      return events;
    } catch (error) {
      // Log failed access
      await this.permissionManager.logDataAccess({
        ...request,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      });
      
      throw error;
    }
  }

  async searchFiles(
    userId: string,
    sourceType: DataSourceType,
    query: string
  ): Promise<FileItem[]> {
    const request: DataAccessRequest = {
      userId,
      sourceType,
      operation: 'search',
      resource: query,
      purpose: 'Search files',
    };

    const startTime = Date.now();
    
    try {
      // Validate permissions
      const hasPermission = await this.permissionManager.validateDataAccessRequest(request);
      if (!hasPermission) {
        throw new Error(`Permission denied for ${sourceType} access`);
      }

      // Get connector
      const connector = await this.getUserConnector(userId, sourceType);
      if (!connector) {
        throw new Error(`${sourceType} not connected`);
      }

      let files: FileItem[] = [];

      // Call appropriate search method based on connector type
      const anyConnector = connector as any;
      if (anyConnector.searchFiles) {
        files = await anyConnector.searchFiles(query);
      } else {
        throw new Error(`Search not supported for ${sourceType}`);
      }

      // Log successful access
      await this.permissionManager.logDataAccess({
        ...request,
        success: true,
        duration: Date.now() - startTime,
      });

      return files;
    } catch (error) {
      // Log failed access
      await this.permissionManager.logDataAccess({
        ...request,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      });
      
      throw error;
    }
  }

  async getFileContent(
    userId: string,
    sourceType: DataSourceType,
    fileId: string
  ): Promise<Buffer> {
    const request: DataAccessRequest = {
      userId,
      sourceType,
      operation: 'read',
      resource: fileId,
      purpose: 'Read file content',
    };

    const startTime = Date.now();
    
    try {
      // Validate permissions
      const hasPermission = await this.permissionManager.validateDataAccessRequest(request);
      if (!hasPermission) {
        throw new Error(`Permission denied for ${sourceType} access`);
      }

      // Get connector
      const connector = await this.getUserConnector(userId, sourceType);
      if (!connector) {
        throw new Error(`${sourceType} not connected`);
      }

      let content: Buffer;

      // Call appropriate method based on connector type
      const anyConnector = connector as any;
      if (anyConnector.getFileContent) {
        content = await anyConnector.getFileContent(fileId);
      } else {
        throw new Error(`File reading not supported for ${sourceType}`);
      }

      // Log successful access
      await this.permissionManager.logDataAccess({
        ...request,
        success: true,
        duration: Date.now() - startTime,
      });

      return content;
    } catch (error) {
      // Log failed access
      await this.permissionManager.logDataAccess({
        ...request,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      });
      
      throw error;
    }
  }

  async getUserDataSources(userId: string): Promise<DataSource[]> {
    const query = `
      SELECT *
      FROM data_sources
      WHERE user_id = $1 AND is_active = true
      ORDER BY created_at DESC
    `;

    const result = await this.db.query(query, [userId]);
    
    return result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      type: row.type,
      name: row.name,
      credentials: row.credentials,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastSyncAt: row.last_sync_at,
    }));
  }

  async grantDataPermission(
    userId: string,
    sourceType: DataSourceType,
    permissions: string[],
    purpose: string,
    expiresAt?: Date
  ): Promise<void> {
    const consentVersion = '1.0'; // This should be configurable
    
    await this.permissionManager.grantPermission(
      userId,
      sourceType,
      permissions,
      purpose,
      consentVersion,
      expiresAt
    );
  }

  async revokeDataPermission(userId: string, sourceType: DataSourceType): Promise<void> {
    await this.permissionManager.revokePermission(userId, sourceType);
  }

  async getUserPermissions(userId: string) {
    return this.permissionManager.getUserPermissions(userId);
  }

  async getDataAccessLogs(userId: string, sourceType?: DataSourceType) {
    return this.permissionManager.getDataAccessLogs(userId, sourceType);
  }

  async getPermissionStats(userId: string) {
    return this.permissionManager.getPermissionStats(userId);
  }

  private async storeDataSource(
    userId: string,
    sourceType: DataSourceType,
    credentials: DataSourceCredentials,
    name?: string
  ): Promise<DataSource> {
    const id = uuidv4();
    const displayName = name || this.getDefaultSourceName(sourceType);

    const query = `
      INSERT INTO data_sources (id, user_id, type, name, credentials)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id, type) 
      DO UPDATE SET 
        credentials = EXCLUDED.credentials,
        is_active = true,
        updated_at = NOW()
      RETURNING *
    `;

    const values = [id, userId, sourceType, displayName, JSON.stringify(credentials)];
    const result = await this.db.query(query, values);
    const row = result.rows[0];

    return {
      id: row.id,
      userId: row.user_id,
      type: row.type,
      name: row.name,
      credentials: row.credentials,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastSyncAt: row.last_sync_at,
    };
  }

  private async getUserConnector(
    userId: string,
    sourceType: DataSourceType
  ): Promise<DataConnector | null> {
    // Check cache first
    const userConnectors = this.userConnectors.get(userId);
    if (userConnectors?.has(sourceType)) {
      return userConnectors.get(sourceType)!;
    }

    // Load from database and create connector
    const query = `
      SELECT credentials
      FROM data_sources
      WHERE user_id = $1 AND type = $2 AND is_active = true
    `;

    const result = await this.db.query(query, [userId, sourceType]);
    if (result.rows.length === 0) {
      return null;
    }

    const credentials = result.rows[0].credentials;
    const connector = this.connectorRegistry.createConnectorInstance(sourceType);
    
    try {
      await connector.connect(credentials);
      this.cacheUserConnector(userId, sourceType, connector);
      return connector;
    } catch (error) {
      console.error(`Failed to connect ${sourceType} for user ${userId}:`, error);
      return null;
    }
  }

  private cacheUserConnector(
    userId: string,
    sourceType: DataSourceType,
    connector: DataConnector
  ): void {
    if (!this.userConnectors.has(userId)) {
      this.userConnectors.set(userId, new Map());
    }
    
    this.userConnectors.get(userId)!.set(sourceType, connector);
  }

  private getDefaultSourceName(sourceType: DataSourceType): string {
    const names: Record<DataSourceType, string> = {
      [DataSourceType.GOOGLE_CALENDAR]: 'Google Calendar',
      [DataSourceType.GOOGLE_DRIVE]: 'Google Drive',
      [DataSourceType.DROPBOX]: 'Dropbox',
      [DataSourceType.FILE_SYSTEM]: 'File System',
    };
    
    return names[sourceType] || sourceType;
  }

  // Cleanup methods
  async cleanupExpiredPermissions(): Promise<number> {
    return this.permissionManager.cleanupExpiredPermissions();
  }

  async cleanupOldAccessLogs(retentionDays: number = 90): Promise<number> {
    return this.permissionManager.cleanupOldAccessLogs(retentionDays);
  }
}