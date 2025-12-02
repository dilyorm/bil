import * as jwt from 'jsonwebtoken';
import { config } from '../config';

export interface JWTPayload {
  userId: string;
  email: string;
  deviceId?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export class JWTService {
  static generateAccessToken(payload: JWTPayload): string {
    const options: any = {
      expiresIn: config.JWT_EXPIRES_IN,
      issuer: 'bil-core-system',
      audience: 'bil-clients',
    };
    return jwt.sign(payload as object, config.JWT_SECRET as string, options);
  }

  static generateRefreshToken(payload: JWTPayload): string {
    const options: any = {
      expiresIn: config.JWT_REFRESH_EXPIRES_IN,
      issuer: 'bil-core-system',
      audience: 'bil-clients',
    };
    return jwt.sign(payload as object, config.JWT_REFRESH_SECRET as string, options);
  }

  static generateTokenPair(payload: JWTPayload): TokenPair {
    return {
      accessToken: this.generateAccessToken(payload),
      refreshToken: this.generateRefreshToken(payload),
    };
  }

  static verifyAccessToken(token: string): JWTPayload {
    try {
      const options: any = {
        issuer: 'bil-core-system',
        audience: 'bil-clients',
      };
      const decoded = jwt.verify(token, config.JWT_SECRET as string, options) as unknown as JWTPayload;
      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Access token expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid access token');
      }
      throw error;
    }
  }

  static verifyRefreshToken(token: string): JWTPayload {
    try {
      const options: any = {
        issuer: 'bil-core-system',
        audience: 'bil-clients',
      };
      const decoded = jwt.verify(token, config.JWT_REFRESH_SECRET as string, options) as unknown as JWTPayload;
      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Refresh token expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid refresh token');
      }
      throw error;
    }
  }

  static getTokenExpirationTime(token: string): Date | null {
    try {
      const decoded = jwt.decode(token) as any;
      if (decoded && decoded.exp) {
        return new Date(decoded.exp * 1000);
      }
      return null;
    } catch {
      return null;
    }
  }
}