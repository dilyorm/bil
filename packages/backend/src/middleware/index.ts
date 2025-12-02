import express from 'express';
import cors from 'cors';
import { config, isProduction } from '../config';
import {
  securityHeaders,
  apiRateLimit,
  authRateLimit,
  sanitizeRequest,
  apiSecurityHeaders,
  securityLogger,
  corsSecurityCheck,
} from './security';

export const setupMiddleware = (app: express.Application) => {
  // Trust proxy if configured (for proper IP detection behind load balancers)
  if (config.security.trustProxy) {
    app.set('trust proxy', true);
  }

  // Enhanced security headers
  app.use(securityHeaders);

  // Security logging and monitoring
  app.use(securityLogger);

  // CORS configuration with security checks
  const corsOrigins = config.CORS_ORIGIN.split(',').map(origin => origin.trim());
  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);
      
      if (corsOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        return callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['X-Total-Count', 'X-Rate-Limit-Remaining'],
  }));

  // CORS security monitoring
  app.use(corsSecurityCheck);

  // Request sanitization
  app.use(sanitizeRequest);

  // Body parsing middleware with size limits
  const bodyLimit = isProduction ? '1mb' : '10mb';
  app.use(express.json({ 
    limit: bodyLimit,
    verify: (req, res, buf) => {
      // Store raw body for webhook verification if needed
      (req as any).rawBody = buf;
    }
  }));
  app.use(express.urlencoded({ 
    extended: true, 
    limit: bodyLimit,
    parameterLimit: 100 // Limit number of parameters
  }));

  // API security headers
  app.use('/api', apiSecurityHeaders);

  // Rate limiting - different limits for different endpoints
  app.use('/api', apiRateLimit);
  app.use('/api/auth', authRateLimit);

  // Disable X-Powered-By header
  app.disable('x-powered-by');

  // Request logging in development or when explicitly enabled
  if (!isProduction || config.logging.enableRequestLogging) {
    app.use((req, res, next) => {
      const timestamp = new Date().toISOString();
      console.log(`${timestamp} - ${req.method} ${req.path} - ${req.ip}`);
      next();
    });
  }

  // Health check endpoint (before other middleware that might interfere)
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: config.NODE_ENV,
    });
  });
};