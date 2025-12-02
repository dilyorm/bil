import { Request, Response, NextFunction } from 'express';
import { JWTService, JWTPayload } from './jwt';
import { UserModel } from '../database/models/User';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload & { id: string };
    }
  }
}

export interface AuthenticatedRequest extends Request {
  user: JWTPayload & { id: string };
}

/**
 * Middleware to authenticate JWT tokens
 */
export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'Access token is missing'
      });
      return;
    }

    // Verify the token
    const payload = JWTService.verifyAccessToken(token);

    // Verify user still exists and is active
    const user = await UserModel.findById(payload.userId);
    if (!user) {
      res.status(401).json({
        error: 'Authentication failed',
        message: 'User not found'
      });
      return;
    }

    // Update user's last active time
    await UserModel.updateLastActive(user.id);

    // Add user info to request
    req.user = {
      ...payload,
      id: payload.userId
    };

    next();
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Access token expired') {
        res.status(401).json({
          error: 'Token expired',
          message: 'Access token has expired, please refresh'
        });
        return;
      } else if (error.message === 'Invalid access token') {
        res.status(401).json({
          error: 'Invalid token',
          message: 'Access token is invalid'
        });
        return;
      }
    }

    console.error('Authentication error:', error);
    res.status(500).json({
      error: 'Authentication error',
      message: 'An error occurred during authentication'
    });
  }
};

/**
 * Optional authentication middleware - doesn't fail if no token
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const payload = JWTService.verifyAccessToken(token);
      const user = await UserModel.findById(payload.userId);
      
      if (user) {
        await UserModel.updateLastActive(user.id);
        req.user = {
          ...payload,
          id: payload.userId
        };
      }
    }

    next();
  } catch (error) {
    // Silently continue without authentication
    next();
  }
};

/**
 * Middleware to check if user owns a resource
 */
export const requireOwnership = (resourceUserIdField: string = 'user_id') => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const resourceUserId = req.params[resourceUserIdField] || req.body[resourceUserIdField];
    
    if (!resourceUserId) {
      res.status(400).json({
        error: 'Bad request',
        message: 'Resource user ID is required'
      });
      return;
    }

    if (req.user.id !== resourceUserId) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'You can only access your own resources'
      });
      return;
    }

    next();
  };
};

/**
 * Middleware to validate device ownership
 */
export const requireDeviceOwnership = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const deviceId = req.params.deviceId || req.body.deviceId;
    
    if (!deviceId) {
      res.status(400).json({
        error: 'Bad request',
        message: 'Device ID is required'
      });
      return;
    }

    // Import DeviceModel here to avoid circular dependency
    const { DeviceModel } = await import('../database/models/Device');
    const device = await DeviceModel.findById(deviceId);

    if (!device) {
      res.status(404).json({
        error: 'Not found',
        message: 'Device not found'
      });
      return;
    }

    if (device.user_id !== req.user.id) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'You can only access your own devices'
      });
      return;
    }

    next();
  } catch (error) {
    console.error('Device ownership check error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'An error occurred while checking device ownership'
    });
  }
};