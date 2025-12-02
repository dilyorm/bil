import { Request, Response, NextFunction } from 'express';
import { createClient } from 'redis';
import { config } from '../config';
import { logger } from '../utils/logger';

// Redis client for distributed rate limiting
let redisClient: ReturnType<typeof createClient> | null = null;

// Initialize Redis client for DDoS protection
export const initializeDDoSProtection = async () => {
  try {
    redisClient = createClient({ url: config.REDIS_URL });
    await redisClient.connect();
    logger.info('DDoS protection Redis client connected');
  } catch (error) {
    logger.error('Failed to connect DDoS protection Redis client:', error);
    // Fallback to in-memory protection
    redisClient = null;
  }
};

// In-memory fallback for rate limiting
const inMemoryStore = new Map<string, { count: number; resetTime: number }>();

// Advanced DDoS protection middleware
export const ddosProtection = (options: {
  windowMs: number;
  maxRequests: number;
  blockDurationMs: number;
  skipSuccessfulRequests?: boolean;
}) => {
  const { windowMs, maxRequests, blockDurationMs, skipSuccessfulRequests = false } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    const clientId = getClientIdentifier(req);
    const now = Date.now();
    const windowStart = now - windowMs;

    try {
      // Check if client is currently blocked
      const isBlocked = await isClientBlocked(clientId);
      if (isBlocked) {
        logger.warn('Blocked client attempted access', {
          clientId,
          ip: req.ip,
          path: req.path,
          userAgent: req.get('User-Agent'),
        });

        return res.status(429).json({
          error: 'Too Many Requests',
          message: 'Your IP has been temporarily blocked due to excessive requests',
          retryAfter: Math.ceil(blockDurationMs / 1000),
        });
      }

      // Get current request count
      const requestCount = await getRequestCount(clientId, windowStart);

      if (requestCount >= maxRequests) {
        // Block the client
        await blockClient(clientId, blockDurationMs);

        logger.warn('Client blocked for excessive requests', {
          clientId,
          ip: req.ip,
          requestCount,
          maxRequests,
          path: req.path,
        });

        return res.status(429).json({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Your IP has been temporarily blocked.',
          retryAfter: Math.ceil(blockDurationMs / 1000),
        });
      }

      // Increment request count
      await incrementRequestCount(clientId, windowMs);

      // Add rate limit headers
      res.set({
        'X-RateLimit-Limit': maxRequests.toString(),
        'X-RateLimit-Remaining': Math.max(0, maxRequests - requestCount - 1).toString(),
        'X-RateLimit-Reset': new Date(now + windowMs).toISOString(),
      });

      // Skip counting successful requests if configured
      if (skipSuccessfulRequests) {
        res.on('finish', () => {
          if (res.statusCode < 400) {
            decrementRequestCount(clientId).catch(err => 
              logger.error('Failed to decrement request count:', err)
            );
          }
        });
      }

      next();
    } catch (error) {
      logger.error('DDoS protection error:', error);
      // Fail open - allow request if protection system fails
      next();
    }
  };
};

// Get unique client identifier
function getClientIdentifier(req: Request): string {
  // Use multiple factors to identify clients
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const userAgent = req.get('User-Agent') || 'unknown';
  const forwarded = req.get('X-Forwarded-For') || '';
  
  // Create a hash of identifying factors
  const crypto = require('crypto');
  const identifier = `${ip}:${userAgent}:${forwarded}`;
  return crypto.createHash('sha256').update(identifier).digest('hex').substring(0, 16);
}

// Check if client is currently blocked
async function isClientBlocked(clientId: string): Promise<boolean> {
  const blockKey = `ddos:block:${clientId}`;
  
  if (redisClient) {
    const blocked = await redisClient.get(blockKey);
    return blocked !== null;
  } else {
    // In-memory fallback
    const blockData = inMemoryStore.get(blockKey);
    if (blockData && blockData.resetTime > Date.now()) {
      return true;
    } else if (blockData) {
      inMemoryStore.delete(blockKey);
    }
    return false;
  }
}

// Get current request count for client
async function getRequestCount(clientId: string, windowStart: number): Promise<number> {
  const countKey = `ddos:count:${clientId}`;
  
  if (redisClient) {
    // Use Redis sorted set to track requests in time window
    await redisClient.zRemRangeByScore(countKey, 0, windowStart);
    return await redisClient.zCard(countKey);
  } else {
    // In-memory fallback
    const countData = inMemoryStore.get(countKey);
    if (!countData || countData.resetTime < Date.now()) {
      return 0;
    }
    return countData.count;
  }
}

