import { BaseConnector } from './base';
import { DataSourceType, DataSourceCapabilities, FileItem } from '../types';

interface GoogleDriveCredentials {
  accessToken: string;
  refreshToken?: string;
  clientId: string;
  clientSecret: string;
}

export class GoogleDriveConnector extends BaseConnector {
  private credentials?: GoogleDriveCredentials;
  private baseUrl = 'https://www.googleapis.com/drive/v3';

  constructor() {
    super('google-drive', 'Google Drive', DataSourceType.GOOGLE_DRIVE);
  }

  async connect(credentials: GoogleDriveCredentials): Promise<void> {
    try {
      this.credentials = credentials;
      
      const isValid = await this.testConnection();
      if (!isValid) {
        throw new Error('Invalid Google Drive credentials');
      }

      this.setConnected(true);
    } catch (error) {
      this.setConnected(false);
      throw new Error(`Failed to connect to Google Drive: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async disconnect(): Promise<void> {
    this.credentials = undefined as any;
    this.setConnected(false);
  }

  async testConnection(): Promise<boolean> {
    if (!this.credentials) {
      return false;
    }

    try {
      const response = await fetch(`${this.baseUrl}/about?fields=user`, {
        headers: {
          'Authorization': `Bearer ${this.credentials.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      return response.ok;
    } catch (error) {
      console.error('Google Drive connection test failed:', error);
      return false;
    }
  }

  getCapabilities(): DataSourceCapabilities {
    return {
      canRead: true,
      canWrite: true,
      canList: true,
      canSearch: true,
      supportedFileTypes: ['*'],
      maxFileSize: 5 * 1024 * 1024 * 1024, // 5GB
    };
  }

  async listFiles(folderId?: string, pageSize: number = 100): Promise<FileItem[]> {
    this.validateConnection();
    
    if (!this.credentials) {
      throw new Error('No credentials available');
    }

    const params = new URLSearchParams({
      pageSize: pageSize.toString(),
      fields: 'files(id,name,parents,mimeType,size,createdTime,modifiedTime)',
    });

    if (folderId) {
      params.append('q', `'${folderId}' in parents`);
    }

    const response = await fetch(`${this.baseUrl}/files?${params}`, {
      headers: {
        'Authorization': `Bearer ${this.credentials.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to list files: ${response.statusText}`);
    }

    const data = await response.json();
    
    return data.files?.map((file: any) => ({
      id: file.id,
      name: file.name,
      path: file.parents?.[0] || 'root',
      type: file.mimeType === 'application/vnd.google-apps.folder' ? 'folder' : 'file',
      size: file.size ? parseInt(file.size) : undefined,
      mimeType: file.mimeType,
      modifiedAt: new Date(file.modifiedTime),
      createdAt: new Date(file.createdTime),
    })) || [];
  }

  async searchFiles(query: string, pageSize: number = 50): Promise<FileItem[]> {
    this.validateConnection();
    
    if (!this.credentials) {
      throw new Error('No credentials available');
    }

    const params = new URLSearchParams({
      q: `name contains '${query}' or fullText contains '${query}'`,
      pageSize: pageSize.toString(),
      fields: 'files(id,name,parents,mimeType,size,createdTime,modifiedTime)',
    });

    const response = await fetch(`${this.baseUrl}/files?${params}`, {
      headers: {
        'Authorization': `Bearer ${this.credentials.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to search files: ${response.statusText}`);
    }

    const data = await response.json();
    
    return data.files?.map((file: any) => ({
      id: file.id,
      name: file.name,
      path: file.parents?.[0] || 'root',
      type: file.mimeType === 'application/vnd.google-apps.folder' ? 'folder' : 'file',
      size: file.size ? parseInt(file.size) : undefined,
      mimeType: file.mimeType,
      modifiedAt: new Date(file.modifiedTime),
      createdAt: new Date(file.createdTime),
    })) || [];
  }

  async getFileContent(fileId: string): Promise<Buffer> {
    this.validateConnection();
    
    if (!this.credentials) {
      throw new Error('No credentials available');
    }

    const response = await fetch(`${this.baseUrl}/files/${fileId}?alt=media`, {
      headers: {
        'Authorization': `Bearer ${this.credentials.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get file content: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async getFileMetadata(fileId: string): Promise<FileItem> {
    this.validateConnection();
    
    if (!this.credentials) {
      throw new Error('No credentials available');
    }

    const response = await fetch(`${this.baseUrl}/files/${fileId}?fields=id,name,parents,mimeType,size,createdTime,modifiedTime`, {
      headers: {
        'Authorization': `Bearer ${this.credentials.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get file metadata: ${response.statusText}`);
    }

    const file = await response.json();
    
    return {
      id: file.id,
      name: file.name,
      path: file.parents?.[0] || 'root',
      type: file.mimeType === 'application/vnd.google-apps.folder' ? 'folder' : 'file',
      size: file.size ? parseInt(file.size) : undefined,
      mimeType: file.mimeType,
      modifiedAt: new Date(file.modifiedTime),
      createdAt: new Date(file.createdTime),
    };
  }

  async refreshAccessToken(): Promise<void> {
    if (!this.credentials?.refreshToken || !this.credentials?.clientId || !this.credentials?.clientSecret) {
      throw new Error('Missing refresh token or client credentials');
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.credentials.clientId,
        client_secret: this.credentials.clientSecret,
        refresh_token: this.credentials.refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to refresh access token: ${response.statusText}`);
    }

    const data = await response.json();
    this.credentials.accessToken = data.access_token;
  }
}