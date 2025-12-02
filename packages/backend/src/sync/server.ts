import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { DeviceModel } from '../database/models/Device';
import { UserModel } from '../database/models/User';

export interface AuthenticatedSocket extends Socket {
  userId: string;
  deviceId?: string;
  user?: any;
}

export interface SyncMessage {
  type: 'conversation_update' | 'device_status' | 'user_preference' | 'message_broadcast';
  userId: string;
  deviceId: string;
  timestamp: number;
  payload: any;
}

export class DeviceSyncServer {
  private io: SocketIOServer;
  private connectedDevices: Map<string, AuthenticatedSocket> = new Map();
  private userRooms: Map<string, Set<string>> = new Map(); // userId -> Set of socketIds

  constructor(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: config.CORS_ORIGIN,
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  private setupMiddleware() {
    // Authentication middleware
    this.io.use(async (socket: any, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          return next(new Error('Authentication token required'));
        }

        // Verify JWT token
        const decoded = jwt.verify(token, config.JWT_SECRET) as any;
        
        // Get user from database
        const user = await UserModel.findById(decoded.userId);
        if (!user) {
          return next(new Error('User not found'));
        }

        // Attach user info to socket
        socket.userId = user.id;
        socket.user = user;
        
        // Get device ID from handshake if provided
        socket.deviceId = socket.handshake.auth.deviceId;

        next();
      } catch (error) {
        console.error('Socket authentication error:', error);
        next(new Error('Authentication failed'));
      }
    });
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket: Socket) => {
      const authSocket = socket as AuthenticatedSocket;
      console.log(`Device connected: ${authSocket.id} for user ${authSocket.userId}`);

      // Join user-specific room
      this.joinUserRoom(authSocket);

      // Handle device registration
      authSocket.on('register_device', async (deviceData) => {
        await this.handleDeviceRegistration(authSocket, deviceData);
      });

      // Handle sync messages
      authSocket.on('sync_message', (message: SyncMessage) => {
        this.handleSyncMessage(authSocket, message);
      });

      // Handle device status updates
      authSocket.on('device_status', async (status) => {
        await this.handleDeviceStatus(authSocket, status);
      });

      // Handle heartbeat
      authSocket.on('heartbeat', async () => {
        await this.handleHeartbeat(authSocket);
      });

      // Handle disconnection
      authSocket.on('disconnect', async (reason) => {
        await this.handleDisconnection(authSocket, reason);
      });

      // Send welcome message
      authSocket.emit('connected', {
        socketId: authSocket.id,
        userId: authSocket.userId,
        timestamp: Date.now()
      });
    });
  }

  private joinUserRoom(socket: AuthenticatedSocket) {
    const userRoom = `user:${socket.userId}`;
    socket.join(userRoom);

    // Track socket in user rooms
    if (!this.userRooms.has(socket.userId)) {
      this.userRooms.set(socket.userId, new Set());
    }
    this.userRooms.get(socket.userId)!.add(socket.id);

    // Track connected device
    this.connectedDevices.set(socket.id, socket);

    // Notify other devices about new connection
    this.broadcastToUserDevices(socket.userId, {
      type: 'device_status',
      userId: socket.userId,
      deviceId: socket.deviceId || socket.id,
      timestamp: Date.now(),
      payload: {
        status: 'connected',
        socketId: socket.id
      }
    }, socket.id);
  }

  private async handleDeviceRegistration(socket: AuthenticatedSocket, deviceData: any) {
    try {
      let device;
      
      if (socket.deviceId) {
        // Update existing device
        device = await DeviceModel.update(socket.deviceId, {
          is_active: true,
          last_seen: new Date(),
          capabilities: deviceData.capabilities,
          connection_info: {
            socketId: socket.id,
            connectedAt: new Date().toISOString()
          }
        });
      } else {
        // Create new device
        device = await DeviceModel.create({
          user_id: socket.userId,
          type: deviceData.type || 'web',
          name: deviceData.name || `Device ${socket.id.substring(0, 8)}`,
          capabilities: deviceData.capabilities || {},
          connection_info: {
            socketId: socket.id,
            connectedAt: new Date().toISOString()
          }
        });
        
        if (device) {
          socket.deviceId = device.id;
        }
      }

      if (device) {
        socket.emit('device_registered', {
          device,
          timestamp: Date.now()
        });

        // Notify other devices about device registration
        this.broadcastToUserDevices(socket.userId, {
          type: 'device_status',
          userId: socket.userId,
          deviceId: device.id,
          timestamp: Date.now(),
          payload: {
            status: 'registered',
            device
          }
        }, socket.id);
      }

    } catch (error) {
      console.error('Device registration error:', error);
      socket.emit('error', {
        type: 'registration_failed',
        message: 'Failed to register device',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private handleSyncMessage(socket: AuthenticatedSocket, message: SyncMessage) {
    try {
      // Validate message
      if (!message.type || !message.userId || message.userId !== socket.userId) {
        socket.emit('error', {
          type: 'invalid_message',
          message: 'Invalid sync message format'
        });
        return;
      }

      // Add timestamp if not provided
      if (!message.timestamp) {
        message.timestamp = Date.now();
      }

      // Add device ID if not provided
      if (!message.deviceId) {
        message.deviceId = socket.deviceId || socket.id;
      }

      // Broadcast to other user devices
      this.broadcastToUserDevices(socket.userId, message, socket.id);

      // Acknowledge receipt
      socket.emit('sync_ack', {
        messageId: message.payload?.messageId,
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('Sync message error:', error);
      socket.emit('error', {
        type: 'sync_failed',
        message: 'Failed to process sync message'
      });
    }
  }

  private async handleDeviceStatus(socket: AuthenticatedSocket, status: any) {
    try {
      if (socket.deviceId) {
        await DeviceModel.update(socket.deviceId, {
          last_seen: new Date(),
          connection_info: {
            ...status,
            socketId: socket.id,
            lastStatusUpdate: new Date().toISOString()
          }
        });
      }

      // Broadcast status to other devices
      this.broadcastToUserDevices(socket.userId, {
        type: 'device_status',
        userId: socket.userId,
        deviceId: socket.deviceId || socket.id,
        timestamp: Date.now(),
        payload: status
      }, socket.id);

    } catch (error) {
      console.error('Device status error:', error);
    }
  }

  private async handleHeartbeat(socket: AuthenticatedSocket) {
    try {
      if (socket.deviceId) {
        await DeviceModel.updateLastSeen(socket.deviceId);
      }

      socket.emit('heartbeat_ack', {
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Heartbeat error:', error);
    }
  }

  private async handleDisconnection(socket: AuthenticatedSocket, reason: string) {
    console.log(`Device disconnected: ${socket.id} for user ${socket.userId}, reason: ${reason}`);

    try {
      // Update device status
      if (socket.deviceId) {
        await DeviceModel.update(socket.deviceId, {
          is_active: false,
          last_seen: new Date()
        });
      }

      // Remove from tracking
      this.connectedDevices.delete(socket.id);
      
      const userSockets = this.userRooms.get(socket.userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          this.userRooms.delete(socket.userId);
        }
      }

      // Notify other devices about disconnection
      this.broadcastToUserDevices(socket.userId, {
        type: 'device_status',
        userId: socket.userId,
        deviceId: socket.deviceId || socket.id,
        timestamp: Date.now(),
        payload: {
          status: 'disconnected',
          reason
        }
      });

    } catch (error) {
      console.error('Disconnection handling error:', error);
    }
  }

  // Public methods for broadcasting messages
  public broadcastToUserDevices(userId: string, message: SyncMessage, excludeSocketId?: string) {
    const userRoom = `user:${userId}`;
    
    if (excludeSocketId) {
      // Broadcast to all sockets in user room except the excluded one
      this.io.to(userRoom).except(excludeSocketId).emit('sync_message', message);
    } else {
      // Broadcast to all sockets in user room
      this.io.to(userRoom).emit('sync_message', message);
    }
  }

  public broadcastToDevice(deviceId: string, message: any) {
    const device = Array.from(this.connectedDevices.values())
      .find(socket => socket.deviceId === deviceId);
    
    if (device) {
      device.emit('sync_message', message);
    }
  }

  public getConnectedDevices(userId: string): AuthenticatedSocket[] {
    return Array.from(this.connectedDevices.values())
      .filter(socket => socket.userId === userId);
  }

  public getUserRoomSize(userId: string): number {
    return this.userRooms.get(userId)?.size || 0;
  }

  public isDeviceConnected(deviceId: string): boolean {
    return Array.from(this.connectedDevices.values())
      .some(socket => socket.deviceId === deviceId);
  }

  // Graceful shutdown
  public async close() {
    console.log('Closing WebSocket server...');
    
    // Notify all connected devices about shutdown
    this.io.emit('server_shutdown', {
      message: 'Server is shutting down',
      timestamp: Date.now()
    });

    // Close all connections
    this.io.close();
  }
}