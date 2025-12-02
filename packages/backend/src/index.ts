// BIL Core System Backend API Entry Point
import express from 'express';
import { createServer } from 'http';
import { config, isProduction } from './config';
import { setupMiddleware } from './middleware';
import healthRoutes from './routes/health';
import { db, migrationManager } from './database/models';
import { DeviceSyncServer, DeviceSyncManager } from './sync';
import { syncServiceLocator } from './sync/service';
import { errorMiddleware } from './errors/handler';
import { applicationMetrics } from './monitoring/metrics';
import { systemLogger, requestLogger } from './utils/logger';

const app = express();
const httpServer = createServer(app);

// Initialize WebSocket server
let syncServer: DeviceSyncServer;
let syncManager: DeviceSyncManager;

// Initialize database
async function initializeDatabase() {
  try {
    console.log('🔄 Initializing database connection...');
    const isConnected = await db.testConnection();
    
    if (!isConnected) {
      throw new Error('Failed to connect to database');
    }

    console.log('🔄 Running database migrations...');
    await migrationManager.runMigrations();
    
    console.log('✅ Database initialized successfully');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    console.log('⚠️  Running in NO-DATABASE mode (desktop control will still work)');
    // Don't exit - allow server to run without database for testing
  }
}

// Setup middleware
setupMiddleware(app);

// Add request logging and metrics middleware
app.use(requestLogger(systemLogger));
app.use(applicationMetrics.apiMetricsMiddleware());

// Import routes
import authRoutes from './routes/auth';
import aiRoutes from './routes/ai';
import deviceRoutes from './routes/devices';
import syncRoutes from './routes/sync';
import dataRoutes from './routes/data';
import desktopAgentRoutes from './routes/desktop-agent';

// Routes
app.use('/health', healthRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/data', dataRoutes);
app.use('/api/desktop-agent', desktopAgentRoutes);

// API routes placeholder
app.use('/api', (req, res) => {
  res.status(404).json({
    error: 'API endpoint not found',
    message: 'This endpoint is not yet implemented',
    path: req.path
  });
});

// Global error handler
app.use(errorMiddleware);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: 'The requested resource was not found',
    path: req.originalUrl
  });
});

// Start server after database initialization
async function startServer() {
  await initializeDatabase();
  
  // Initialize WebSocket server
  syncServer = new DeviceSyncServer(httpServer);
  syncManager = new DeviceSyncManager(syncServer);
  
  // Register services in service locator
  syncServiceLocator.setSyncServer(syncServer);
  syncServiceLocator.setSyncManager(syncManager);
  
  const server = httpServer.listen(config.PORT, () => {
    console.log(`🚀 BIL Core API server running on port ${config.PORT}`);
    console.log(`📊 Environment: ${config.NODE_ENV}`);
    console.log(`🔗 Health check: http://localhost:${config.PORT}/health`);
    console.log(`🔌 WebSocket server initialized`);
  });

  return server;
}

// Initialize and start server
const serverPromise = startServer();

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  const server = await serverPromise;
  
  // Close WebSocket server
  if (syncServer) {
    await syncServer.close();
  }
  
  server.close(async () => {
    await db.close();
    console.log('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  const server = await serverPromise;
  
  // Close WebSocket server
  if (syncServer) {
    await syncServer.close();
  }
  
  server.close(async () => {
    await db.close();
    console.log('Process terminated');
    process.exit(0);
  });
});

// Export instances for use in other modules
export { syncServer, syncManager };
export default app;
