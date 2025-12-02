import { vi } from 'vitest';

// Make vi globally available
global.vi = vi;

// Set up test environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.JWT_SECRET = 'test-jwt-secret-key-that-is-at-least-32-characters-long';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-key-that-is-at-least-32-characters-long';
process.env.JWT_EXPIRES_IN = '1h';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.CORS_ORIGIN = 'http://localhost:3000';

// Mock database connection to prevent actual connections during tests
vi.mock('../database/connection', () => ({
  pool: {
    query: vi.fn(),
    connect: vi.fn(),
    end: vi.fn()
  }
}));