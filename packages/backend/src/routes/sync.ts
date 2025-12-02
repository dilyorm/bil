import express from 'express';
import { z } from 'zod';
import { authenticateToken } from '../auth/middleware';
import { syncServiceLocator } from '../sync/service';

const router = express.Router();

// Helper function to get sync manager
function getSyncManager() {
  return syncServiceLocator.getSyncManager();
}

// Helper function to validate authenticated user
function validateUser(req: express.Request): string | null {
  return req.user?.id || null;
}

// Validation schemas
const broadcastMessageSchema = z.object({
  type: z.enum(['conversation_update', 'device_status', 'user_preference', 'message_broadcast']),
  deviceId: z.string().optional(),
  payload: z.record(z.any())
});

const conversationStateSchema = z.object({
  conversationId: z.string(),
  activeDeviceId: z.string(),
  lastMessage: z.record(z.any()).optional(),
  participants: z.array(z.string()).optional(),
  context: z.record(z.any()).optional()
});

const deviceHandoffSchema = z.object({
  fromDeviceId: z.string(),
  toDeviceId: z.string(),
  conversationId: z.string(),
  context: z.record(z.any()).optional()
});

const conflictResolutionSchema = z.object({
  conversationId: z.string(),
  conflictingMessages: z.array(z.record(z.any()))
});

