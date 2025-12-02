import { DeviceSyncServer, SyncMessage } from './server';
import { DeviceModel, Device } from '../database/models/Device';
import { DeviceCommunicationError } from '../errors/types';
import { applicationMetrics } from '../monitoring/metrics';
import { syncLogger } from '../utils/logger';

export interface ConversationState {
  conversationId: string;
  activeDeviceId: string;
  lastMessage: any;
  participants: string[];
  context: Record<string, any>;
}

export interface DeviceHandoffRequest {
  fromDeviceId: string;
  toDeviceId: string;
  conversationId: string;
  context: Record<string, any>;
}

export class DeviceSyncManager {
  private syncServer: DeviceSyncServer;
  private activeConversations: Map<string, ConversationState> = new Map();

  constructor(syncServer: DeviceSyncServer) {
    this.syncServer = syncServer;
  }

  // Device management methods
  async getActiveDevices(userId: string): Promise<Device[]> {
    return await DeviceModel.findActiveByUserId(userId);
  }

  async updateDeviceStatus(deviceId: string, status: Record<string, any>): Promise<void> {
    await DeviceModel.update(deviceId, {
      last_seen: new Date(),
      connection_info: {
        ...status,
        lastUpdate: new Date().toISOString()
      }
    });
  }

  // Room management methods
  getUserRoomName(userId: string): string {
    return `user:${userId}`;
  }

  getDeviceRoomName(deviceId: string): string {
    return `device:${deviceId}`;
  }

  // Message broadcasting methods
  broadcastToUser(userId: string, message: SyncMessage, excludeDeviceId?: string): void {
    const excludeSocketId = excludeDeviceId ? 
      this.findSocketIdByDeviceId(excludeDeviceId) : undefined;
    
    this.syncServer.broadcastToUserDevices(userId, message, excludeSocketId);
  }

  broadcastToDevice(deviceId: string, message: SyncMessage): void {
    this.syncServer.broadcastToDevice(deviceId, message);
  }

  // Conversation state management
  setActiveConversation(userId: string, conversationState: ConversationState): void {
    const key = `${userId}:${conversationState.conversationId}`;
    this.activeConversations.set(key, conversationState);

    // Broadcast conversation state to all user devices
    this.broadcastToUser(userId, {
      type: 'conversation_update',
      userId,
      deviceId: conversationState.activeDeviceId,
      timestamp: Date.now(),
      payload: {
        action: 'conversation_started',
        conversationState
      }
    });
  }

  getActiveConversation(userId: string, conversationId: string): ConversationState | null {
    const key = `${userId}:${conversationId}`;
    return this.activeConversations.get(key) || null;
  }

  updateConversationState(userId: string, conversationId: string, updates: Partial<ConversationState>): void {
    const key = `${userId}:${conversationId}`;
    const existing = this.activeConversations.get(key);
    
    if (existing) {
      const updated = { ...existing, ...updates };
      this.activeConversations.set(key, updated);

      // Broadcast update to all user devices
      this.broadcastToUser(userId, {
        type: 'conversation_update',
        userId,
        deviceId: updated.activeDeviceId,
        timestamp: Date.now(),
        payload: {
          action: 'conversation_updated',
          conversationState: updated,
          changes: updates
        }
      });
    }
  }

  endConversation(userId: string, conversationId: string): void {
    const key = `${userId}:${conversationId}`;
    const conversation = this.activeConversations.get(key);
    
    if (conversation) {
      this.activeConversations.delete(key);

      // Broadcast conversation end to all user devices
      this.broadcastToUser(userId, {
        type: 'conversation_update',
        userId,
        deviceId: conversation.activeDeviceId,
        timestamp: Date.now(),
        payload: {
          action: 'conversation_ended',
          conversationId
        }
      });
    }
  }

