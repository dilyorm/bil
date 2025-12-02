import { DataConnector, DataSourceType } from '../types';
import { GoogleCalendarConnector } from './google-calendar';
import { GoogleDriveConnector } from './google-drive';
import { DropboxConnector } from './dropbox';
import { FileSystemConnector } from './file-system';

export class ConnectorRegistry {
  private connectors: Map<string, DataConnector> = new Map();
  private static instance: ConnectorRegistry;

  private constructor() {
    this.initializeConnectors();
  }

  static getInstance(): ConnectorRegistry {
    if (!ConnectorRegistry.instance) {
      ConnectorRegistry.instance = new ConnectorRegistry();
    }
    return ConnectorRegistry.instance;
  }

  private initializeConnectors(): void {
    // Register all available connectors
    this.registerConnector(new GoogleCalendarConnector());
    this.registerConnector(new GoogleDriveConnector());
    this.registerConnector(new DropboxConnector());
    this.registerConnector(new FileSystemConnector());
  }

  private registerConnector(connector: DataConnector): void {
    this.connectors.set(connector.id, connector);
  }

  getConnector(id: string): DataConnector | undefined {
    return this.connectors.get(id);
  }

  getConnectorByType(type: DataSourceType): DataConnector | undefined {
    for (const connector of this.connectors.values()) {
      if (connector.type === type) {
        return connector;
      }
    }
    return undefined;
  }

  getAllConnectors(): DataConnector[] {
    return Array.from(this.connectors.values());
  }

  getAvailableConnectorTypes(): DataSourceType[] {
    return Array.from(this.connectors.values()).map(connector => connector.type);
  }

  createConnectorInstance(type: DataSourceType): DataConnector {
    switch (type) {
      case DataSourceType.GOOGLE_CALENDAR:
        return new GoogleCalendarConnector();
      case DataSourceType.GOOGLE_DRIVE:
        return new GoogleDriveConnector();
      case DataSourceType.DROPBOX:
        return new DropboxConnector();
      case DataSourceType.FILE_SYSTEM:
        return new FileSystemConnector();
      default:
        throw new Error(`Unknown connector type: ${type}`);
    }
  }
}