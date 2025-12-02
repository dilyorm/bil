import { UserModel, CreateUserData } from '../database/models/User';
import { RefreshTokenModel } from '../database/models/RefreshToken';
import { PasswordService } from './password';
import { JWTService, TokenPair } from './jwt';

export interface LoginCredentials {
  email: string;
  password: string;
  deviceId?: string;
}

export interface RegisterData {
  email: string;
  name: string;
  password: string;
}

export interface AuthResult {
  user: {
    id: string;
    email: string;
    name: string;
    preferences: Record<string, any>;
  };
  tokens: TokenPair;
}

export class AuthService {
  /**
   * Register a new user
   */
  static async register(registerData: RegisterData): Promise<AuthResult> {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(registerData.email)) {
      throw new Error('Invalid email format');
    }

    // Validate password strength
    const passwordValidation = PasswordService.validatePasswordStrength(registerData.password);
    if (!passwordValidation.isValid) {
      throw new Error(`Password validation failed: ${passwordValidation.errors.join(', ')}`);
    }

    // Check if user already exists
    const existingUser = await UserModel.findByEmail(registerData.email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Hash password
    const passwordHash = await PasswordService.hashPassword(registerData.password);

    // Create user
    const userData: CreateUserData = {
      email: registerData.email.toLowerCase().trim(),
      name: registerData.name.trim(),
      password_hash: passwordHash,
      preferences: {
        voiceSettings: {
          preferredVoice: 'default',
          speechRate: 1.0,
          wakeWordSensitivity: 0.7
        },
        privacySettings: {
          dataRetentionDays: 365,
          allowDataIntegration: false,
          permittedDataSources: []
        },
        aiPersonality: {
          responseStyle: 'friendly',
          verbosity: 'detailed',
          proactiveness: 5
        }
      }
    };

    const user = await UserModel.create(userData);

    // Generate tokens
    const tokenPayload = {
      userId: user.id,
      email: user.email
    };

    const tokens = JWTService.generateTokenPair(tokenPayload);

    // Store refresh token
    const refreshTokenExpiry = new Date();
    refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 7); // 7 days

    await RefreshTokenModel.create({
      user_id: user.id,
      token: tokens.refreshToken,
      expires_at: refreshTokenExpiry
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        preferences: user.preferences
      },
      tokens
    };
  }

  /**
   * Login user with email and password
   */
  static async login(credentials: LoginCredentials): Promise<AuthResult> {
    // Find user by email
    const user = await UserModel.findByEmail(credentials.email.toLowerCase().trim());
    if (!user) {
      throw new Error('Invalid email or password');
    }

    // Verify password
    const isPasswordValid = await PasswordService.verifyPassword(
      credentials.password,
      user.password_hash
    );

    if (!isPasswordValid) {
      throw new Error('Invalid email or password');
    }

    // Generate tokens
    const tokenPayload = {
      userId: user.id,
      email: user.email,
      ...(credentials.deviceId && { deviceId: credentials.deviceId })
    };

    const tokens = JWTService.generateTokenPair(tokenPayload);

    // Store refresh token
    const refreshTokenExpiry = new Date();
    refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 7); // 7 days

    await RefreshTokenModel.create({
      user_id: user.id,
      ...(credentials.deviceId && { device_id: credentials.deviceId }),
      token: tokens.refreshToken,
      expires_at: refreshTokenExpiry
    });

    // Update last active time
    await UserModel.updateLastActive(user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        preferences: user.preferences
      },
      tokens
    };
  }

  /**
   * Refresh access token using refresh token
   */
  static async refreshToken(refreshToken: string): Promise<TokenPair> {
    // Verify refresh token
    const payload = JWTService.verifyRefreshToken(refreshToken);

    // Find the refresh token in database
    const storedToken = await RefreshTokenModel.findByToken(refreshToken, payload.userId);
    if (!storedToken) {
      throw new Error('Invalid refresh token');
    }

    // Check if token is expired or revoked
    if (storedToken.expires_at < new Date() || storedToken.revoked_at) {
      throw new Error('Refresh token expired or revoked');
    }

    // Verify user still exists
    const user = await UserModel.findById(payload.userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Generate new token pair
    const newTokenPayload = {
      userId: user.id,
      email: user.email,
      ...(payload.deviceId && { deviceId: payload.deviceId })
    };

    const newTokens = JWTService.generateTokenPair(newTokenPayload);

    // Revoke old refresh token
    await RefreshTokenModel.revokeToken(storedToken.id);

    // Store new refresh token
    const newRefreshTokenExpiry = new Date();
    newRefreshTokenExpiry.setDate(newRefreshTokenExpiry.getDate() + 7); // 7 days

    await RefreshTokenModel.create({
      user_id: user.id,
      ...(payload.deviceId && { device_id: payload.deviceId }),
      token: newTokens.refreshToken,
      expires_at: newRefreshTokenExpiry
    });

    // Update last active time
    await UserModel.updateLastActive(user.id);

    return newTokens;
  }

  /**
   * Logout user by revoking refresh token
   */
  static async logout(refreshToken: string): Promise<void> {
    try {
      const payload = JWTService.verifyRefreshToken(refreshToken);
      const storedToken = await RefreshTokenModel.findByToken(refreshToken, payload.userId);
      
      if (storedToken) {
        await RefreshTokenModel.revokeToken(storedToken.id);
      }
    } catch (error) {
      // Silently handle invalid tokens during logout
      console.warn('Invalid refresh token during logout:', error);
    }
  }

  /**
   * Logout from all devices
   */
  static async logoutAll(userId: string): Promise<void> {
    await RefreshTokenModel.revokeAllUserTokens(userId);
  }

  /**
   * Logout from specific device
   */
  static async logoutDevice(deviceId: string): Promise<void> {
    await RefreshTokenModel.revokeDeviceTokens(deviceId);
  }

  /**
   * Get user's active sessions
   */
  static async getActiveSessions(userId: string) {
    const tokens = await RefreshTokenModel.getUserActiveTokens(userId);
    return tokens.map(token => ({
      id: token.id,
      deviceId: token.device_id,
      createdAt: token.created_at,
      expiresAt: token.expires_at
    }));
  }

  /**
   * Clean up expired tokens (should be run periodically)
   */
  static async cleanupExpiredTokens(): Promise<number> {
    return RefreshTokenModel.cleanupExpiredTokens();
  }
}