import { Router } from 'express';
import { authenticateToken } from '../auth/middleware';
import { logger } from '../utils/logger';

const router = Router();

// Store pending commands for desktop clients to poll
const pendingCommands = new Map<string, any[]>();

/**
 * Mobile app sends command to desktop
 */
router.post('/command', authenticateToken, async (req, res) => {
  try {
    const { userId, deviceId, action, target, args, password } = req.body;

    if (!userId || !deviceId || !action || !target) {
      return res.status(400).json({ 
        error: 'Missing required fields: userId, deviceId, action, target' 
      });
    }

    const command = {
      id: `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      deviceId,
      action: {
        type: action,
        target,
        args,
        password
      },
      timestamp: new Date(),
      status: 'pending'
    };

    // Store command for desktop to poll
    if (!pendingCommands.has(userId)) {
      pendingCommands.set(userId, []);
    }
    pendingCommands.get(userId)!.push(command);

    logger.info('Command queued for desktop', { commandId: command.id, userId, deviceId });

    res.json({
      success: true,
      commandId: command.id,
      message: 'Command sent to desktop agent'
    });
  } catch (error) {
    logger.error('Error queuing desktop command', { error });
    res.status(500).json({ error: 'Failed to queue command' });
  }
});

/**
 * Desktop app polls for pending commands
 */
router.get('/poll', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;

    const commands = pendingCommands.get(userId) || [];
    
    // Clear pending commands after sending
    pendingCommands.set(userId, []);

    res.json({
      success: true,
      commands
    });
  } catch (error) {
    logger.error('Error polling commands', { error });
    res.status(500).json({ error: 'Failed to poll commands' });
  }
});

/**
 * Desktop app reports command result
 */
router.post('/result', authenticateToken, async (req, res) => {
  try {
    const { commandId, success, output, error } = req.body;

    if (!commandId) {
      return res.status(400).json({ error: 'Missing commandId' });
    }

    logger.info('Command result received', { commandId, success });

    // TODO: Store result in database and notify mobile app via WebSocket

    res.json({
      success: true,
      message: 'Result recorded'
    });
  } catch (error) {
    logger.error('Error recording command result', { error });
    res.status(500).json({ error: 'Failed to record result' });
  }
});

/**
 * Get command history
 */
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;

    // TODO: Fetch from database
    res.json({
      success: true,
      commands: []
    });
  } catch (error) {
    logger.error('Error fetching command history', { error });
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

export default router;
