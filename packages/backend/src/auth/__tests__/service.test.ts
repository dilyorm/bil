import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthService, RegisterData, LoginCredentials } from '../service';

// Mock dependencies
vi.mock('../password');
vi.mock('../jwt');
vi.mock('../../database/models/User');
vi.mock('../../database/models/RefreshToken');

import { PasswordService } from '../password';
import { JWTService } from '../jwt';
import { UserModel } from '../../database/models/User';
import { RefreshTokenModel } from '../../database/models/RefreshToken';

describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('register', () => {
    const validRegisterData: RegisterData = {
      email: 'test@example.com',
      name: 'Test User',
      password: 'StrongPassword123!'
    };

    it('should register a new user successfully', async () => {
      // Mock dependencies
      vi.mocked(PasswordService.validatePasswordStrength).mockReturnValue({
        isValid: true,
        errors: []
      });
      vi.mocked(UserModel.findByEmail).mockResolvedValue(null);
      vi.mocked(PasswordService.hashPassword).mockResolvedValue('hashed-password');
      vi.mocked(UserModel.create).mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
        name: 'Test User',
        preferences: {}
      } as any);
      vi.mocked(JWTService.generateTokenPair).mockReturnValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token'
      });
      vi.mocked(RefreshTokenModel.create).mockResolvedValue({} as any);

      const result = await AuthService.register(validRegisterData);

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('tokens');
      expect(result.user.email).toBe('test@example.com');
      expect(result.tokens.accessToken).toBe('access-token');
      expect(result.tokens.refreshToken).toBe('refresh-token');
    });

    it('should throw error for invalid email format', async () => {
      const invalidData = { ...validRegisterData, email: 'invalid-email' };

      await expect(AuthService.register(invalidData)).rejects.toThrow('Invalid email format');
    });

    it('should throw error for weak password', async () => {
      vi.mocked(PasswordService.validatePasswordStrength).mockReturnValue({
        isValid: false,
        errors: ['Password too weak']
      });

      await expect(AuthService.register(validRegisterData)).rejects.toThrow(
        'Password validation failed: Password too weak'
      );
    });

    it('should throw error if user already exists', async () => {
      vi.mocked(PasswordService.validatePasswordStrength).mockReturnValue({
        isValid: true,
        errors: []
      });
      vi.mocked(UserModel.findByEmail).mockResolvedValue({
        id: 'existing-user',
        email: 'test@example.com'
      } as any);

      await expect(AuthService.register(validRegisterData)).rejects.toThrow(
        'User with this email already exists'
      );
    });

    it('should normalize email to lowercase and trim when creating user', async () => {
      const dataWithUppercaseEmail = {
        ...validRegisterData,
        email: 'TEST@EXAMPLE.COM'
      };

      vi.mocked(PasswordService.validatePasswordStrength).mockReturnValue({
        isValid: true,
        errors: []
      });
      vi.mocked(UserModel.findByEmail).mockResolvedValue(null);
      vi.mocked(PasswordService.hashPassword).mockResolvedValue('hashed-password');
      vi.mocked(UserModel.create).mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
        name: 'Test User',
        preferences: {}
      } as any);
      vi.mocked(JWTService.generateTokenPair).mockReturnValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token'
      });
      vi.mocked(RefreshTokenModel.create).mockResolvedValue({} as any);

      await AuthService.register(dataWithUppercaseEmail);

      // findByEmail is called with original email for existence check
      expect(UserModel.findByEmail).toHaveBeenCalledWith('TEST@EXAMPLE.COM');
      // But user is created with normalized email
      expect(UserModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com'
        })
      );
    });

    it('should create user with default preferences', async () => {
      vi.mocked(PasswordService.validatePasswordStrength).mockReturnValue({
        isValid: true,
        errors: []
      });
      vi.mocked(UserModel.findByEmail).mockResolvedValue(null);
      vi.mocked(PasswordService.hashPassword).mockResolvedValue('hashed-password');
      vi.mocked(UserModel.create).mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
        name: 'Test User',
        preferences: {}
      } as any);
      vi.mocked(JWTService.generateTokenPair).mockReturnValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token'
      });
      vi.mocked(RefreshTokenModel.create).mockResolvedValue({} as any);

      await AuthService.register(validRegisterData);

      expect(UserModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          preferences: expect.objectContaining({
            voiceSettings: expect.any(Object),
            privacySettings: expect.any(Object),
            aiPersonality: expect.any(Object)
          })
        })
      );
    });
  });

  describe('login', () => {
    const validCredentials: LoginCredentials = {
      email: 'test@example.com',
      password: 'StrongPassword123!'
    };

    it('should login user successfully', async () => {
      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        name: 'Test User',
        password_hash: 'hashed-password',
        preferences: {}
      };

      vi.mocked(UserModel.findByEmail).mockResolvedValue(mockUser as any);
      vi.mocked(PasswordService.verifyPassword).mockResolvedValue(true);
      vi.mocked(JWTService.generateTokenPair).mockReturnValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token'
      });
      vi.mocked(RefreshTokenModel.create).mockResolvedValue({} as any);
      vi.mocked(UserModel.updateLastActive).mockResolvedValue();

      const result = await AuthService.login(validCredentials);

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('tokens');
      expect(result.user.email).toBe('test@example.com');
      expect(UserModel.updateLastActive).toHaveBeenCalledWith('user-id');
    });

    it('should throw error for non-existent user', async () => {
      vi.mocked(UserModel.findByEmail).mockResolvedValue(null);

      await expect(AuthService.login(validCredentials)).rejects.toThrow(
        'Invalid email or password'
      );
    });

    it('should throw error for incorrect password', async () => {
      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        password_hash: 'hashed-password'
      };

      vi.mocked(UserModel.findByEmail).mockResolvedValue(mockUser as any);
      vi.mocked(PasswordService.verifyPassword).mockResolvedValue(false);

      await expect(AuthService.login(validCredentials)).rejects.toThrow(
        'Invalid email or password'
      );
    });

    it('should include deviceId in token payload when provided', async () => {
      const credentialsWithDevice = {
        ...validCredentials,
        deviceId: 'device-123'
      };

      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        password_hash: 'hashed-password',
        preferences: {}
      };

      vi.mocked(UserModel.findByEmail).mockResolvedValue(mockUser as any);
      vi.mocked(PasswordService.verifyPassword).mockResolvedValue(true);
      vi.mocked(JWTService.generateTokenPair).mockReturnValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token'
      });
      vi.mocked(RefreshTokenModel.create).mockResolvedValue({} as any);
      vi.mocked(UserModel.updateLastActive).mockResolvedValue();

      await AuthService.login(credentialsWithDevice);

      expect(JWTService.generateTokenPair).toHaveBeenCalledWith(
        expect.objectContaining({
          deviceId: 'device-123'
        })
      );
    });
  });

  describe('refreshToken', () => {
    it('should refresh token successfully', async () => {
      const refreshToken = 'valid-refresh-token';
      const mockPayload = {
        userId: 'user-id',
        email: 'test@example.com'
      };
      const mockStoredToken = {
        id: 'token-id',
        expires_at: new Date(Date.now() + 86400000), // 1 day from now
        revoked_at: null
      };
      const mockUser = {
        id: 'user-id',
        email: 'test@example.com'
      };

      vi.mocked(JWTService.verifyRefreshToken).mockReturnValue(mockPayload as any);
      vi.mocked(RefreshTokenModel.findByToken).mockResolvedValue(mockStoredToken as any);
      vi.mocked(UserModel.findById).mockResolvedValue(mockUser as any);
      vi.mocked(JWTService.generateTokenPair).mockReturnValue({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token'
      });
      vi.mocked(RefreshTokenModel.revokeToken).mockResolvedValue();
      vi.mocked(RefreshTokenModel.create).mockResolvedValue({} as any);
      vi.mocked(UserModel.updateLastActive).mockResolvedValue();

      const result = await AuthService.refreshToken(refreshToken);

      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).toBe('new-refresh-token');
      expect(RefreshTokenModel.revokeToken).toHaveBeenCalledWith('token-id');
    });

    it('should throw error for invalid refresh token', async () => {
      vi.mocked(JWTService.verifyRefreshToken).mockImplementation(() => {
        throw new Error('Invalid refresh token');
      });

      await expect(AuthService.refreshToken('invalid-token')).rejects.toThrow(
        'Invalid refresh token'
      );
    });

    it('should throw error for expired stored token', async () => {
      const mockPayload = {
        userId: 'user-id',
        email: 'test@example.com'
      };
      const mockStoredToken = {
        id: 'token-id',
        expires_at: new Date(Date.now() - 86400000), // 1 day ago
        revoked_at: null
      };

      vi.mocked(JWTService.verifyRefreshToken).mockReturnValue(mockPayload as any);
      vi.mocked(RefreshTokenModel.findByToken).mockResolvedValue(mockStoredToken as any);

      await expect(AuthService.refreshToken('expired-token')).rejects.toThrow(
        'Refresh token expired or revoked'
      );
    });

    it('should throw error for revoked token', async () => {
      const mockPayload = {
        userId: 'user-id',
        email: 'test@example.com'
      };
      const mockStoredToken = {
        id: 'token-id',
        expires_at: new Date(Date.now() + 86400000),
        revoked_at: new Date()
      };

      vi.mocked(JWTService.verifyRefreshToken).mockReturnValue(mockPayload as any);
      vi.mocked(RefreshTokenModel.findByToken).mockResolvedValue(mockStoredToken as any);

      await expect(AuthService.refreshToken('revoked-token')).rejects.toThrow(
        'Refresh token expired or revoked'
      );
    });
  });

  describe('logout', () => {
    it('should logout successfully', async () => {
      const refreshToken = 'valid-refresh-token';
      const mockPayload = {
        userId: 'user-id',
        email: 'test@example.com'
      };
      const mockStoredToken = {
        id: 'token-id'
      };

      vi.mocked(JWTService.verifyRefreshToken).mockReturnValue(mockPayload as any);
      vi.mocked(RefreshTokenModel.findByToken).mockResolvedValue(mockStoredToken as any);
      vi.mocked(RefreshTokenModel.revokeToken).mockResolvedValue();

      await expect(AuthService.logout(refreshToken)).resolves.not.toThrow();
      expect(RefreshTokenModel.revokeToken).toHaveBeenCalledWith('token-id');
    });

    it('should handle invalid token gracefully', async () => {
      vi.mocked(JWTService.verifyRefreshToken).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(AuthService.logout('invalid-token')).resolves.not.toThrow();
    });
  });

  describe('logoutAll', () => {
    it('should logout from all devices', async () => {
      const userId = 'user-id';
      vi.mocked(RefreshTokenModel.revokeAllUserTokens).mockResolvedValue();

      await AuthService.logoutAll(userId);

      expect(RefreshTokenModel.revokeAllUserTokens).toHaveBeenCalledWith(userId);
    });
  });

  describe('logoutDevice', () => {
    it('should logout from specific device', async () => {
      const deviceId = 'device-id';
      vi.mocked(RefreshTokenModel.revokeDeviceTokens).mockResolvedValue();

      await AuthService.logoutDevice(deviceId);

      expect(RefreshTokenModel.revokeDeviceTokens).toHaveBeenCalledWith(deviceId);
    });
  });

  describe('getActiveSessions', () => {
    it('should return active sessions', async () => {
      const userId = 'user-id';
      const mockTokens = [
        {
          id: 'token-1',
          device_id: 'device-1',
          created_at: new Date(),
          expires_at: new Date()
        },
        {
          id: 'token-2',
          device_id: 'device-2',
          created_at: new Date(),
          expires_at: new Date()
        }
      ];

      vi.mocked(RefreshTokenModel.getUserActiveTokens).mockResolvedValue(mockTokens as any);

      const sessions = await AuthService.getActiveSessions(userId);

      expect(sessions).toHaveLength(2);
      expect(sessions[0]).toHaveProperty('id', 'token-1');
      expect(sessions[0]).toHaveProperty('deviceId', 'device-1');
      expect(sessions[1]).toHaveProperty('id', 'token-2');
      expect(sessions[1]).toHaveProperty('deviceId', 'device-2');
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('should cleanup expired tokens', async () => {
      const expectedCount = 5;
      vi.mocked(RefreshTokenModel.cleanupExpiredTokens).mockResolvedValue(expectedCount);

      const result = await AuthService.cleanupExpiredTokens();

      expect(result).toBe(expectedCount);
      expect(RefreshTokenModel.cleanupExpiredTokens).toHaveBeenCalled();
    });
  });
});