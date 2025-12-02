import { renderHook, act } from '@testing-library/react-native';
import { useSync } from '../hooks/useSync';
import { syncService } from '../services/sync';

// Mock the sync service
jest.mock('../services/sync', () => ({
  syncService: {
    getState: jest.fn(),
    setCallbacks: jest.fn(),
    setAuth: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
    sendMessage: jest.fn(),
    broadcastConversationUpdate: jest.fn(),
    sendTypingIndicator: jest.fn(),
    updateDeviceStatus: jest.fn(),
  },
}));

// Mock storage service
jest.mock('../services/storage', () => ({
  storageService: {
    getItem: jest.fn().mockResolvedValue('test-device-id'),
    setItem: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock auth hook
jest.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    accessToken: 'test-token',
    user: { id: 'test-user-id' },
  }),
}));

const mockSyncService = syncService as jest.Mocked<typeof syncService>;

describe('useSync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSyncService.getState.mockReturnValue({
      isConnected: false,
      isConnecting: false,
      connectionError: null,
      lastSyncTime: null,
      connectedDevices: [],
      retryCount: 0,
      maxRetries: 5,
    });
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useSync());

    expect(result.current.isConnected).toBe(false);
    expect(result.current.isConnecting).toBe(false);
    expect(result.current.connectedDevices).toEqual([]);
    expect(result.current.typingDevices).toEqual([]);
  });

  it('should setup callbacks on mount', () => {
    renderHook(() => useSync());

    expect(mockSyncService.setCallbacks).toHaveBeenCalledWith(
      expect.objectContaining({
        onConnect: expect.any(Function),
        onDisconnect: expect.any(Function),
        onReconnect: expect.any(Function),
        onReconnectError: expect.any(Function),
        onMessageReceived: expect.any(Function),
        onDeviceStatusUpdate: expect.any(Function),
        onTypingIndicator: expect.any(Function),
      })
    );
  });

  it('should connect when auth is available', async () => {
    mockSyncService.connect.mockResolvedValue();

    renderHook(() => useSync({ autoConnect: true }));

    // Wait for async operations
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(mockSyncService.setAuth).toHaveBeenCalledWith(
      'test-token',
      'test-user-id',
      expect.any(String)
    );
    expect(mockSyncService.connect).toHaveBeenCalled();
  });

  it('should send typing indicator', async () => {
    mockSyncService.sendTypingIndicator.mockResolvedValue();

    const { result } = renderHook(() => useSync());

    await act(async () => {
      await result.current.sendTypingIndicator(true);
    });

    expect(mockSyncService.sendTypingIndicator).toHaveBeenCalledWith(true);
  });

  it('should broadcast message', async () => {
    mockSyncService.broadcastConversationUpdate.mockResolvedValue();

    const { result } = renderHook(() => useSync());

    const testMessage = {
      id: 'test-message',
      role: 'user' as const,
      content: 'Hello',
      timestamp: new Date(),
    };

    await act(async () => {
      await result.current.broadcastMessage(testMessage);
    });

    expect(mockSyncService.broadcastConversationUpdate).toHaveBeenCalledWith({
      messageId: 'test-message',
      message: testMessage,
    });
  });

  it('should disconnect when requested', async () => {
    const { result } = renderHook(() => useSync());

    act(() => {
      result.current.disconnect();
    });

    expect(mockSyncService.disconnect).toHaveBeenCalled();
  });
});