  // Device handoff methods
  async requestDeviceHandoff(userId: string, handoffRequest: DeviceHandoffRequest): Promise<boolean> {
    try {
      const conversation = this.getActiveConversation(userId, handoffRequest.conversationId);
      
      if (!conversation) {
        throw new DeviceCommunicationError('Conversation not found', {
          timestamp: new Date(),
          userId,
          deviceId: handoffRequest.fromDeviceId,
          conversationId: handoffRequest.conversationId
        });
      }

      // Verify both devices are connected
      const fromConnected = this.syncServer.isDeviceConnected(handoffRequest.fromDeviceId);
      const toConnected = this.syncServer.isDeviceConnected(handoffRequest.toDeviceId);

      if (!fromConnected || !toConnected) {
        throw new DeviceCommunicationError('One or both devices are not connected', {
          timestamp: new Date(),
          userId,
          deviceId: handoffRequest.fromDeviceId,
          additionalData: {
            fromConnected,
            toConnected,
            fromDeviceId: handoffRequest.fromDeviceId,
            toDeviceId: handoffRequest.toDeviceId
          }
        });
      }

      // Update conversation state
      this.updateConversationState(userId, handoffRequest.conversationId, {
        activeDeviceId: handoffRequest.toDeviceId,
        context: { ...conversation.context, ...handoffRequest.context }
      });

      // Notify target device about handoff
      this.broadcastToDevice(handoffRequest.toDeviceId, {
        type: 'conversation_update',
        userId,
        deviceId: handoffRequest.toDeviceId,
        timestamp: Date.now(),
        payload: {
          action: 'handoff_received',
          conversationId: handoffRequest.conversationId,
          fromDeviceId: handoffRequest.fromDeviceId,
          context: handoffRequest.context
        }
      });

      // Notify source device about handoff completion
      this.broadcastToDevice(handoffRequest.fromDeviceId, {
        type: 'conversation_update',
        userId,
        deviceId: handoffRequest.fromDeviceId,
        timestamp: Date.now(),
        payload: {
          action: 'handoff_completed',
          conversationId: handoffRequest.conversationId,
          toDeviceId: handoffRequest.toDeviceId
        }
      });

      // Record successful handoff
      applicationMetrics.recordDeviceSync('handoff', 'cross-device', true);
      syncLogger.info('Device handoff completed successfully', {
        userId,
        fromDeviceId: handoffRequest.fromDeviceId,
        toDeviceId: handoffRequest.toDeviceId,
        conversationId: handoffRequest.conversationId
      });

      return true;
    } catch (error) {
      // Record failed handoff
      applicationMetrics.recordDeviceSync('handoff', 'cross-device', false);
      syncLogger.error('Device handoff failed', {
        userId,
        fromDeviceId: handoffRequest.fromDeviceId,
        toDeviceId: handoffRequest.toDeviceId,
        conversationId: handoffRequest.conversationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, error instanceof Error ? error : undefined);

      throw error;
    }
  }

  // Conflict resolution methods
  resolveConflict(userId: string, conflictData: any): void {
    // Use the advanced conflict resolution with timestamp strategy
    this.resolveConflictAdvanced(userId, conflictData, 'timestamp');
  }

  // Message broadcasting with priority and filtering
  broadcastWithFilter(userId: string, message: SyncMessage, filter?: (deviceId: string) => boolean): void {
    const connectedDevices = this.syncServer.getConnectedDevices(userId);
    
    connectedDevices.forEach(socket => {
      if (socket.deviceId && (!filter || filter(socket.deviceId))) {
        socket.emit('sync_message', message);
      }
    });
  }

  // Broadcast to specific device types
  broadcastToDeviceType(userId: string, deviceType: string, message: SyncMessage): void {
    this.broadcastWithFilter(userId, message, (deviceId) => {
      // This would need device type lookup - simplified for now
      return true;
    });
  }

  // Enhanced conflict resolution with different strategies
  resolveConflictAdvanced(userId: string, conflictData: any, strategy: 'timestamp' | 'priority' | 'user_choice' = 'timestamp'): void {
    const { conversationId, conflictingMessages } = conflictData;
    let resolvedMessage;

    switch (strategy) {
      case 'timestamp':
        // Sort by timestamp and take the latest
        resolvedMessage = conflictingMessages.sort((a: any, b: any) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )[0];
        break;
      
      case 'priority':
        // Sort by device priority (desktop > mobile > wearable > web)
        const devicePriority: Record<string, number> = { desktop: 4, mobile: 3, wearable: 2, web: 1 };
        resolvedMessage = conflictingMessages.sort((a: any, b: any) => 
          (devicePriority[b.deviceType as string] || 0) - (devicePriority[a.deviceType as string] || 0)
        )[0];
        break;
      
      case 'user_choice':
        // Present options to user - for now, default to timestamp
        resolvedMessage = conflictingMessages.sort((a: any, b: any) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )[0];
        break;
      
      default:
        resolvedMessage = conflictingMessages[0];
    }

    // Broadcast resolution to all user devices
    this.broadcastToUser(userId, {
      type: 'conversation_update',
      userId,
      deviceId: resolvedMessage.deviceId,
      timestamp: Date.now(),
      payload: {
        action: 'conflict_resolved',
        conversationId,
        resolvedMessage,
        conflictingMessages,
        strategy
      }
    });
  }

  // Message queuing for offline devices
  private messageQueue: Map<string, SyncMessage[]> = new Map();

  queueMessageForDevice(deviceId: string, message: SyncMessage): void {
    if (!this.messageQueue.has(deviceId)) {
      this.messageQueue.set(deviceId, []);
    }
    
    const queue = this.messageQueue.get(deviceId)!;
    queue.push(message);
    
    // Limit queue size to prevent memory issues
    if (queue.length > 100) {
      queue.shift(); // Remove oldest message
    }
  }

  deliverQueuedMessages(deviceId: string): void {
    const queue = this.messageQueue.get(deviceId);
    if (!queue || queue.length === 0) return;

    // Send all queued messages
    queue.forEach(message => {
      this.broadcastToDevice(deviceId, message);
    });

    // Clear the queue
    this.messageQueue.delete(deviceId);
  }

  // Enhanced device handoff with state transfer
  async requestDeviceHandoffAdvanced(
    userId: string, 
    handoffRequest: DeviceHandoffRequest & { transferState?: boolean }
  ): Promise<boolean> {
    try {
      const conversation = this.getActiveConversation(userId, handoffRequest.conversationId);
      
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      // Verify both devices are connected
      const fromConnected = this.syncServer.isDeviceConnected(handoffRequest.fromDeviceId);
      const toConnected = this.syncServer.isDeviceConnected(handoffRequest.toDeviceId);

      if (!fromConnected || !toConnected) {
        throw new Error('One or both devices are not connected');
      }

      // Prepare handoff data
      const handoffData = {
        conversationState: conversation,
        context: { ...conversation.context, ...handoffRequest.context },
        timestamp: Date.now()
      };

      // Notify target device about incoming handoff
      this.broadcastToDevice(handoffRequest.toDeviceId, {
        type: 'conversation_update',
        userId,
        deviceId: handoffRequest.toDeviceId,
        timestamp: Date.now(),
        payload: {
          action: 'handoff_incoming',
          conversationId: handoffRequest.conversationId,
          fromDeviceId: handoffRequest.fromDeviceId,
          handoffData
        }
      });

      // Wait for acknowledgment (simplified - in real implementation, use promises/callbacks)
      setTimeout(() => {
        // Update conversation state
        this.updateConversationState(userId, handoffRequest.conversationId, {
          activeDeviceId: handoffRequest.toDeviceId,
          context: handoffData.context
        });

        // Notify source device about handoff completion
        this.broadcastToDevice(handoffRequest.fromDeviceId, {
          type: 'conversation_update',
          userId,
          deviceId: handoffRequest.fromDeviceId,
          timestamp: Date.now(),
          payload: {
            action: 'handoff_completed',
            conversationId: handoffRequest.conversationId,
            toDeviceId: handoffRequest.toDeviceId
          }
        });

        // Notify target device about handoff success
        this.broadcastToDevice(handoffRequest.toDeviceId, {
          type: 'conversation_update',
          userId,
          deviceId: handoffRequest.toDeviceId,
          timestamp: Date.now(),
          payload: {
            action: 'handoff_received',
            conversationId: handoffRequest.conversationId,
            fromDeviceId: handoffRequest.fromDeviceId,
            handoffData
          }
        });
      }, 100); // Small delay to simulate acknowledgment

      return true;
    } catch (error) {
      console.error('Advanced device handoff error:', error);
      return false;
    }
  }

  // Utility methods
  private findSocketIdByDeviceId(deviceId: string): string | undefined {
    // Get all connected devices and find the one with matching deviceId
    const allConnectedDevices = Array.from(this.syncServer['connectedDevices'].values());
    const device = allConnectedDevices.find(socket => socket.deviceId === deviceId);
    return device?.id;
  }

  // Statistics and monitoring
  getConnectionStats(userId: string) {
    const connectedDevices = this.syncServer.getConnectedDevices(userId);
    const roomSize = this.syncServer.getUserRoomSize(userId);
    const activeConversations = Array.from(this.activeConversations.keys())
      .filter(key => key.startsWith(`${userId}:`));

    return {
      connectedDevices: connectedDevices.length,
      roomSize,
      activeConversations: activeConversations.length,
      devices: connectedDevices.map(socket => ({
        socketId: socket.id,
        deviceId: socket.deviceId || socket.id,
        connected: true
      }))
    };
  }

  // Cleanup methods
  cleanup(): void {
    this.activeConversations.clear();
    this.messageQueue.clear();
  }
}