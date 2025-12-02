import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticateToken } from '../auth/middleware';
import { DataIntegrationService } from '../data/service';
import { DataSourceType } from '../data/types';
import { db } from '../database/connection';

const router = Router();
const dataService = new DataIntegrationService(db.getPool());

// Validation schemas
const connectDataSourceSchema = z.object({
  sourceType: z.nativeEnum(DataSourceType),
  credentials: z.object({
    accessToken: z.string().optional(),
    refreshToken: z.string().optional(),
    clientId: z.string().optional(),
    clientSecret: z.string().optional(),
    basePath: z.string().optional(),
    allowedPaths: z.array(z.string()).optional(),
    readOnly: z.boolean().optional(),
  }),
  name: z.string().optional(),
});

const grantPermissionSchema = z.object({
  sourceType: z.nativeEnum(DataSourceType),
  permissions: z.array(z.string()),
  purpose: z.string(),
  expiresAt: z.string().datetime().optional(),
});

const searchFilesSchema = z.object({
  sourceType: z.nativeEnum(DataSourceType),
  query: z.string().min(1),
});

const getFileContentSchema = z.object({
  sourceType: z.nativeEnum(DataSourceType),
  fileId: z.string().min(1),
});

const getCalendarEventsSchema = z.object({
  calendarId: z.string().optional(),
  timeMin: z.string().datetime().optional(),
  timeMax: z.string().datetime().optional(),
});

// Connect data source
router.post('/sources/connect', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { sourceType, credentials, name } = connectDataSourceSchema.parse(req.body);
    const userId = req.user!.id;

    const credentialsWithType = { ...credentials, type: sourceType };
    const dataSource = await dataService.connectDataSource(userId, sourceType, credentialsWithType, name);

    res.status(201).json({
      success: true,
      data: {
        id: dataSource.id,
        type: dataSource.type,
        name: dataSource.name,
        isActive: dataSource.isActive,
        createdAt: dataSource.createdAt,
      },
    });
  } catch (error) {
    console.error('Connect data source error:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to connect data source',
    });
  }
});

// Disconnect data source
router.delete('/sources/:sourceType', authenticateToken, async (req: Request, res: Response) => {
  try {
    const sourceType = req.params.sourceType as DataSourceType;
    const userId = req.user!.id;

    if (!Object.values(DataSourceType).includes(sourceType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid source type',
      });
    }

    await dataService.disconnectDataSource(userId, sourceType);

    res.json({
      success: true,
      message: 'Data source disconnected successfully',
    });
  } catch (error) {
    console.error('Disconnect data source error:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to disconnect data source',
    });
  }
});

// Get user data sources
router.get('/sources', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const dataSources = await dataService.getUserDataSources(userId);

    // Remove sensitive credential information
    const sanitizedSources = dataSources.map(source => ({
      id: source.id,
      type: source.type,
      name: source.name,
      isActive: source.isActive,
      createdAt: source.createdAt,
      updatedAt: source.updatedAt,
      lastSyncAt: source.lastSyncAt,
    }));

    res.json({
      success: true,
      data: sanitizedSources,
    });
  } catch (error) {
    console.error('Get data sources error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve data sources',
    });
  }
});

// Grant permission
router.post('/permissions/grant', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { sourceType, permissions, purpose, expiresAt } = grantPermissionSchema.parse(req.body);
    const userId = req.user!.id;

    const expirationDate = expiresAt ? new Date(expiresAt) : undefined;

    await dataService.grantDataPermission(userId, sourceType, permissions, purpose, expirationDate);

    res.status(201).json({
      success: true,
      message: 'Permission granted successfully',
    });
  } catch (error) {
    console.error('Grant permission error:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to grant permission',
    });
  }
});

// Revoke permission
router.delete('/permissions/:sourceType', authenticateToken, async (req: Request, res: Response) => {
  try {
    const sourceType = req.params.sourceType as DataSourceType;
    const userId = req.user!.id;

    if (!Object.values(DataSourceType).includes(sourceType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid source type',
      });
    }

    await dataService.revokeDataPermission(userId, sourceType);

    res.json({
      success: true,
      message: 'Permission revoked successfully',
    });
  } catch (error) {
    console.error('Revoke permission error:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to revoke permission',
    });
  }
});

// Get user permissions
router.get('/permissions', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const permissions = await dataService.getUserPermissions(userId);

    res.json({
      success: true,
      data: permissions,
    });
  } catch (error) {
    console.error('Get permissions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve permissions',
    });
  }
});

// Get calendar events
router.get('/calendar/events', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { calendarId, timeMin, timeMax } = getCalendarEventsSchema.parse(req.query);
    const userId = req.user!.id;

    const timeMinDate = timeMin ? new Date(timeMin) : undefined;
    const timeMaxDate = timeMax ? new Date(timeMax) : undefined;

    const events = await dataService.getCalendarEvents(userId, calendarId, timeMinDate, timeMaxDate);

    res.json({
      success: true,
      data: events,
    });
  } catch (error) {
    console.error('Get calendar events error:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to retrieve calendar events',
    });
  }
});

// Search files
router.post('/files/search', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { sourceType, query } = searchFilesSchema.parse(req.body);
    const userId = req.user!.id;

    const files = await dataService.searchFiles(userId, sourceType, query);

    res.json({
      success: true,
      data: files,
    });
  } catch (error) {
    console.error('Search files error:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to search files',
    });
  }
});

// Get file content
router.post('/files/content', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { sourceType, fileId } = getFileContentSchema.parse(req.body);
    const userId = req.user!.id;

    const content = await dataService.getFileContent(userId, sourceType, fileId);

    // Set appropriate headers for file download
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', content.length);
    
    res.send(content);
  } catch (error) {
    console.error('Get file content error:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to retrieve file content',
    });
  }
});

// Get data access logs
router.get('/logs', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const sourceType = req.query.sourceType as DataSourceType | undefined;
    
    const logs = await dataService.getDataAccessLogs(userId, sourceType);

    res.json({
      success: true,
      data: logs,
    });
  } catch (error) {
    console.error('Get access logs error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve access logs',
    });
  }
});

// Get permission statistics
router.get('/stats', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const stats = await dataService.getPermissionStats(userId);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Get permission stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve permission statistics',
    });
  }
});

export default router;