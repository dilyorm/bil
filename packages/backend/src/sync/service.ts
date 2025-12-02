import { DeviceSyncServer, DeviceSyncManager } from './index';

// Service locator for sync services
class SyncServiceLocator {
  private static instance: SyncServiceLocator;
  private _syncServer?: DeviceSyncServer;
  private _syncManager?: DeviceSyncManager;

  private constructor() {}

  static getInstance(): SyncServiceLocator {
    if (!SyncServiceLocator.instance) {
      SyncServiceLocator.instance = new SyncServiceLocator();
    }
    return SyncServiceLocator.instance;
  }

  setSyncServer(server: DeviceSyncServer): void {
    this._syncServer = server;
  }

  setSyncManager(manager: DeviceSyncManager): void {
    this._syncManager = manager;
  }

  getSyncServer(): DeviceSyncServer | undefined {
    return this._syncServer;
  }

  getSyncManager(): DeviceSyncManager | undefined {
    return this._syncManager;
  }
}

export const syncServiceLocator = SyncServiceLocator.getInstance();