// Increment request count for client
async function incrementRequestCount(clientId: string, windowMs: number): Promise<void> {
  const countKey = `ddos:count:${clientId}`;
  const now = Date.now();
  
  if (redisClient) {
    // Add current timestamp to sorted set
    await redisClient.zAdd(countKey, { score: now, value: `${now}:${Math.random()}` });
    await redisClient.expire(countKey, Math.ceil(windowMs / 1000));
  } else {
    // In-memory fallback
    const countData = inMemoryStore.get(countKey);
    if (!countData || countData.resetTime < now) {
      inMemoryStore.set(countKey, { count: 1, resetTime: now + windowMs });
    } else {
      countData.count++;
    }
  }
}

// Decrement request count (for successful requests if configured)
async function decrementRequestCount(clientId: string): Promise<void> {
  const countKey = `ddos:count:${clientId}`;
  
  if (redisClient) {
    // Remove one entry from sorted set
    const entries = await redisClient.zRange(countKey, 0, 0);
    if (entries.length > 0) {
      await redisClient.zRem(countKey, entries[0]);
    }
  } else {
    // In-memory fallback
    const countData = inMemoryStore.get(countKey);
    if (countData && countData.count > 0) {
      countData.count--;
    }
  }
}

// Block client for specified duration
async function blockClient(clientId: string, blockDurationMs: number): Promise<void> {
  const blockKey = `ddos:block:${clientId}`;
  const blockUntil = Date.now() + blockDurationMs;
  
  if (redisClient) {
    await redisClient.setEx(blockKey, Math.ceil(blockDurationMs / 1000), blockUntil.toString());
  } else {
    // In-memory fallback
    inMemoryStore.set(blockKey, { count: 1, resetTime: blockUntil });
  }
}

// Cleanup function for graceful shutdown
export const cleanupDDoSProtection = async () => {
  if (redisClient) {
    await redisClient.quit();
    logger.info('DDoS protection Redis client disconnected');
  }
};

// Predefined DDoS protection configurations
export const ddosConfigs = {
  // Very strict protection for authentication endpoints
  auth: ddosProtection({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    blockDurationMs: 60 * 60 * 1000, // 1 hour block
  }),

  // Moderate protection for API endpoints
  api: ddosProtection({
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: 100,
    blockDurationMs: 15 * 60 * 1000, // 15 minutes block
    skipSuccessfulRequests: true,
  }),

  // Lenient protection for public endpoints
  public: ddosProtection({
    windowMs: 1 * 60 * 1000, // 1 minute
    maxRequests: 200,
    blockDurationMs: 5 * 60 * 1000, // 5 minutes block
    skipSuccessfulRequests: true,
  }),
};

// Suspicious activity detection
export const suspiciousActivityDetection = (req: Request, res: Response, next: NextFunction) => {
  const suspiciousIndicators = [];

  // Check for suspicious user agents
  const userAgent = req.get('User-Agent') || '';
  const suspiciousUserAgents = [
    /bot/i,
    /crawler/i,
    /spider/i,
    /scraper/i,
    /curl/i,
    /wget/i,
  ];

  if (suspiciousUserAgents.some(pattern => pattern.test(userAgent))) {
    suspiciousIndicators.push('suspicious_user_agent');
  }

  // Check for missing common headers
  if (!req.get('Accept') || !req.get('Accept-Language')) {
    suspiciousIndicators.push('missing_common_headers');
  }

  // Check for suspicious request patterns
  const path = req.path.toLowerCase();
  const suspiciousPaths = [
    /\.php$/,
    /\.asp$/,
    /\.jsp$/,
    /admin/,
    /wp-admin/,
    /phpmyadmin/,
  ];

  if (suspiciousPaths.some(pattern => pattern.test(path))) {
    suspiciousIndicators.push('suspicious_path');
  }

  // Log suspicious activity
  if (suspiciousIndicators.length > 0) {
    logger.warn('Suspicious activity detected', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      userAgent,
      indicators: suspiciousIndicators,
    });

    // Add suspicious activity header for monitoring
    res.set('X-Suspicious-Activity', suspiciousIndicators.join(','));
  }

  next();
};