import { DataSourceType, DataSourceCredentials } from '../../data/types';

export interface DataSource {
  id: string;
  userId: string;
  type: DataSourceType;
  name: string;
  credentials: DataSourceCredentials;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastSyncAt?: Date;
}

export interface DataSourcePermission {
  id: string;
  userId: string;
  sourceType: DataSourceType;
  permissions: string[];
  grantedAt: Date;
  expiresAt?: Date;
  isActive: boolean;
  consentVersion: string;
  purpose: string;
  createdAt: Date;
  updatedAt: Date;
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
  duration?: number;
}