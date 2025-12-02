import { describe, it, expect, beforeAll, vi } from 'vitest';

// Mock the config module first
vi.mock('../../config', () => ({
  config: {
    JWT_SECRET: 'test-jwt-secret-key-that-is-at-least-32-characters-long',
    JWT_REFRESH_SECRET: 'test-jwt-refresh-secret-key-that-is-at-least-32-characters-long',
    JWT_EXPIRES_IN: '1h',
    JWT_REFRESH_EXPIRES_IN: '7d'
  }
}));

import { JWTService, JWTPayload } from '../jwt';

describe('JWTService', () => {
  const testPayload: JWTPayload = {
    userId: 'test-user-id',
    email: 'test@example.com',
    deviceId: 'test-device-id'
  };

  describe('generateAccessToken', () => {
    it('should generate a valid access token', () => {
      const token = JWTService.generateAccessToken(testPayload);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should generate different tokens for different payloads', () => {
      const payload1 = { ...testPayload, userId: 'user1' };
      const payload2 = { ...testPayload, userId: 'user2' };
      
      const token1 = JWTService.generateAccessToken(payload1);
      const token2 = JWTService.generateAccessToken(payload2);
      
      expect(token1).not.toBe(token2);
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a valid refresh token', () => {
      const token = JWTService.generateRefreshToken(testPayload);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should generate different refresh tokens from access tokens', () => {
      const accessToken = JWTService.generateAccessToken(testPayload);
      const refreshToken = JWTService.generateRefreshToken(testPayload);
      
      expect(accessToken).not.toBe(refreshToken);
    });
  });

  describe('generateTokenPair', () => {
    it('should generate both access and refresh tokens', () => {
      const tokenPair = JWTService.generateTokenPair(testPayload);
      
      expect(tokenPair).toHaveProperty('accessToken');
      expect(tokenPair).toHaveProperty('refreshToken');
      expect(typeof tokenPair.accessToken).toBe('string');
      expect(typeof tokenPair.refreshToken).toBe('string');
      expect(tokenPair.accessToken).not.toBe(tokenPair.refreshToken);
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify and decode a valid access token', () => {
      const token = JWTService.generateAccessToken(testPayload);
      const decoded = JWTService.verifyAccessToken(token);
      
      expect(decoded.userId).toBe(testPayload.userId);
      expect(decoded.email).toBe(testPayload.email);
      expect(decoded.deviceId).toBe(testPayload.deviceId);
    });

    it('should throw error for invalid access token', () => {
      expect(() => {
        JWTService.verifyAccessToken('invalid-token');
      }).toThrow('Invalid access token');
    });

    it('should throw error for malformed token', () => {
      expect(() => {
        JWTService.verifyAccessToken('not.a.jwt');
      }).toThrow('Invalid access token');
    });

    it('should not verify refresh token as access token', () => {
      const refreshToken = JWTService.generateRefreshToken(testPayload);
      
      expect(() => {
        JWTService.verifyAccessToken(refreshToken);
      }).toThrow('Invalid access token');
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify and decode a valid refresh token', () => {
      const token = JWTService.generateRefreshToken(testPayload);
      const decoded = JWTService.verifyRefreshToken(token);
      
      expect(decoded.userId).toBe(testPayload.userId);
      expect(decoded.email).toBe(testPayload.email);
      expect(decoded.deviceId).toBe(testPayload.deviceId);
    });

    it('should throw error for invalid refresh token', () => {
      expect(() => {
        JWTService.verifyRefreshToken('invalid-token');
      }).toThrow('Invalid refresh token');
    });

    it('should not verify access token as refresh token', () => {
      const accessToken = JWTService.generateAccessToken(testPayload);
      
      expect(() => {
        JWTService.verifyRefreshToken(accessToken);
      }).toThrow('Invalid refresh token');
    });
  });

  describe('getTokenExpirationTime', () => {
    it('should return expiration time for valid token', () => {
      const token = JWTService.generateAccessToken(testPayload);
      const expirationTime = JWTService.getTokenExpirationTime(token);
      
      expect(expirationTime).toBeInstanceOf(Date);
      expect(expirationTime!.getTime()).toBeGreaterThan(Date.now());
    });

    it('should return null for invalid token', () => {
      const expirationTime = JWTService.getTokenExpirationTime('invalid-token');
      expect(expirationTime).toBeNull();
    });

    it('should return null for malformed token', () => {
      const expirationTime = JWTService.getTokenExpirationTime('not.a.jwt');
      expect(expirationTime).toBeNull();
    });
  });

  describe('token payload validation', () => {
    it('should handle payload without deviceId', () => {
      const payloadWithoutDevice = {
        userId: testPayload.userId,
        email: testPayload.email
      };
      
      const token = JWTService.generateAccessToken(payloadWithoutDevice);
      const decoded = JWTService.verifyAccessToken(token);
      
      expect(decoded.userId).toBe(payloadWithoutDevice.userId);
      expect(decoded.email).toBe(payloadWithoutDevice.email);
      expect(decoded.deviceId).toBeUndefined();
    });

    it('should include standard JWT claims', () => {
      const token = JWTService.generateAccessToken(testPayload);
      const decoded = JWTService.verifyAccessToken(token);
      
      // JWT should include standard claims set by the service
      expect(decoded).toHaveProperty('iss'); // issuer
      expect(decoded).toHaveProperty('aud'); // audience
      expect(decoded).toHaveProperty('exp'); // expiration
      expect(decoded).toHaveProperty('iat'); // issued at
    });
  });
});