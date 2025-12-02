import { BaseConnector } from './base';
import { DataSourceType, DataSourceCapabilities, FileItem } from '../types';

interface DropboxCredentials {
  accessToken: string;
  refreshToken?: string;
  clientId?: string;
  clientSecret?: string;
}

export class DropboxConnector extends BaseConnector {
  private credentials?: DropboxCredentials;
  private baseUrl = 'https://api.dropboxapi.com/2';
  private contentUrl = 'https://content.dropboxapi.com/2';

  constructor() {
    super('dropbox', 'Dropbox', DataSourceType.DROPBOX);
  }

  async connect(credentials: DropboxCredentials): Promise<void> {
    try {
      this.credentials = credentials;
      
      const isValid = await this.testConnection();
      if (!isValid) {
        throw new Error('Invalid Dropbox credentials');
      }

      this.setConnected(true);
    } catch (error) {
      this.setConnected(false);
      throw new Error(`Failed to connect to Dropbox: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      const response = await fetch(`${this.baseUrl}/users/get_current_account`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.credentials.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      return response.ok;
    } catch (error) {
      console.error('Dropbox connection test failed:', error);
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
      maxFileSize: 350 * 1024 * 1024, // 350MB for API uploads
    };
  }

  async listFiles(path: string = '', recursive: boolean = false): Promise<FileItem[]> {
    this.validateConnection();
    
    if (!this.credentials) {
      throw new Error('No credentials available');
    }

    const requestBody = {
      path: path || '',
      recursive,
      include_media_info: false,
      include_deleted: false,
      include_has_explicit_shared_members: false,
    };

    const response = await fetch(`${this.baseUrl}/files/list_folder`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.credentials.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Failed to list files: ${response.statusText}`);
    }

    const data = await response.json();
    
    return data.entries?.map((entry: any) => ({
      id: entry.id,
      name: entry.name,
      path: entry.path_lower,
      type: entry['.tag'] === 'folder' ? 'folder' : 'file',
      size: entry.size,
      mimeType: this.getMimeTypeFromExtension(entry.name),
      modifiedAt: entry.server_modified ? new Date(entry.server_modified) : new Date(),
      createdAt: entry.server_modified ? new Date(entry.server_modified) : new Date(),
    })) || [];
  }

  async searchFiles(query: string, maxResults: number = 50): Promise<FileItem[]> {
    this.validateConnection();
    
    if (!this.credentials) {
      throw new Error('No credentials available');
    }

    const requestBody = {
      query,
      max_results: maxResults,
      mode: 'filename',
    };

    const response = await fetch(`${this.baseUrl}/files/search_v2`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.credentials.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Failed to search files: ${response.statusText}`);
    }

    const data = await response.json();
    
    return data.matches?.map((match: any) => {
      const metadata = match.metadata.metadata;
      return {
        id: metadata.id,
        name: metadata.name,
        path: metadata.path_lower,
        type: metadata['.tag'] === 'folder' ? 'folder' : 'file',
        size: metadata.size,
        mimeType: this.getMimeTypeFromExtension(metadata.name),
        modifiedAt: metadata.server_modified ? new Date(metadata.server_modified) : new Date(),
        createdAt: metadata.server_modified ? new Date(metadata.server_modified) : new Date(),
      };
    }) || [];
  }

  async getFileContent(path: string): Promise<Buffer> {
    this.validateConnection();
    
    if (!this.credentials) {
      throw new Error('No credentials available');
    }

    const response = await fetch(`${this.contentUrl}/files/download`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.credentials.accessToken}`,
        'Dropbox-API-Arg': JSON.stringify({ path }),
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get file content: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async getFileMetadata(path: string): Promise<FileItem> {
    this.validateConnection();
    
    if (!this.credentials) {
      throw new Error('No credentials available');
    }

    const requestBody = {
      path,
      include_media_info: false,
      include_deleted: false,
      include_has_explicit_shared_members: false,
    };

    const response = await fetch(`${this.baseUrl}/files/get_metadata`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.credentials.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Failed to get file metadata: ${response.statusText}`);
    }

    const metadata = await response.json();
    
    return {
      id: metadata.id,
      name: metadata.name,
      path: metadata.path_lower,
      type: metadata['.tag'] === 'folder' ? 'folder' : 'file',
      size: metadata.size,
      mimeType: this.getMimeTypeFromExtension(metadata.name),
      modifiedAt: metadata.server_modified ? new Date(metadata.server_modified) : new Date(),
      createdAt: metadata.server_modified ? new Date(metadata.server_modified) : new Date(),
    };
  }

  private getMimeTypeFromExtension(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      'txt': 'text/plain',
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'ppt': 'application/vnd.ms-powerpoint',
      'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'mp4': 'video/mp4',
      'mp3': 'audio/mpeg',
    };
    return mimeTypes[ext || ''] || 'application/octet-stream';
  }

  async refreshAccessToken(): Promise<void> {
    if (!this.credentials?.refreshToken || !this.credentials?.clientId || !this.credentials?.clientSecret) {
      throw new Error('Missing refresh token or client credentials');
    }

    const response = await fetch('https://api.dropbox.com/oauth2/token', {
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