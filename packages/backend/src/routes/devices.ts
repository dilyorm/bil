import express from 'express';
import { z } from 'zod';
import { authenticateToken } from '../auth/middleware';
import { DeviceModel, DeviceType } from '../database/models/Device';
import { syncServiceLocator } from '../sync/service';

const router = express.Router();

// Helper function to get sync manager
function getSyncManager() {
  return syncServiceLocator.getSyncManager();
}

// Helper function to get connected device IDs
function getConnectedDeviceIds(userId: string): string[] {
  const syncManager = getSyncManager();
  if (!syncManager) return [];
  
  const stats = syncManager.getConnectionStats(userId);
  return stats.devices
    .map((d: any) => d.deviceId)
    .filter((id: string) => id !== undefined);
}

// Helper function to validate authenticated user
function validateUser(req: express.Request): string | null {
  return req.user?.id || null;
}

// Helper function to validate device ID parameter
function validateDeviceId(req: express.Request): string | null {
  return req.params.id || null;
}

// Validation schemas
const deviceRegistrationSchema = z.object({
  type: z.enum(['mobile', 'desktop', 'wearable', 'web']),
  name: z.string().min(1).max(100),
  capabilities: z.record(z.any()).optional(),
  connection_info: z.record(z.any()).optional()
});

const deviceUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  capabilities: z.record(z.any()).optional(),
  connection_info: z.record(z.any()).optional(),
  is_active: z.boolean().optional()
});

// Device capability detection helper
function detectDeviceCapabilities(userAgent?: string, deviceType?: DeviceType) {
  const capabilities = {
    hasVoiceInput: false,
    hasVoiceOutput: false,
    hasHapticFeedback: false,
    hasFileAccess: false,
    hasCalendarAccess: false,
    supportsGestures: false,
    hasCamera: false,
    hasLocation: false,
    hasBluetooth: false
  };

  switch (deviceType) {
    case 'mobile':
      capabilities.hasVoiceInput = true;
      capabilities.hasVoiceOutput = true;
      capabilities.hasHapticFeedback = true;
      capabilities.hasCamera = true;
      capabilities.hasLocation = true;
      capabilities.hasBluetooth = true;
      capabilities.supportsGestures = true;
      break;
    case 'desktop':
      capabilities.hasVoiceInput = true;
      capabilities.hasVoiceOutput = true;
      capabilities.hasFileAccess = true;
      capabilities.hasCalendarAccess = true;
      break;
    case 'wearable':
      capabilities.hasVoiceInput = true;
      capabilities.hasHapticFeedback = true;
      capabilities.hasBluetooth = true;
      capabilities.supportsGestures = true;
      break;
    case 'web':
      capabilities.hasVoiceInput = true;
      capabilities.hasVoiceOutput = true;
      break;
  }

  return capabilities;
}

