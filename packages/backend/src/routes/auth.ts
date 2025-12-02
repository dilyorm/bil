import { Router } from 'express';
import { z } from 'zod';
import { AuthService } from '../auth/service';
import { authenticateToken, AuthenticatedRequest } from '../auth/middleware';

const router = Router();

// Validation schemas
const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  name: z.string().min(1, 'Name is required').max(255, 'Name too long'),
  password: z.string().min(8, 'Password must be at least 8 characters')
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
  deviceId: z.string().uuid().optional()
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required')
});

/**
 * POST /auth/register
 * Register a new user account
 */
router.post('/register', async (req, res) => {
  try {
    const validatedData = registerSchema.parse(req.body);
    
    const result = await AuthService.register(validatedData);
    
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: result
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation error',
        message: 'Invalid input data',
        details: error.errors
      });
      return;
    }

    if (error instanceof Error) {
      if (error.message.includes('already exists')) {
        res.status(409).json({
          error: 'Conflict',
          message: error.message
        });
        return;
      }

      if (error.message.includes('Password validation failed')) {
        res.status(400).json({
          error: 'Validation error',
          message: error.message
        });
        return;
      }
    }

    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'An error occurred during registration'
    });
  }
});

/**
 * POST /auth/login
 * Login with email and password
 */
router.post('/login', async (req, res) => {
  try {
    const validatedData = loginSchema.parse(req.body);
    
    const result = await AuthService.login({
      email: validatedData.email,
      password: validatedData.password,
      ...(validatedData.deviceId && { deviceId: validatedData.deviceId })
    });
    
    res.json({
      success: true,
      message: 'Login successful',
      data: result
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation error',
        message: 'Invalid input data',
        details: error.errors
      });
      return;
    }

    if (error instanceof Error) {
      if (error.message.includes('Invalid email or password')) {
        res.status(401).json({
          error: 'Authentication failed',
          message: 'Invalid email or password'
        });
        return;
      }
    }

    console.error('Login error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'An error occurred during login'
    });
  }
});

/**
 * POST /auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', async (req, res) => {
  try {
    const validatedData = refreshTokenSchema.parse(req.body);
    
    const tokens = await AuthService.refreshToken(validatedData.refreshToken);
    
    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: { tokens }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation error',
        message: 'Invalid input data',
        details: error.errors
      });
      return;
    }

    if (error instanceof Error) {
      if (error.message.includes('Invalid refresh token') || 
          error.message.includes('expired') || 
          error.message.includes('revoked')) {
        res.status(401).json({
          error: 'Authentication failed',
          message: error.message
        });
        return;
      }
    }

    console.error('Token refresh error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'An error occurred during token refresh'
    });
  }
});

/**
 * POST /auth/logout
 * Logout from current session
 */
router.post('/logout', async (req, res) => {
  try {
    const validatedData = refreshTokenSchema.parse(req.body);
    
    await AuthService.logout(validatedData.refreshToken);
    
    res.json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    // Always return success for logout, even if token is invalid
    res.json({
      success: true,
      message: 'Logout successful'
    });
  }
});

/**
 * POST /auth/logout-all
 * Logout from all sessions (requires authentication)
 */
router.post('/logout-all', authenticateToken, async (req, res) => {
  const authenticatedReq = req as AuthenticatedRequest;
  try {
    await AuthService.logoutAll(authenticatedReq.user.id);
    
    res.json({
      success: true,
      message: 'Logged out from all devices successfully'
    });
  } catch (error) {
    console.error('Logout all error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'An error occurred during logout'
    });
  }
});

/**
 * GET /auth/sessions
 * Get active sessions for the authenticated user
 */
router.get('/sessions', authenticateToken, async (req, res) => {
  const authenticatedReq = req as AuthenticatedRequest;
  try {
    const sessions = await AuthService.getActiveSessions(authenticatedReq.user.id);
    
    res.json({
      success: true,
      data: { sessions }
    });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'An error occurred while fetching sessions'
    });
  }
});

/**
 * GET /auth/me
 * Get current user information
 */
router.get('/me', authenticateToken, async (req, res) => {
  const authenticatedReq = req as AuthenticatedRequest;
  try {
    const { UserModel } = await import('../database/models/User');
    const user = await UserModel.findById(authenticatedReq.user.id);
    
    if (!user) {
      res.status(404).json({
        error: 'Not found',
        message: 'User not found'
      });
      return;
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          preferences: user.preferences,
          createdAt: user.created_at,
          lastActiveAt: user.last_active_at
        }
      }
    });
  } catch (error) {
    console.error('Get user info error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'An error occurred while fetching user information'
    });
  }
});

export default router;