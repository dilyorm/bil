import { Router, Request, Response } from 'express';
import { healthCheckService } from '../monitoring/health';
import { applicationMetrics } from '../monitoring/metrics';
import { performanceMonitor } from '../monitoring/performance';
import { alertingService } from '../monitoring/alerting';
import { asyncHandler } from '../errors/handler';

const router = Router();

// Basic health check
router.get('/', healthCheckService.basicHealthCheck);

// Detailed health check for monitoring systems
router.get('/detailed', asyncHandler(healthCheckService.detailedHealthCheck));

// Kubernetes-style readiness check
router.get('/ready', asyncHandler(healthCheckService.readinessCheck));

// Kubernetes-style liveness check
router.get('/live', asyncHandler(healthCheckService.livenessCheck));

// Metrics endpoint
router.get('/metrics', asyncHandler(async (req: Request, res: Response) => {
  const metrics = applicationMetrics.getMetricsCollector().getAllMetrics();
  res.json({
    timestamp: new Date().toISOString(),
    metrics
  });
}));

// Performance endpoint
router.get('/performance', asyncHandler(async (req: Request, res: Response) => {
  const summary = performanceMonitor.getPerformanceSummary();
  res.json(summary);
}));

// Performance check endpoint (manual trigger)
router.post('/performance/check', asyncHandler(async (req: Request, res: Response) => {
  const metrics = await performanceMonitor.performManualCheck();
  res.json({
    message: 'Performance check completed',
    metrics
  });
}));

// Alerts endpoint
router.get('/alerts', asyncHandler(async (req: Request, res: Response) => {
  const { severity, limit } = req.query;
  
  let alerts;
  if (severity) {
    alerts = alertingService.getAlertsBySeverity(severity as any);
  } else {
    alerts = alertingService.getAlertHistory(limit ? parseInt(limit as string) : 100);
  }
  
  res.json({
    alerts,
    activeCount: alertingService.getActiveAlerts().length
  });
}));

// Active alerts endpoint
router.get('/alerts/active', asyncHandler(async (req: Request, res: Response) => {
  const activeAlerts = alertingService.getActiveAlerts();
  res.json({
    alerts: activeAlerts,
    count: activeAlerts.length
  });
}));

export default router;