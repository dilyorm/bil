import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables
dotenv.config();

// Environment validation schema
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
  
  // Database
  DATABASE_URL: z.string().min(1, 'Database URL is required'),
  REDIS_URL: z.string().min(1, 'Redis URL is required'),
  
  // JWT
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT refresh secret must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('1h'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  
  // External APIs
  OPENAI_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  WHISPER_API_KEY: z.string().optional(),
  ELEVENLABS_API_KEY: z.string().optional(),
  
  // Data Integration
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  DROPBOX_CLIENT_ID: z.string().optional(),
  DROPBOX_CLIENT_SECRET: z.string().optional(),
  
  // CORS
  CORS_ORIGIN: z.string().default('http://localhost:3000,http://localhost:5173'),
  
  // Security
  HELMET_CSP_ENABLED: z.string().transform(val => val === 'true').default('false'),
  TRUST_PROXY: z.string().transform(val => val === 'true').default('false'),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('60000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('100'),
  AUTH_RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('900000'), // 15 minutes
  AUTH_RATE_LIMIT_MAX_ATTEMPTS: z.string().transform(Number).default('20'), // higher in dev
  
  // File Upload
  MAX_FILE_SIZE: z.string().transform(Number).default('10485760'), // 10MB
  UPLOAD_PATH: z.string().default('/tmp/uploads'),
  
  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  ENABLE_REQUEST_LOGGING: z.string().transform(val => val === 'true').default('false'),
  
  // Feature Flags
  ENABLE_EXPERIMENTAL_FEATURES: z.string().transform(val => val === 'true').default('false'),
  ENABLE_DEBUG_ENDPOINTS: z.string().transform(val => val === 'true').default('false'),
  
  // Performance
  CLUSTER_MODE: z.string().transform(val => val === 'true').default('false'),
  CLUSTER_WORKERS: z.string().transform(Number).default('0'),
});

// Validate and export configuration
const parseResult = envSchema.safeParse(process.env);

if (!parseResult.success) {
  console.error('❌ Invalid environment configuration:');
  parseResult.error.issues.forEach((issue) => {
    console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  });
  process.exit(1);
}

const envData = parseResult.data;

export const config = {
  ...envData,
  openai: {
    apiKey: envData.OPENAI_API_KEY,
    model: 'gpt-3.5-turbo',
  },
  gemini: {
    apiKey: envData.GEMINI_API_KEY,
    model: 'gemini-1.5-flash',
  },
  speech: {
    whisperApiKey: envData.WHISPER_API_KEY,
    elevenLabsApiKey: envData.ELEVENLABS_API_KEY,
  },
  dataIntegration: {
    google: {
      clientId: envData.GOOGLE_CLIENT_ID,
      clientSecret: envData.GOOGLE_CLIENT_SECRET,
    },
    dropbox: {
      clientId: envData.DROPBOX_CLIENT_ID,
      clientSecret: envData.DROPBOX_CLIENT_SECRET,
    },
  },
  security: {
    helmetCspEnabled: envData.HELMET_CSP_ENABLED,
    trustProxy: envData.TRUST_PROXY,
  },
  rateLimit: {
    windowMs: envData.RATE_LIMIT_WINDOW_MS,
    maxRequests: envData.RATE_LIMIT_MAX_REQUESTS,
    authWindowMs: envData.AUTH_RATE_LIMIT_WINDOW_MS,
    authMaxAttempts: envData.AUTH_RATE_LIMIT_MAX_ATTEMPTS,
  },
  upload: {
    maxFileSize: envData.MAX_FILE_SIZE,
    uploadPath: envData.UPLOAD_PATH,
  },
  logging: {
    level: envData.LOG_LEVEL,
    enableRequestLogging: envData.ENABLE_REQUEST_LOGGING,
  },
  features: {
    enableExperimentalFeatures: envData.ENABLE_EXPERIMENTAL_FEATURES,
    enableDebugEndpoints: envData.ENABLE_DEBUG_ENDPOINTS,
  },
  performance: {
    clusterMode: envData.CLUSTER_MODE,
    clusterWorkers: envData.CLUSTER_WORKERS,
  },
};

// Helper to check if we're in production
export const isProduction = config.NODE_ENV === 'production';
export const isDevelopment = config.NODE_ENV === 'development';
export const isTest = config.NODE_ENV === 'test';