// POST /api/sync/broadcast - Broadcast message to all user devices
router.post('/broadcast', authenticateToken, async (req, res) => {
  try {
    const userId = validateUser(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const validatedData = broadcastMessageSchema.parse(req.body);
    const syncManager = getSyncManager();

    if (!syncManager) {
      return res.status(503).json({
        error: 'Sync service unavailable',
        message: 'Device synchronization service is not available'
      });
    }

    // Create sync message
    const syncMessage = {
      type: validatedData.type,
      userId,
      deviceId: validatedData.deviceId || 'api',
      timestamp: Date.now(),
      payload: validatedData.payload
    };

    // Broadcast to all user devices except the sender
    syncManager.broadcastToUser(userId, syncMessage, validatedData.deviceId);

    res.json({
      message: 'Message broadcasted successfully',
      timestamp: syncMessage.timestamp,
      recipients: syncManager.getConnectionStats(userId).connectedDevices
    });
  } catch (error) {
    console.error('Broadcast error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors
      });
    }

    res.status(500).json({
      error: 'Failed to broadcast message',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/sync/conversation/start - Start a new conversation
router.post('/conversation/start', authenticateToken, async (req, res) => {
  try {
    const userId = validateUser(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const validatedData = conversationStateSchema.parse(req.body);
    const syncManager = getSyncManager();

    if (!syncManager) {
      return res.status(503).json({
        error: 'Sync service unavailable'
      });
    }

    // Set active conversation
    const conversationState = {
      conversationId: validatedData.conversationId,
      activeDeviceId: validatedData.activeDeviceId,
      lastMessage: validatedData.lastMessage || {},
      participants: validatedData.participants || [userId],
      context: validatedData.context || {}
    };

    syncManager.setActiveConversation(userId, conversationState);

    res.json({
      message: 'Conversation started successfully',
      conversationState
    });
  } catch (error) {
    console.error('Start conversation error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors
      });
    }

    res.status(500).json({
      error: 'Failed to start conversation',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// PUT /api/sync/conversation/:id - Update conversation state
router.put('/conversation/:id', authenticateToken, async (req, res) => {
  try {
    const userId = validateUser(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const conversationId = req.params.id;
    if (!conversationId) {
      return res.status(400).json({ error: 'Conversation ID is required' });
    }

    const updates = req.body;
    const syncManager = getSyncManager();

    if (!syncManager) {
      return res.status(503).json({
        error: 'Sync service unavailable'
      });
    }

    // Update conversation state
    syncManager.updateConversationState(userId, conversationId, updates);

    // Get updated state
    const updatedState = syncManager.getActiveConversation(userId, conversationId);

    res.json({
      message: 'Conversation updated successfully',
      conversationState: updatedState
    });
  } catch (error) {
    console.error('Update conversation error:', error);
    res.status(500).json({
      error: 'Failed to update conversation',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/sync/conversation/:id - Get conversation state
router.get('/conversation/:id', authenticateToken, async (req, res) => {
  try {
    const userId = validateUser(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const conversationId = req.params.id;
    if (!conversationId) {
      return res.status(400).json({ error: 'Conversation ID is required' });
    }

    const syncManager = getSyncManager();

    if (!syncManager) {
      return res.status(503).json({
        error: 'Sync service unavailable'
      });
    }

    const conversationState = syncManager.getActiveConversation(userId, conversationId);

    if (!conversationState) {
      return res.status(404).json({
        error: 'Conversation not found'
      });
    }

    res.json({
      conversationState
    });
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({
      error: 'Failed to retrieve conversation',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// DELETE /api/sync/conversation/:id - End conversation
router.delete('/conversation/:id', authenticateToken, async (req, res) => {
  try {
    const userId = validateUser(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const conversationId = req.params.id;
    if (!conversationId) {
      return res.status(400).json({ error: 'Conversation ID is required' });
    }

    const syncManager = getSyncManager();

    if (!syncManager) {
      return res.status(503).json({
        error: 'Sync service unavailable'
      });
    }

    syncManager.endConversation(userId, conversationId);

    res.json({
      message: 'Conversation ended successfully'
    });
  } catch (error) {
    console.error('End conversation error:', error);
    res.status(500).json({
      error: 'Failed to end conversation',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/sync/handoff - Request device handoff
router.post('/handoff', authenticateToken, async (req, res) => {
  try {
    const userId = validateUser(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const validatedData = deviceHandoffSchema.parse(req.body);
    const syncManager = getSyncManager();

    if (!syncManager) {
      return res.status(503).json({
        error: 'Sync service unavailable'
      });
    }

    // Request device handoff
    const success = await syncManager.requestDeviceHandoff(userId, {
      fromDeviceId: validatedData.fromDeviceId,
      toDeviceId: validatedData.toDeviceId,
      conversationId: validatedData.conversationId,
      context: validatedData.context || {}
    });

    if (!success) {
      return res.status(400).json({
        error: 'Handoff failed',
        message: 'Unable to complete device handoff. Check device connectivity.'
      });
    }

    res.json({
      message: 'Device handoff completed successfully',
      fromDevice: validatedData.fromDeviceId,
      toDevice: validatedData.toDeviceId,
      conversationId: validatedData.conversationId
    });
  } catch (error) {
    console.error('Device handoff error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors
      });
    }

    res.status(500).json({
      error: 'Failed to process device handoff',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/sync/resolve-conflict - Resolve message conflicts
router.post('/resolve-conflict', authenticateToken, async (req, res) => {
  try {
    const userId = validateUser(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const validatedData = conflictResolutionSchema.parse(req.body);
    const syncManager = getSyncManager();

    if (!syncManager) {
      return res.status(503).json({
        error: 'Sync service unavailable'
      });
    }

    // Resolve conflict using timestamp-based resolution
    syncManager.resolveConflict(userId, {
      conversationId: validatedData.conversationId,
      conflictingMessages: validatedData.conflictingMessages
    });

    res.json({
      message: 'Conflict resolved successfully',
      conversationId: validatedData.conversationId,
      resolution: 'timestamp-based'
    });
  } catch (error) {
    console.error('Conflict resolution error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors
      });
    }

    res.status(500).json({
      error: 'Failed to resolve conflict',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/sync/status - Get synchronization status
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const userId = validateUser(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const syncManager = getSyncManager();

    if (!syncManager) {
      return res.status(503).json({
        error: 'Sync service unavailable'
      });
    }

    const stats = syncManager.getConnectionStats(userId);

    res.json({
      status: 'active',
      userId,
      ...stats,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Sync status error:', error);
    res.status(500).json({
      error: 'Failed to retrieve sync status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/sync/ping - Ping all connected devices
router.post('/ping', authenticateToken, async (req, res) => {
  try {
    const userId = validateUser(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const syncManager = getSyncManager();

    if (!syncManager) {
      return res.status(503).json({
        error: 'Sync service unavailable'
      });
    }

    // Broadcast ping to all user devices
    const pingMessage = {
      type: 'device_status' as const,
      userId,
      deviceId: 'api',
      timestamp: Date.now(),
      payload: {
        action: 'ping',
        message: 'Connectivity test from API'
      }
    };

    syncManager.broadcastToUser(userId, pingMessage);

    const stats = syncManager.getConnectionStats(userId);

    res.json({
      message: 'Ping sent to all connected devices',
      connectedDevices: stats.connectedDevices,
      devices: stats.devices,
      timestamp: pingMessage.timestamp
    });
  } catch (error) {
    console.error('Ping error:', error);
    res.status(500).json({
      error: 'Failed to ping devices',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;