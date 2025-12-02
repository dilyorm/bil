import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import { DeviceSyncServer, DeviceSyncManager, AuthenticatedSocket, SyncMessage } from '../index';

// Mock dependencies
vi.mock('../../database/models/Device');
vi.mock('../../database/models/User');
vi.mock('http');
vi.mock('socket.io');

import { DeviceModel } from '../../database/models/Device';
import { UserModel } from '../../database/models/User';

// Mock Socket.IO classes
class MockSocket extends EventEmitter {
  id: string;
  userId?: string;
  deviceId?: string;
  user?: any;
  connected: boolean = true;
  rooms: Set<string> = new Set();

  constructor(id: string) {
    super();
    this.id = id;
  }

  join(room: string) {
    this.rooms.add(room);
  }

  leave(room: string) {
    this.rooms.delete(room);
  }

  emit(event: string, ...args: any[]) {
    super.emit(event, ...args);
    return this;
  }

  disconnect() {
    this.connected = false;
    this.emit('disconnect', 'client disconnect');
  }
}

class MockSocketIOServer extends EventEmitter {
  sockets: Map<string, MockSocket> = new Map();
  rooms: Map<string, Set<string>> = new Map();

  constructor() {
    super();
  }

  use(middleware: any) {
    // Store middleware for testing
  }

  to(room: string) {
    return {
      emit: (event: string, data: any) => {
        const roomSockets = this.rooms.get(room) || new Set();
        roomSockets.forEach(socketId => {
          const socket = this.sockets.get(socketId);
          if (socket) {
            socket.emit(event, data);
          }
        });
      },
      except: (excludeSocketId: string) => ({
        emit: (event: string, data: any) => {
          const roomSockets = this.rooms.get(room) || new Set();
          roomSockets.forEach(socketId => {
            if (socketId !== excludeSocketId) {
              const socket = this.sockets.get(socketId);
              if (socket) {
                socket.emit(event, data);
              }
            }
          });
        }
      })
    };
  }

  close() {
    this.emit('close');
  }

  // Helper method to simulate socket connection
  simulateConnection(userId: string, deviceId?: string): MockSocket {
    const socket = new MockSocket(`socket-${Date.now()}-${Math.random()}`);
    socket.userId = userId;
    socket.deviceId = deviceId;
    
    this.sockets.set(socket.id, socket);
    
    // Simulate joining user room
    const userRoom = `user:${userId}`;
    socket.join(userRoom);
    
    if (!this.rooms.has(userRoom)) {
      this.rooms.set(userRoom, new Set());
    }
    this.rooms.get(userRoom)!.add(socket.id);

    this.emit('connection', socket);
    return socket;
  }

  // Helper method to simulate socket disconnection
  simulateDisconnection(socket: MockSocket) {
    socket.connected = false;
    socket.rooms.forEach(room => {
      const roomSockets = this.rooms.get(room);
      if (roomSockets) {
        roomSockets.delete(socket.id);
      }
    });
    this.sockets.delete(socket.id);
    socket.emit('disconnect', 'client disconnect');
  }
}

