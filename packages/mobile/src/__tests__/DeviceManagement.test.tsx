import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { DevicesScreen } from '../screens/main/DevicesScreen';
import { useDevices } from '../hooks/useDevices';
import { useAuth } from '../hooks/useAuth';

// Mock the hooks
jest.mock('../hooks/useDevices');
jest.mock('../hooks/useAuth');

const mockUseDevices = useDevices as jest.MockedFunction<typeof useDevices>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

describe('DevicesScreen', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: { id: '1', email: 'test@example.com', name: 'Test User' },
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
      isLoading: false,
      error: null,
    });

    mockUseDevices.mockReturnValue({
      devices: [
        {
          id: '1',
          user_id: '1',
          type: 'mobile',
          name: 'iPhone 15',
          capabilities: {
            hasVoiceInput: true,
            hasVoiceOutput: true,
            hasHapticFeedback: true,
            hasFileAccess: false,
            hasCalendarAccess: false,
            supportsGestures: true,
            hasCamera: true,
            hasLocation: true,
            hasBluetooth: true,
          },
          connection_info: {},
          is_active: true,
          last_seen: new Date(),
          created_at: new Date(),
          updated_at: new Date(),
          isConnected: true,
        },
      ],
      activeDevices: [],
      currentDevice: null,
      stats: {
        connectedDevices: 1,
        roomSize: 1,
        activeConversations: 0,
        totalDevices: 1,
        activeDevices: 1,
        inactiveDevices: 0,
        devices: [],
      },
      isLoading: false,
      error: null,
      refreshDevices: jest.fn(),
      registerDevice: jest.fn(),
      updateDevice: jest.fn(),
      removeDevice: jest.fn(),
      deactivateDevice: jest.fn(),
      sendHeartbeat: jest.fn(),
      isOnline: true,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders device list correctly', () => {
    const { getByText } = render(<DevicesScreen />);
    
    expect(getByText('Connected Devices')).toBeTruthy();
    expect(getByText('iPhone 15')).toBeTruthy();
    expect(getByText('Add Device')).toBeTruthy();
    expect(getByText('Pair Wearable')).toBeTruthy();
  });

  it('shows stats correctly', () => {
    const { getByText } = render(<DevicesScreen />);
    
    expect(getByText('1')).toBeTruthy(); // Connected devices count
    expect(getByText('Connected')).toBeTruthy();
  });

  it('opens add device modal when button is pressed', () => {
    const { getByText } = render(<DevicesScreen />);
    
    const addButton = getByText('Add Device');
    fireEvent.press(addButton);
    
    // Modal should open
    expect(getByText('Cancel')).toBeTruthy();
  });

  it('shows empty state when no devices', () => {
    mockUseDevices.mockReturnValue({
      ...mockUseDevices(),
      devices: [],
      stats: {
        connectedDevices: 0,
        roomSize: 0,
        activeConversations: 0,
        totalDevices: 0,
        activeDevices: 0,
        inactiveDevices: 0,
        devices: [],
      },
    });

    const { getByText } = render(<DevicesScreen />);
    
    expect(getByText('No Devices Found')).toBeTruthy();
    expect(getByText('Add your first device to start syncing across all your devices')).toBeTruthy();
  });

  it('shows offline indicator when offline', () => {
    mockUseDevices.mockReturnValue({
      ...mockUseDevices(),
      isOnline: false,
    });

    const { getByText } = render(<DevicesScreen />);
    
    expect(getByText('Offline Mode')).toBeTruthy();
  });
});