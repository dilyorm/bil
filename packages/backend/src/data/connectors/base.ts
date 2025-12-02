import { DataConnector, DataSourceType, DataSourceCapabilities } from '../types';

export abstract class BaseConnector implements DataConnector {
  public readonly id: string;
  public readonly name: string;
  public readonly type: DataSourceType;
  protected _isConnected: boolean = false;

  constructor(id: string, name: string, type: DataSourceType) {
    this.id = id;
    this.name = name;
    this.type = type;
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  abstract connect(credentials: any): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract testConnection(): Promise<boolean>;
  abstract getCapabilities(): DataSourceCapabilities;

  protected setConnected(connected: boolean): void {
    this._isConnected = connected;
  }

  protected validateConnection(): void {
    if (!this._isConnected) {
      throw new Error(`Connector ${this.name} is not connected`);
    }
  }
}