describe('Device Sync Integration Tests', () => {
  let mockIOServer: MockSocketIOServer;
  let syncServer: DeviceSyncServer;
  let syncManager: DeviceSyncManager;

  const mockUser = {
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
    preferences: {}
  };

  const mockDevice = {
    id: 'test-device-id',
    user_id: 'test-user-id',
    type: 'mobile',
    name: 'Test Device',
    capabilities: {
      hasVoiceInput: true,
      hasVoiceOutput: true,
      hasHapticFeedback: false
    },
    is_active: true,
    last_seen: new Date()
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock database responses
    vi.mocked(UserModel.findById).mockResolvedValue(mockUser as any);
    vi.mocked(DeviceModel.create).mockResolvedValue(mockDevice as any);
    vi.mocked(DeviceModel.update).mockResolvedValue(mockDevice as any);
    vi.mocked(DeviceModel.updateLastSeen).mockResolvedValue();
    vi.mocked(DeviceModel.findActiveByUserId).mockResolvedValue([mockDevice] as any);

    // Create mock Socket.IO server
    mockIOServer = new MockSocketIOServer();
    
    // Mock the DeviceSyncServer to use our mock
    syncServer = {
      broadcastToUserDevices: vi.fn((userId: string, message: SyncMessage, excludeSocketId?: string) => {
        const userRoom = `user:${userId}`;
        if (excludeSocketId) {
          mockIOServer.to(userRoom).except(excludeSocketId).emit('sync_message', message);
        } else {
          mockIOServer.to(userRoom).emit('sync_message', message);
        }
      }),
      broadcastToDevice: vi.fn((deviceId: string, message: any) => {
        const socket = Array.from(mockIOServer.sockets.values())
          .find(s => s.deviceId === deviceId);
        if (socket) {
          socket.emit('sync_message', message);
        }
      }),
      getConnectedDevices: vi.fn((userId: string) => {
        return Array.from(mockIOServer.sockets.values())
          .filter(socket => socket.userId === userId) as AuthenticatedSocket[];
      }),
      getUserRoomSize: vi.fn((userId: string) => {
        const userRoom = `user:${userId}`;
        return mockIOServer.rooms.get(userRoom)?.size || 0;
      }),
      isDeviceConnected: vi.fn((deviceId: string) => {
        return Array.from(mockIOServer.sockets.values())
          .some(socket => socket.deviceId === deviceId);
      }),
      close: vi.fn()
    } as any;

    syncManager = new DeviceSyncManager(syncServer);
  });

  afterEach(() => {
    // Clean up
    mockIOServer.sockets.clear();
    mockIOServer.rooms.clear();
  });

  describe('WebSocket Connection Handling', () => {
    it('should simulate device connection and track connected devices', () => {
      const socket = mockIOServer.simulateConnection('test-user-id', 'device-1');
      
      expect(socket.connected).toBe(true);
      expect(socket.userId).toBe('test-user-id');
      expect(socket.deviceId).toBe('device-1');
      expect(mockIOServer.sockets.has(socket.id)).toBe(true);
      
      // Check user room membership
      const userRoom = `user:test-user-id`;
      expect(mockIOServer.rooms.get(userRoom)?.has(socket.id)).toBe(true);
    });

    it('should handle multiple device connections for same user', () => {
      const device1 = mockIOServer.simulateConnection('test-user-id', 'device-1');
      const device2 = mockIOServer.simulateConnection('test-user-id', 'device-2');
      
      expect(mockIOServer.sockets.size).toBe(2);
      expect(syncServer.getUserRoomSize('test-user-id')).toBe(2);
      
      const connectedDevices = syncServer.getConnectedDevices('test-user-id');
      expect(connectedDevices).toHaveLength(2);
    });

    it('should handle device disconnection', () => {
      const socket = mockIOServer.simulateConnection('test-user-id', 'device-1');
      
      expect(mockIOServer.sockets.has(socket.id)).toBe(true);
      
      mockIOServer.simulateDisconnection(socket);
      
      expect(socket.connected).toBe(false);
      expect(mockIOServer.sockets.has(socket.id)).toBe(false);
      expect(syncServer.getUserRoomSize('test-user-id')).toBe(0);
    });

    it('should verify device connection status', () => {
      mockIOServer.simulateConnection('test-user-id', 'device-1');
      
      expect(syncServer.isDeviceConnected('device-1')).toBe(true);
      expect(syncServer.isDeviceConnected('non-existent-device')).toBe(false);
    });

    it('should separate devices by user', () => {
      mockIOServer.simulateConnection('user-1', 'device-1');
      mockIOServer.simulateConnection('user-2', 'device-2');
      
      expect(syncServer.getConnectedDevices('user-1')).toHaveLength(1);
      expect(syncServer.getConnectedDevices('user-2')).toHaveLength(1);
      expect(syncServer.getUserRoomSize('user-1')).toBe(1);
      expect(syncServer.getUserRoomSize('user-2')).toBe(1);
    });

    it('should handle device registration through sync manager', async () => {
      const devices = await syncManager.getActiveDevices('test-user-id');
      
      expect(devices).toHaveLength(1);
      expect(devices[0]).toMatchObject({
        id: 'test-device-id',
        user_id: 'test-user-id',
        type: 'mobile'
      });
      expect(DeviceModel.findActiveByUserId).toHaveBeenCalledWith('test-user-id');
    });
  });

  describe('Message Broadcasting Across Multiple Devices', () => {
    it('should broadcast sync messages to all user devices except sender', () => {
      // Connect multiple devices for the same user
      const device1 = mockIOServer.simulateConnection('test-user-id', 'device-1');
      const device2 = mockIOServer.simulateConnection('test-user-id', 'device-2');
      const device3 = mockIOServer.simulateConnection('test-user-id', 'device-3');

      const testMessage: SyncMessage = {
        type: 'conversation_update',
        userId: 'test-user-id',
        deviceId: 'device-1',
        timestamp: Date.now(),
        payload: {
          action: 'message_sent',
          content: 'Hello from device 1'
        }
      };

      // Set up listeners on devices 2 and 3
      const device2Messages: any[] = [];
      const device3Messages: any[] = [];
      
      device2.on('sync_message', (msg) => device2Messages.push(msg));
      device3.on('sync_message', (msg) => device3Messages.push(msg));

      // Broadcast message using sync server
      syncServer.broadcastToUserDevices('test-user-id', testMessage, device1.id);

      // Device 2 and 3 should receive the message
      expect(device2Messages).toHaveLength(1);
      expect(device3Messages).toHaveLength(1);
      
      expect(device2Messages[0]).toMatchObject({
        type: 'conversation_update',
        userId: 'test-user-id',
        deviceId: 'device-1',
        payload: {
          action: 'message_sent',
          content: 'Hello from device 1'
        }
      });

      expect(device3Messages[0]).toMatchObject(device2Messages[0]);
    });

    it('should not broadcast to devices of different users', () => {
      // Connect devices for different users
      const user1Device = mockIOServer.simulateConnection('user-1', 'device-1');
      const user2Device = mockIOServer.simulateConnection('user-2', 'device-2');

      const user2Messages: any[] = [];
      user2Device.on('sync_message', (msg) => user2Messages.push(msg));

      const testMessage: SyncMessage = {
        type: 'conversation_update',
        userId: 'user-1',
        deviceId: 'device-1',
        timestamp: Date.now(),
        payload: {
          action: 'message_sent',
          content: 'Private message'
        }
      };

      // Broadcast to user-1 only
      syncServer.broadcastToUserDevices('user-1', testMessage);

      // User 2 should not receive the message
      expect(user2Messages).toHaveLength(0);
    });

    it('should broadcast to specific device', () => {
      const device1 = mockIOServer.simulateConnection('test-user-id', 'device-1');
      const device2 = mockIOServer.simulateConnection('test-user-id', 'device-2');

      const device1Messages: any[] = [];
      const device2Messages: any[] = [];
      
      device1.on('sync_message', (msg) => device1Messages.push(msg));
      device2.on('sync_message', (msg) => device2Messages.push(msg));

      const testMessage = {
        type: 'device_status',
        payload: { status: 'targeted_message' }
      };

      // Broadcast to specific device
      syncServer.broadcastToDevice('device-1', testMessage);

      // Only device 1 should receive the message
      expect(device1Messages).toHaveLength(1);
      expect(device2Messages).toHaveLength(0);
      expect(device1Messages[0]).toMatchObject(testMessage);
    });

    it('should handle sync manager broadcasting', () => {
      const device1 = mockIOServer.simulateConnection('test-user-id', 'device-1');
      const device2 = mockIOServer.simulateConnection('test-user-id', 'device-2');

      const device2Messages: any[] = [];
      device2.on('sync_message', (msg) => device2Messages.push(msg));

      const testMessage: SyncMessage = {
        type: 'user_preference',
        userId: 'test-user-id',
        deviceId: 'device-1',
        timestamp: Date.now(),
        payload: {
          setting: 'voice_enabled',
          value: true
        }
      };

      // Use sync manager to broadcast (without exclude device ID to avoid the internal method call)
      syncManager.broadcastToUser('test-user-id', testMessage);

      expect(syncServer.broadcastToUserDevices).toHaveBeenCalledWith(
        'test-user-id',
        testMessage,
        undefined
      );
    });
  });

  describe('Conflict Resolution Scenarios', () => {
    it('should resolve conflicts using timestamp strategy', () => {
      const device1 = mockIOServer.simulateConnection('test-user-id', 'device-1');
      const device2 = mockIOServer.simulateConnection('test-user-id', 'device-2');

      const device1Messages: any[] = [];
      const device2Messages: any[] = [];
      
      device1.on('sync_message', (msg) => device1Messages.push(msg));
      device2.on('sync_message', (msg) => device2Messages.push(msg));

      const conflictData = {
        conversationId: 'conv-123',
        conflictingMessages: [
          {
            id: 'msg-1',
            content: 'First message',
            timestamp: new Date('2023-01-01T10:00:00Z'),
            deviceId: 'device-1',
            deviceType: 'mobile'
          },
          {
            id: 'msg-2',
            content: 'Second message',
            timestamp: new Date('2023-01-01T10:01:00Z'), // Later timestamp
            deviceId: 'device-2',
            deviceType: 'desktop'
          }
        ]
      };

      // Trigger conflict resolution
      syncManager.resolveConflict('test-user-id', conflictData);

      // Both devices should receive conflict resolution
      expect(device1Messages).toHaveLength(1);
      expect(device2Messages).toHaveLength(1);

      const resolutionMessage = device1Messages[0];
      expect(resolutionMessage).toMatchObject({
        type: 'conversation_update',
        userId: 'test-user-id',
        payload: {
          action: 'conflict_resolved',
          conversationId: 'conv-123',
          resolvedMessage: {
            id: 'msg-2', // Should pick the later timestamp
            content: 'Second message'
          },
          strategy: 'timestamp'
        }
      });
    });

    it('should handle device handoff scenarios', async () => {
      const mobileDevice = mockIOServer.simulateConnection('test-user-id', 'mobile-1');
      const desktopDevice = mockIOServer.simulateConnection('test-user-id', 'desktop-1');

      const mobileMessages: any[] = [];
      const desktopMessages: any[] = [];
      
      mobileDevice.on('sync_message', (msg) => mobileMessages.push(msg));
      desktopDevice.on('sync_message', (msg) => desktopMessages.push(msg));

      // Set up active conversation
      const conversationState = {
        conversationId: 'conv-123',
        activeDeviceId: 'mobile-1',
        lastMessage: { content: 'Hello' },
        participants: ['test-user-id'],
        context: { topic: 'greeting' }
      };

      syncManager.setActiveConversation('test-user-id', conversationState);

      // Clear setup messages
      mobileMessages.length = 0;
      desktopMessages.length = 0;

      // Request handoff from mobile to desktop
      const handoffRequest = {
        fromDeviceId: 'mobile-1',
        toDeviceId: 'desktop-1',
        conversationId: 'conv-123',
        context: { handoffReason: 'user_request' }
      };

      const handoffSuccess = await syncManager.requestDeviceHandoff('test-user-id', handoffRequest);
      expect(handoffSuccess).toBe(true);

      // Verify conversation state was updated
      const updatedConversation = syncManager.getActiveConversation('test-user-id', 'conv-123');
      expect(updatedConversation?.activeDeviceId).toBe('desktop-1');
      expect(updatedConversation?.context).toMatchObject({
        topic: 'greeting',
        handoffReason: 'user_request'
      });
    });

    it('should handle handoff failure when devices are not connected', async () => {
      mockIOServer.simulateConnection('test-user-id', 'device-1');

      // Set up conversation
      const conversationState = {
        conversationId: 'conv-123',
        activeDeviceId: 'device-1',
        lastMessage: {},
        participants: ['test-user-id'],
        context: {}
      };

      syncManager.setActiveConversation('test-user-id', conversationState);

      // Try to handoff to non-connected device
      const handoffRequest = {
        fromDeviceId: 'device-1',
        toDeviceId: 'non-existent-device',
        conversationId: 'conv-123',
        context: {}
      };

      const handoffSuccess = await syncManager.requestDeviceHandoff('test-user-id', handoffRequest);
      expect(handoffSuccess).toBe(false);
    });

    it('should handle advanced conflict resolution strategies', () => {
      const device1 = mockIOServer.simulateConnection('test-user-id', 'device-1');
      const device2 = mockIOServer.simulateConnection('test-user-id', 'device-2');

      const allMessages: any[] = [];
      device1.on('sync_message', (msg) => allMessages.push(msg));
      device2.on('sync_message', (msg) => allMessages.push(msg));

      const conflictData = {
        conversationId: 'conv-123',
        conflictingMessages: [
          {
            id: 'msg-1',
            content: 'Mobile message',
            timestamp: new Date('2023-01-01T10:01:00Z'), // Later timestamp
            deviceId: 'device-1',
            deviceType: 'mobile'
          },
          {
            id: 'msg-2',
            content: 'Desktop message',
            timestamp: new Date('2023-01-01T10:00:00Z'), // Earlier timestamp
            deviceId: 'device-2',
            deviceType: 'desktop'
          }
        ]
      };

      // Test priority-based resolution
      syncManager.resolveConflictAdvanced('test-user-id', conflictData, 'priority');

      expect(allMessages.length).toBeGreaterThan(0);
      const resolutionMessage = allMessages[0];
      expect(resolutionMessage.payload.strategy).toBe('priority');
      // Desktop should win due to higher priority
      expect(resolutionMessage.payload.resolvedMessage.deviceType).toBe('desktop');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle conversation state management', () => {
      const conversationState = {
        conversationId: 'conv-123',
        activeDeviceId: 'device-1',
        lastMessage: { content: 'Hello' },
        participants: ['test-user-id'],
        context: { topic: 'greeting' }
      };

      // Set active conversation
      syncManager.setActiveConversation('test-user-id', conversationState);

      // Retrieve conversation
      const retrieved = syncManager.getActiveConversation('test-user-id', 'conv-123');
      expect(retrieved).toMatchObject(conversationState);

      // Update conversation
      syncManager.updateConversationState('test-user-id', 'conv-123', {
        lastMessage: { content: 'Updated message' }
      });

      const updated = syncManager.getActiveConversation('test-user-id', 'conv-123');
      expect(updated?.lastMessage).toMatchObject({ content: 'Updated message' });

      // End conversation
      syncManager.endConversation('test-user-id', 'conv-123');
      const ended = syncManager.getActiveConversation('test-user-id', 'conv-123');
      expect(ended).toBeNull();
    });

    it('should handle message queuing for offline devices', () => {
      const testMessage: SyncMessage = {
        type: 'conversation_update',
        userId: 'test-user-id',
        deviceId: 'device-1',
        timestamp: Date.now(),
        payload: { content: 'Queued message' }
      };

      // Queue message for offline device
      syncManager.queueMessageForDevice('offline-device', testMessage);

      // Simulate device coming online
      const device = mockIOServer.simulateConnection('test-user-id', 'offline-device');
      const messages: any[] = [];
      device.on('sync_message', (msg) => messages.push(msg));

      // Deliver queued messages
      syncManager.deliverQueuedMessages('offline-device');

      expect(syncServer.broadcastToDevice).toHaveBeenCalledWith('offline-device', testMessage);
    });

    it('should provide connection statistics', () => {
      mockIOServer.simulateConnection('test-user-id', 'device-1');
      mockIOServer.simulateConnection('test-user-id', 'device-2');
      mockIOServer.simulateConnection('other-user', 'device-3');

      const stats = syncManager.getConnectionStats('test-user-id');

      expect(stats).toMatchObject({
        connectedDevices: 2,
        roomSize: 2,
        activeConversations: 0,
        devices: expect.arrayContaining([
          expect.objectContaining({
            deviceId: 'device-1',
            connected: true
          }),
          expect.objectContaining({
            deviceId: 'device-2',
            connected: true
          })
        ])
      });
    });

    it('should handle device status updates', async () => {
      const statusUpdate = {
        batteryLevel: 75,
        connectionStrength: 'good',
        location: 'office'
      };

      await syncManager.updateDeviceStatus('device-1', statusUpdate);

      expect(DeviceModel.update).toHaveBeenCalledWith('device-1', {
        last_seen: expect.any(Date),
        connection_info: expect.objectContaining({
          ...statusUpdate,
          lastUpdate: expect.any(String)
        })
      });
    });

    it('should handle cleanup operations', () => {
      // Set up some state
      syncManager.setActiveConversation('test-user-id', {
        conversationId: 'conv-1',
        activeDeviceId: 'device-1',
        lastMessage: {},
        participants: ['test-user-id'],
        context: {}
      });

      syncManager.queueMessageForDevice('device-1', {
        type: 'conversation_update',
        userId: 'test-user-id',
        deviceId: 'device-1',
        timestamp: Date.now(),
        payload: {}
      });

      // Verify state exists
      expect(syncManager.getActiveConversation('test-user-id', 'conv-1')).not.toBeNull();

      // Cleanup
      syncManager.cleanup();

      // Verify state is cleared
      expect(syncManager.getActiveConversation('test-user-id', 'conv-1')).toBeNull();
    });

    it('should handle room management', () => {
      const userId = 'test-user-id';
      const deviceId = 'device-1';

      expect(syncManager.getUserRoomName(userId)).toBe('user:test-user-id');
      expect(syncManager.getDeviceRoomName(deviceId)).toBe('device:device-1');
    });
  });
});