import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ConnectorRegistry } from '../connectors/registry';
import { GoogleCalendarConnector } from '../connectors/google-calendar';
import { GoogleDriveConnector } from '../connectors/google-drive';
import { DropboxConnector } from '../connectors/dropbox';
import { FileSystemConnector } from '../connectors/file-system';
import { DataSourceType, CalendarEvent, FileItem } from '../types';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Data Connectors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('ConnectorRegistry', () => {
    let registry: ConnectorRegistry;

    beforeEach(() => {
      registry = ConnectorRegistry.getInstance();
    });

    it('should create Google Calendar connector instance', () => {
      const connector = registry.createConnectorInstance(DataSourceType.GOOGLE_CALENDAR);
      expect(connector).toBeInstanceOf(GoogleCalendarConnector);
      expect(connector.type).toBe(DataSourceType.GOOGLE_CALENDAR);
    });

    it('should create Google Drive connector instance', () => {
      const connector = registry.createConnectorInstance(DataSourceType.GOOGLE_DRIVE);
      expect(connector).toBeInstanceOf(GoogleDriveConnector);
      expect(connector.type).toBe(DataSourceType.GOOGLE_DRIVE);
    });

    it('should create Dropbox connector instance', () => {
      const connector = registry.createConnectorInstance(DataSourceType.DROPBOX);
      expect(connector).toBeInstanceOf(DropboxConnector);
      expect(connector.type).toBe(DataSourceType.DROPBOX);
    });

    it('should create File System connector instance', () => {
      const connector = registry.createConnectorInstance(DataSourceType.FILE_SYSTEM);
      expect(connector).toBeInstanceOf(FileSystemConnector);
      expect(connector.type).toBe(DataSourceType.FILE_SYSTEM);
    });

    it('should throw error for unsupported connector type', () => {
      expect(() => {
        registry.createConnectorInstance('unsupported' as DataSourceType);
      }).toThrow('Unknown connector type: unsupported');
    });

    it('should return singleton instance', () => {
      const instance1 = ConnectorRegistry.getInstance();
      const instance2 = ConnectorRegistry.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('GoogleCalendarConnector', () => {
    let connector: GoogleCalendarConnector;
    const mockCredentials = {
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      clientId: 'mock-client-id',
      clientSecret: 'mock-client-secret',
    };

    beforeEach(() => {
      connector = new GoogleCalendarConnector();
    });

    describe('connect', () => {
      it('should connect successfully with valid credentials', async () => {
        // Mock successful connection test
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ items: [] }),
        });

        await connector.connect(mockCredentials);

        expect(connector.isConnected).toBe(true);
        expect(mockFetch).toHaveBeenCalledWith(
          'https://www.googleapis.com/calendar/v3/users/me/calendarList',
          expect.objectContaining({
            headers: expect.objectContaining({
              'Authorization': 'Bearer mock-access-token',
            }),
          })
        );
      });

      it('should fail to connect with invalid credentials', async () => {
        // Mock failed connection test
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 401,
        });

        await expect(connector.connect(mockCredentials))
          .rejects.toThrow('Failed to connect to Google Calendar: Invalid Google Calendar credentials');

        expect(connector.isConnected).toBe(false);
      });

      it('should handle network errors during connection', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Network error'));

        await expect(connector.connect(mockCredentials))
          .rejects.toThrow('Failed to connect to Google Calendar: Invalid Google Calendar credentials');

        expect(connector.isConnected).toBe(false);
      });
    });

    describe('getEvents', () => {
      beforeEach(async () => {
        // Mock successful connection
        mockFetch.mockResolvedValueOnce({ ok: true });
        await connector.connect(mockCredentials);
        vi.clearAllMocks();
      });

      it('should fetch calendar events successfully', async () => {
        const mockApiResponse = {
          items: [
            {
              id: 'event-1',
              summary: 'Team Meeting',
              description: 'Weekly team sync',
              start: { dateTime: '2024-01-01T10:00:00Z' },
              end: { dateTime: '2024-01-01T11:00:00Z' },
              location: 'Conference Room A',
              attendees: [{ email: 'user1@example.com' }, { email: 'user2@example.com' }],
            },
            {
              id: 'event-2',
              summary: 'All Day Event',
              start: { date: '2024-01-02' },
              end: { date: '2024-01-03' },
            },
          ],
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockApiResponse),
        });

        const events = await connector.getEvents('primary');

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('https://www.googleapis.com/calendar/v3/calendars/primary/events'),
          expect.objectContaining({
            headers: expect.objectContaining({
              'Authorization': 'Bearer mock-access-token',
            }),
          })
        );

        expect(events).toHaveLength(2);
        expect(events[0]).toEqual({
          id: 'event-1',
          title: 'Team Meeting',
          description: 'Weekly team sync',
          startTime: new Date('2024-01-01T10:00:00Z'),
          endTime: new Date('2024-01-01T11:00:00Z'),
          location: 'Conference Room A',
          attendees: ['user1@example.com', 'user2@example.com'],
          isAllDay: false,
        });
        expect(events[1]).toEqual({
          id: 'event-2',
          title: 'All Day Event',
          description: undefined,
          startTime: new Date('2024-01-02'),
          endTime: new Date('2024-01-03'),
          location: undefined,
          attendees: [],
          isAllDay: true,
        });
      });

      it('should handle API errors when fetching events', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 403,
          statusText: 'Forbidden',
        });

        await expect(connector.getEvents('primary'))
          .rejects.toThrow('Failed to fetch calendar events: Forbidden');
      });

      it('should include time range parameters when provided', async () => {
        const timeMin = new Date('2024-01-01T00:00:00Z');
        const timeMax = new Date('2024-01-31T23:59:59Z');

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ items: [] }),
        });

        await connector.getEvents('primary', timeMin, timeMax);

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('timeMin=2024-01-01T00%3A00%3A00.000Z'),
          expect.any(Object)
        );
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('timeMax=2024-01-31T23%3A59%3A59.000Z'),
          expect.any(Object)
        );
      });
    });

    describe('createEvent', () => {
      beforeEach(async () => {
        mockFetch.mockResolvedValueOnce({ ok: true });
        await connector.connect(mockCredentials);
        vi.clearAllMocks();
      });

      it('should create calendar event successfully', async () => {
        const eventData: Partial<CalendarEvent> = {
          title: 'New Meeting',
          description: 'Important meeting',
          startTime: new Date('2024-01-01T14:00:00Z'),
          endTime: new Date('2024-01-01T15:00:00Z'),
          location: 'Room B',
          attendees: ['attendee@example.com'],
        };

        const mockApiResponse = {
          id: 'new-event-id',
          summary: 'New Meeting',
          description: 'Important meeting',
          start: { dateTime: '2024-01-01T14:00:00Z' },
          end: { dateTime: '2024-01-01T15:00:00Z' },
          location: 'Room B',
          attendees: [{ email: 'attendee@example.com' }],
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockApiResponse),
        });

        const result = await connector.createEvent('primary', eventData);

        expect(mockFetch).toHaveBeenCalledWith(
          'https://www.googleapis.com/calendar/v3/calendars/primary/events',
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Authorization': 'Bearer mock-access-token',
              'Content-Type': 'application/json',
            }),
            body: expect.stringContaining('"summary":"New Meeting"'),
          })
        );

        expect(result).toEqual({
          id: 'new-event-id',
          title: 'New Meeting',
          description: 'Important meeting',
          startTime: new Date('2024-01-01T14:00:00Z'),
          endTime: new Date('2024-01-01T15:00:00Z'),
          location: 'Room B',
          attendees: ['attendee@example.com'],
          isAllDay: false,
        });
      });
    });

    describe('refreshAccessToken', () => {
      it('should refresh access token successfully', async () => {
        const mockTokenResponse = {
          access_token: 'new-access-token',
          expires_in: 3600,
        };

        // Connect first to set credentials
        mockFetch.mockResolvedValueOnce({ ok: true });
        await connector.connect(mockCredentials);
        vi.clearAllMocks();

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue(mockTokenResponse),
        });

        await connector.refreshAccessToken();

        expect(mockFetch).toHaveBeenCalledWith(
          'https://oauth2.googleapis.com/token',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: expect.any(URLSearchParams),
          })
        );
      });

      it('should handle refresh token errors', async () => {
        // Connect first
        mockFetch.mockResolvedValueOnce({ ok: true });
        await connector.connect(mockCredentials);
        vi.clearAllMocks();

        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 400,
          statusText: 'Bad Request',
        });

        await expect(connector.refreshAccessToken())
          .rejects.toThrow('Failed to refresh access token: Bad Request');
      });
    });
  });

  describe('GoogleDriveConnector', () => {
    let connector: GoogleDriveConnector;
    const mockCredentials = {
      accessToken: 'mock-access-token',
      clientId: 'mock-client-id',
      clientSecret: 'mock-client-secret',
    };

    beforeEach(() => {
      connector = new GoogleDriveConnector();
    });

    describe('searchFiles', () => {
      beforeEach(async () => {
        mockFetch.mockResolvedValueOnce({ ok: true });
        await connector.connect(mockCredentials);
        vi.clearAllMocks();
      });

      it('should search files successfully', async () => {
        const mockApiResponse = {
          files: [
            {
              id: 'file-1',
              name: 'document.pdf',
              parents: ['folder-id'],
              mimeType: 'application/pdf',
              size: '1024',
              createdTime: '2024-01-01T10:00:00Z',
              modifiedTime: '2024-01-01T11:00:00Z',
            },
            {
              id: 'folder-1',
              name: 'My Folder',
              mimeType: 'application/vnd.google-apps.folder',
              createdTime: '2024-01-01T09:00:00Z',
              modifiedTime: '2024-01-01T09:00:00Z',
            },
          ],
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockApiResponse),
        });

        const files = await connector.searchFiles('document');

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("q=name+contains+%27document%27+or+fullText+contains+%27document%27"),
          expect.objectContaining({
            headers: expect.objectContaining({
              'Authorization': 'Bearer mock-access-token',
            }),
          })
        );

        expect(files).toHaveLength(2);
        expect(files[0]).toEqual({
          id: 'file-1',
          name: 'document.pdf',
          path: 'folder-id',
          type: 'file',
          size: 1024,
          mimeType: 'application/pdf',
          modifiedAt: new Date('2024-01-01T11:00:00Z'),
          createdAt: new Date('2024-01-01T10:00:00Z'),
        });
        expect(files[1]).toEqual({
          id: 'folder-1',
          name: 'My Folder',
          path: 'root',
          type: 'folder',
          size: undefined,
          mimeType: 'application/vnd.google-apps.folder',
          modifiedAt: new Date('2024-01-01T09:00:00Z'),
          createdAt: new Date('2024-01-01T09:00:00Z'),
        });
      });

      it('should handle search API errors', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
        });

        await expect(connector.searchFiles('document'))
          .rejects.toThrow('Failed to search files: Too Many Requests');
      });
    });

    describe('getFileContent', () => {
      beforeEach(async () => {
        mockFetch.mockResolvedValueOnce({ ok: true });
        await connector.connect(mockCredentials);
        vi.clearAllMocks();
      });

      it('should get file content successfully', async () => {
        const mockContent = new ArrayBuffer(8);
        const view = new Uint8Array(mockContent);
        view.set([72, 101, 108, 108, 111, 33, 33, 33]); // "Hello!!!"

        mockFetch.mockResolvedValueOnce({
          ok: true,
          arrayBuffer: () => Promise.resolve(mockContent),
        });

        const content = await connector.getFileContent('file-123');

        expect(mockFetch).toHaveBeenCalledWith(
          'https://www.googleapis.com/drive/v3/files/file-123?alt=media',
          expect.objectContaining({
            headers: expect.objectContaining({
              'Authorization': 'Bearer mock-access-token',
            }),
          })
        );

        expect(content).toBeInstanceOf(Buffer);
        expect(content.toString()).toBe('Hello!!!');
      });

      it('should handle file content API errors', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Not Found',
        });

        await expect(connector.getFileContent('nonexistent-file'))
          .rejects.toThrow('Failed to get file content: Not Found');
      });
    });
  });

  describe('DropboxConnector', () => {
    let connector: DropboxConnector;
    const mockCredentials = {
      accessToken: 'mock-dropbox-token',
    };

    beforeEach(() => {
      connector = new DropboxConnector();
    });

    describe('searchFiles', () => {
      beforeEach(async () => {
        mockFetch.mockResolvedValueOnce({ ok: true });
        await connector.connect(mockCredentials);
        vi.clearAllMocks();
      });

      it('should search files successfully', async () => {
        const mockApiResponse = {
          matches: [
            {
              metadata: {
                metadata: {
                  id: 'id:file123',
                  name: 'report.pdf',
                  path_lower: '/documents/report.pdf',
                  '.tag': 'file',
                  size: 2048,
                  server_modified: '2024-01-01T12:00:00Z',
                },
              },
            },
          ],
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockApiResponse),
        });

        const files = await connector.searchFiles('report');

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.dropboxapi.com/2/files/search_v2',
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Authorization': 'Bearer mock-dropbox-token',
              'Content-Type': 'application/json',
            }),
            body: expect.stringContaining('"query":"report"'),
          })
        );

        expect(files).toHaveLength(1);
        expect(files[0]).toEqual({
          id: 'id:file123',
          name: 'report.pdf',
          path: '/documents/report.pdf',
          type: 'file',
          size: 2048,
          mimeType: 'application/pdf',
          modifiedAt: new Date('2024-01-01T12:00:00Z'),
          createdAt: new Date('2024-01-01T12:00:00Z'),
        });
      });

      it('should handle search API errors', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
        });

        await expect(connector.searchFiles('report'))
          .rejects.toThrow('Failed to search files: Unauthorized');
      });
    });

    describe('getFileContent', () => {
      beforeEach(async () => {
        mockFetch.mockResolvedValueOnce({ ok: true });
        await connector.connect(mockCredentials);
        vi.clearAllMocks();
      });

      it('should get file content successfully', async () => {
        const mockContent = new ArrayBuffer(5);
        const view = new Uint8Array(mockContent);
        view.set([72, 101, 108, 108, 111]); // "Hello"

        mockFetch.mockResolvedValueOnce({
          ok: true,
          arrayBuffer: () => Promise.resolve(mockContent),
        });

        const content = await connector.getFileContent('/path/to/file.txt');

        expect(mockFetch).toHaveBeenCalledWith(
          'https://content.dropboxapi.com/2/files/download',
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Authorization': 'Bearer mock-dropbox-token',
              'Dropbox-API-Arg': '{"path":"/path/to/file.txt"}',
            }),
          })
        );

        expect(content).toBeInstanceOf(Buffer);
        expect(content.toString()).toBe('Hello');
      });

      it('should handle file download errors', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 409,
          statusText: 'Conflict',
        });

        await expect(connector.getFileContent('/nonexistent/file.txt'))
          .rejects.toThrow('Failed to get file content: Conflict');
      });
    });

    describe('listFiles', () => {
      beforeEach(async () => {
        mockFetch.mockResolvedValueOnce({ ok: true });
        await connector.connect(mockCredentials);
        vi.clearAllMocks();
      });

      it('should list files successfully', async () => {
        const mockApiResponse = {
          entries: [
            {
              id: 'id:folder123',
              name: 'Documents',
              path_lower: '/documents',
              '.tag': 'folder',
            },
            {
              id: 'id:file456',
              name: 'readme.txt',
              path_lower: '/readme.txt',
              '.tag': 'file',
              size: 512,
              server_modified: '2024-01-01T10:30:00Z',
            },
          ],
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockApiResponse),
        });

        const files = await connector.listFiles('/');

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.dropboxapi.com/2/files/list_folder',
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('"path":"/"'),
          })
        );

        expect(files).toHaveLength(2);
        expect(files[0].type).toBe('folder');
        expect(files[1].type).toBe('file');
        expect(files[1].size).toBe(512);
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle network timeouts', async () => {
      const connector = new GoogleCalendarConnector();
      
      mockFetch.mockImplementationOnce(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Network timeout')), 100)
        )
      );

      await expect(connector.connect({
        accessToken: 'token',
        clientId: 'id',
        clientSecret: 'secret',
      })).rejects.toThrow('Failed to connect to Google Calendar');
    });

    it('should handle malformed API responses', async () => {
      const connector = new GoogleCalendarConnector();
      
      // Mock successful connection
      mockFetch.mockResolvedValueOnce({ ok: true });
      await connector.connect({
        accessToken: 'token',
        clientId: 'id',
        clientSecret: 'secret',
      });

      // Mock malformed response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ items: null }), // Invalid response
      });

      const events = await connector.getEvents();
      expect(events).toEqual([]);
    });

    it('should handle rate limiting with proper error messages', async () => {
      const connector = new GoogleDriveConnector();
      
      mockFetch.mockResolvedValueOnce({ ok: true });
      await connector.connect({ accessToken: 'token', clientId: 'id', clientSecret: 'secret' });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
      });

      await expect(connector.searchFiles('test'))
        .rejects.toThrow('Failed to search files: Too Many Requests');
    });
  });
});