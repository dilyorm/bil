import { promises as fs } from 'fs';
import { join, extname, basename, dirname } from 'path';
import { BaseConnector } from './base';
import { DataSourceType, DataSourceCapabilities, FileItem } from '../types';

interface FileSystemCredentials {
  basePath: string;
  allowedPaths?: string[];
  readOnly?: boolean;
}

export class FileSystemConnector extends BaseConnector {
  private credentials?: FileSystemCredentials;

  constructor() {
    super('file-system', 'File System', DataSourceType.FILE_SYSTEM);
  }

  async connect(credentials: FileSystemCredentials): Promise<void> {
    try {
      this.credentials = credentials;
      
      // Validate base path exists and is accessible
      const isValid = await this.testConnection();
      if (!isValid) {
        throw new Error('Invalid file system path or insufficient permissions');
      }

      this.setConnected(true);
    } catch (error) {
      this.setConnected(false);
      throw new Error(`Failed to connect to file system: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      const stats = await fs.stat(this.credentials.basePath);
      return stats.isDirectory();
    } catch (error) {
      console.error('File system connection test failed:', error);
      return false;
    }
  }

  getCapabilities(): DataSourceCapabilities {
    return {
      canRead: true,
      canWrite: !this.credentials?.readOnly,
      canList: true,
      canSearch: true,
      supportedFileTypes: ['*'],
      maxFileSize: undefined, // No specific limit
    };
  }

  async listFiles(relativePath: string = '', recursive: boolean = false): Promise<FileItem[]> {
    this.validateConnection();
    
    if (!this.credentials) {
      throw new Error('No credentials available');
    }

    const fullPath = this.resolvePath(relativePath);
    this.validatePath(fullPath);

    try {
      const entries = await fs.readdir(fullPath, { withFileTypes: true });
      const files: FileItem[] = [];

      for (const entry of entries) {
        const entryPath = join(fullPath, entry.name);
        const stats = await fs.stat(entryPath);
        
        const fileItem: FileItem = {
          id: entryPath,
          name: entry.name,
          path: join(relativePath, entry.name),
          type: entry.isDirectory() ? 'folder' : 'file',
          size: entry.isFile() ? stats.size : undefined,
          mimeType: entry.isFile() ? this.getMimeTypeFromExtension(entry.name) : undefined,
          modifiedAt: stats.mtime,
          createdAt: stats.birthtime,
        };

        files.push(fileItem);

        // Recursively list subdirectories if requested
        if (recursive && entry.isDirectory()) {
          const subFiles = await this.listFiles(join(relativePath, entry.name), true);
          files.push(...subFiles);
        }
      }

      return files;
    } catch (error) {
      throw new Error(`Failed to list files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async searchFiles(query: string, relativePath: string = ''): Promise<FileItem[]> {
    this.validateConnection();
    
    const allFiles = await this.listFiles(relativePath, true);
    const searchTerm = query.toLowerCase();

    return allFiles.filter(file => 
      file.name.toLowerCase().includes(searchTerm) ||
      file.path.toLowerCase().includes(searchTerm)
    );
  }

  async getFileContent(relativePath: string): Promise<Buffer> {
    this.validateConnection();
    
    if (!this.credentials) {
      throw new Error('No credentials available');
    }

    const fullPath = this.resolvePath(relativePath);
    this.validatePath(fullPath);

    try {
      return await fs.readFile(fullPath);
    } catch (error) {
      throw new Error(`Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getFileMetadata(relativePath: string): Promise<FileItem> {
    this.validateConnection();
    
    if (!this.credentials) {
      throw new Error('No credentials available');
    }

    const fullPath = this.resolvePath(relativePath);
    this.validatePath(fullPath);

    try {
      const stats = await fs.stat(fullPath);
      
      return {
        id: fullPath,
        name: basename(fullPath),
        path: relativePath,
        type: stats.isDirectory() ? 'folder' : 'file',
        size: stats.isFile() ? stats.size : undefined,
        mimeType: stats.isFile() ? this.getMimeTypeFromExtension(basename(fullPath)) : undefined,
        modifiedAt: stats.mtime,
        createdAt: stats.birthtime,
      };
    } catch (error) {
      throw new Error(`Failed to get file metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async writeFile(relativePath: string, content: Buffer): Promise<void> {
    this.validateConnection();
    
    if (!this.credentials) {
      throw new Error('No credentials available');
    }

    if (this.credentials.readOnly) {
      throw new Error('File system is configured as read-only');
    }

    const fullPath = this.resolvePath(relativePath);
    this.validatePath(fullPath);

    try {
      // Ensure directory exists
      await fs.mkdir(dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content);
    } catch (error) {
      throw new Error(`Failed to write file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private resolvePath(relativePath: string): string {
    if (!this.credentials) {
      throw new Error('No credentials available');
    }

    return join(this.credentials.basePath, relativePath);
  }

  private validatePath(fullPath: string): void {
    if (!this.credentials) {
      throw new Error('No credentials available');
    }

    // Ensure path is within base path (prevent directory traversal)
    if (!fullPath.startsWith(this.credentials.basePath)) {
      throw new Error('Access denied: Path is outside allowed directory');
    }

    // Check against allowed paths if specified
    if (this.credentials.allowedPaths && this.credentials.allowedPaths.length > 0) {
      const isAllowed = this.credentials.allowedPaths.some(allowedPath => 
        fullPath.startsWith(join(this.credentials!.basePath, allowedPath))
      );

      if (!isAllowed) {
        throw new Error('Access denied: Path is not in allowed paths list');
      }
    }
  }

  private getMimeTypeFromExtension(filename: string): string {
    const ext = extname(filename).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.mp4': 'video/mp4',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.zip': 'application/zip',
      '.tar': 'application/x-tar',
      '.gz': 'application/gzip',
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }
}