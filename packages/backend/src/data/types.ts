export interface DataConnector {
  id: string;
  name: string;
  type: DataSourceType;
  isConnected: boolean;
  connect(credentials: any): Promise<void>;
  disconnect(): Promise<void>;
  testConnection(): Promise<boolean>;
  getCapabilities(): DataSourceCapabilities;
}

export enum DataSourceType {
  GOOGLE_CALENDAR = 'google_calendar',
  GOOGLE_DRIVE = 'google_drive',
  DROPBOX = 'dropbox',
  FILE_SYSTEM = 'file_system',
}

export interface DataSourceCapabilities {
  canRead: boolean;
  canWrite: boolean;
  canList: boolean;
  canSearch: boolean;
  supportedFileTypes?: string[];
  maxFileSize?: number;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  location?: string;
  attendees?: string[];
  isAllDay: boolean;
}

export interface FileItem {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'folder';
  size?: number;
  mimeType?: string;
  modifiedAt: Date;
  createdAt: Date;
}

export interface DataSourceCredentials {
  type: DataSourceType;
  accessToken?: string;
  refreshToken?: string;
  clientId?: string;
  clientSecret?: string;
  expiresAt?: Date;
  scopes?: string[];
  basePath?: string;
  allowedPaths?: string[];
  readOnly?: boolean;
}

export interface DataAccessRequest {
  userId: string;
  sourceType: DataSourceType;
  operation: 'read' | 'write' | 'list' | 'search' | 'connect' | 'disconnect';
  resource: string;
  purpose: string;
}

export interface DataAccessLog {
  id: string;
  userId: string;
  sourceType: DataSourceType;
  operation: string;
  resource: string;
  success: boolean;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  error?: string;
}

export interface PermissionGrant {
  id: string;
  userId: string;
  sourceType: DataSourceType;
  permissions: string[];
  grantedAt: Date;
  expiresAt?: Date;
  isActive: boolean;
  consentVersion: string;
}