// GET /api/devices - Get all devices for authenticated user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = validateUser(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const devices = await DeviceModel.findByUserId(userId);

    // Add connection status from sync manager
    const connectedDeviceIds = getConnectedDeviceIds(userId);
    const devicesWithStatus = devices.map(device => ({
      ...device,
      isConnected: connectedDeviceIds.includes(device.id)
    }));

    res.json({
      devices: devicesWithStatus,
      total: devices.length
    });
  } catch (error) {
    console.error('Get devices error:', error);
    res.status(500).json({
      error: 'Failed to retrieve devices',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/devices/active - Get only active devices for authenticated user
router.get('/active', authenticateToken, async (req, res) => {
  try {
    const userId = validateUser(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const devices = await DeviceModel.findActiveByUserId(userId);

    // Add connection status from sync manager
    const connectedDeviceIds = getConnectedDeviceIds(userId);
    const devicesWithStatus = devices.map(device => ({
      ...device,
      isConnected: connectedDeviceIds.includes(device.id)
    }));

    res.json({
      devices: devicesWithStatus,
      total: devices.length
    });
  } catch (error) {
    console.error('Get active devices error:', error);
    res.status(500).json({
      error: 'Failed to retrieve active devices',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/devices/register - Register a new device
router.post('/register', authenticateToken, async (req, res) => {
  try {
    const userId = validateUser(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const validatedData = deviceRegistrationSchema.parse(req.body);

    // Auto-detect capabilities if not provided
    const capabilities = validatedData.capabilities || 
      detectDeviceCapabilities(req.headers['user-agent'], validatedData.type);

    // Create device
    const device = await DeviceModel.create({
      user_id: userId,
      type: validatedData.type,
      name: validatedData.name,
      capabilities,
      connection_info: validatedData.connection_info || {}
    });

    // Broadcast device registration to other connected devices
    const syncManager = getSyncManager();
    if (syncManager) {
      syncManager.broadcastToUser(userId, {
        type: 'device_status',
        userId,
        deviceId: device.id,
        timestamp: Date.now(),
        payload: {
          action: 'device_registered',
          device
        }
      });
    }

    res.status(201).json({
      device,
      message: 'Device registered successfully'
    });
  } catch (error) {
    console.error('Device registration error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors
      });
    }

    res.status(500).json({
      error: 'Failed to register device',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/devices/:id - Get specific device
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = validateUser(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const deviceId = validateDeviceId(req);
    if (!deviceId) {
      return res.status(400).json({ error: 'Device ID is required' });
    }

    const device = await DeviceModel.findById(deviceId);
    
    if (!device) {
      return res.status(404).json({
        error: 'Device not found'
      });
    }

    // Verify device belongs to user
    if (device.user_id !== userId) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    // Add connection status
    const connectedDeviceIds = getConnectedDeviceIds(userId);
    const isConnected = connectedDeviceIds.includes(device.id);

    res.json({
      device: {
        ...device,
        isConnected
      }
    });
  } catch (error) {
    console.error('Get device error:', error);
    res.status(500).json({
      error: 'Failed to retrieve device',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// PUT /api/devices/:id - Update device
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = validateUser(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const deviceId = validateDeviceId(req);
    if (!deviceId) {
      return res.status(400).json({ error: 'Device ID is required' });
    }
    
    const validatedData = deviceUpdateSchema.parse(req.body);

    // Verify device exists and belongs to user
    const existingDevice = await DeviceModel.findById(deviceId);
    
    if (!existingDevice) {
      return res.status(404).json({
        error: 'Device not found'
      });
    }

    if (existingDevice.user_id !== userId) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    // Update device
    const updateData: any = {};
    if (validatedData.name !== undefined) updateData.name = validatedData.name;
    if (validatedData.capabilities !== undefined) updateData.capabilities = validatedData.capabilities;
    if (validatedData.connection_info !== undefined) updateData.connection_info = validatedData.connection_info;
    if (validatedData.is_active !== undefined) updateData.is_active = validatedData.is_active;
    
    const updatedDevice = await DeviceModel.update(deviceId, updateData);

    if (!updatedDevice) {
      return res.status(500).json({
        error: 'Failed to update device'
      });
    }

    // Broadcast device update to other connected devices
    const syncManager = getSyncManager();
    if (syncManager) {
      syncManager.broadcastToUser(userId, {
        type: 'device_status',
        userId,
        deviceId: updatedDevice.id,
        timestamp: Date.now(),
        payload: {
          action: 'device_updated',
          device: updatedDevice,
          changes: validatedData
        }
      });
    }

    res.json({
      device: updatedDevice,
      message: 'Device updated successfully'
    });
  } catch (error) {
    console.error('Device update error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors
      });
    }

    res.status(500).json({
      error: 'Failed to update device',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/devices/:id/heartbeat - Update device heartbeat
router.post('/:id/heartbeat', authenticateToken, async (req, res) => {
  try {
    const userId = validateUser(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const deviceId = validateDeviceId(req);
    if (!deviceId) {
      return res.status(400).json({ error: 'Device ID is required' });
    }

    // Verify device exists and belongs to user
    const device = await DeviceModel.findById(deviceId);
    
    if (!device) {
      return res.status(404).json({
        error: 'Device not found'
      });
    }

    if (device.user_id !== userId) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    // Update last seen timestamp
    await DeviceModel.updateLastSeen(deviceId);

    // Update sync manager if available
    const syncManager = getSyncManager();
    if (syncManager) {
      await syncManager.updateDeviceStatus(deviceId, {
        lastHeartbeat: new Date().toISOString(),
        ...req.body
      });
    }

    res.json({
      message: 'Heartbeat recorded',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Device heartbeat error:', error);
    res.status(500).json({
      error: 'Failed to record heartbeat',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/devices/:id/deactivate - Deactivate device
router.post('/:id/deactivate', authenticateToken, async (req, res) => {
  try {
    const userId = validateUser(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const deviceId = validateDeviceId(req);
    if (!deviceId) {
      return res.status(400).json({ error: 'Device ID is required' });
    }

    // Verify device exists and belongs to user
    const device = await DeviceModel.findById(deviceId);
    
    if (!device) {
      return res.status(404).json({
        error: 'Device not found'
      });
    }

    if (device.user_id !== userId) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    // Deactivate device
    const success = await DeviceModel.deactivate(deviceId);

    if (!success) {
      return res.status(500).json({
        error: 'Failed to deactivate device'
      });
    }

    // Broadcast device deactivation to other connected devices
    const syncManager = getSyncManager();
    if (syncManager) {
      syncManager.broadcastToUser(userId, {
        type: 'device_status',
        userId,
        deviceId,
        timestamp: Date.now(),
        payload: {
          action: 'device_deactivated',
          deviceId
        }
      });
    }

    res.json({
      message: 'Device deactivated successfully'
    });
  } catch (error) {
    console.error('Device deactivation error:', error);
    res.status(500).json({
      error: 'Failed to deactivate device',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// DELETE /api/devices/:id - Remove device
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = validateUser(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const deviceId = validateDeviceId(req);
    if (!deviceId) {
      return res.status(400).json({ error: 'Device ID is required' });
    }

    // Verify device exists and belongs to user
    const device = await DeviceModel.findById(deviceId);
    
    if (!device) {
      return res.status(404).json({
        error: 'Device not found'
      });
    }

    if (device.user_id !== userId) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    // Delete device
    const success = await DeviceModel.delete(deviceId);

    if (!success) {
      return res.status(500).json({
        error: 'Failed to remove device'
      });
    }

    // Broadcast device removal to other connected devices
    const syncManager = getSyncManager();
    if (syncManager) {
      syncManager.broadcastToUser(userId, {
        type: 'device_status',
        userId,
        deviceId,
        timestamp: Date.now(),
        payload: {
          action: 'device_removed',
          deviceId
        }
      });
    }

    res.json({
      message: 'Device removed successfully'
    });
  } catch (error) {
    console.error('Device removal error:', error);
    res.status(500).json({
      error: 'Failed to remove device',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/devices/stats - Get device connection statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const userId = validateUser(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Get stats from sync manager
    const syncManager = getSyncManager();
    const stats = syncManager ? syncManager.getConnectionStats(userId) : {
      connectedDevices: 0,
      roomSize: 0,
      activeConversations: 0,
      devices: []
    };

    // Get total device count from database
    const allDevices = await DeviceModel.findByUserId(userId);
    const activeDevices = await DeviceModel.findActiveByUserId(userId);

    res.json({
      ...stats,
      totalDevices: allDevices.length,
      activeDevices: activeDevices.length,
      inactiveDevices: allDevices.length - activeDevices.length
    });
  } catch (error) {
    console.error('Device stats error:', error);
    res.status(500).json({
      error: 'Failed to retrieve device statistics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;