export interface SyncMessage {
  type: 'conversation_update' | 'device_status' | 'user_preference';
  userId: string;
  deviceId: string;
  timestamp: number;
  payload: any;
}
