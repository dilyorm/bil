import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../ui/Button';

interface BluetoothDevice {
  id: string;
  name: string;
  rssi?: number;
  isConnectable: boolean;
}

interface DevicePairingModalProps {
  visible: boolean;
  onClose: () => void;
  onDevicePaired: (device: BluetoothDevice) => void;
}

export const DevicePairingModal: React.FC<DevicePairingModalProps> = ({
  visible,
  onClose,
  onDevicePaired,
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [discoveredDevices, setDiscoveredDevices] = useState<BluetoothDevice[]>([]);
  const [isConnecting, setIsConnecting] = useState<string | null>(null);

  // Mock Bluetooth scanning (in real implementation, would use react-native-bluetooth-classic or similar)
  const startScanning = async () => {
    setIsScanning(true);
    setDiscoveredDevices([]);

    // Simulate device discovery
    setTimeout(() => {
      const mockDevices: BluetoothDevice[] = [
        {
          id: 'culon-001',
          name: 'BIL Culon #001',
          rssi: -45,
          isConnectable: true,
        },
        {
          id: 'culon-002',
          name: 'BIL Culon #002',
          rssi: -67,
          isConnectable: true,
        },
        {
          id: 'unknown-device',
          name: 'Unknown Device',
          rssi: -80,
          isConnectable: false,
        },
      ];
      setDiscoveredDevices(mockDevices);
      setIsScanning(false);
    }, 3000);
  };

  const stopScanning = () => {
    setIsScanning(false);
  };

  const connectToDevice = async (device: BluetoothDevice) => {
    if (!device.isConnectable) {
      Alert.alert('Connection Error', 'This device is not compatible with BIL');
      return;
    }

    setIsConnecting(device.id);

    try {
      // Simulate connection process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // In real implementation, would establish BLE connection here
      onDevicePaired(device);
      onClose();
      
      Alert.alert(
        'Device Paired',
        `Successfully connected to ${device.name}`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      Alert.alert(
        'Connection Failed',
        `Failed to connect to ${device.name}. Please try again.`,
        [{ text: 'OK' }]
      );
    } finally {
      setIsConnecting(null);
    }
  };

  const getSignalStrength = (rssi?: number) => {
    if (!rssi) return '📶';
    if (rssi > -50) return '📶';
    if (rssi > -70) return '📶';
    return '📶';
  };

  const renderDevice = ({ item }: { item: BluetoothDevice }) => (
    <TouchableOpacity
      style={[
        styles.deviceItem,
        !item.isConnectable && styles.deviceItemDisabled,
        isConnecting === item.id && styles.deviceItemConnecting,
      ]}
      onPress={() => connectToDevice(item)}
      disabled={!item.isConnectable || isConnecting !== null}
    >
      <View style={styles.deviceInfo}>
        <Text style={styles.deviceIcon}>
          {item.name.includes('Culon') ? '⌚' : '📱'}
        </Text>
        <View style={styles.deviceDetails}>
          <Text style={[
            styles.deviceName,
            !item.isConnectable && styles.disabledText
          ]}>
            {item.name}
          </Text>
          <Text style={styles.deviceId}>{item.id}</Text>
        </View>
      </View>
      
      <View style={styles.deviceStatus}>
        <Text style={styles.signalStrength}>
          {getSignalStrength(item.rssi)}
        </Text>
        {isConnecting === item.id ? (
          <ActivityIndicator size="small" color="#007AFF" />
        ) : (
          <Text style={[
            styles.connectButton,
            !item.isConnectable && styles.disabledText
          ]}>
            {item.isConnectable ? 'Connect' : 'Incompatible'}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>🔍</Text>
      <Text style={styles.emptyTitle}>
        {isScanning ? 'Scanning for devices...' : 'No devices found'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {isScanning 
          ? 'Make sure your BIL device is in pairing mode'
          : 'Tap "Start Scanning" to search for nearby devices'
        }
      </Text>
    </View>
  );

  useEffect(() => {
    if (visible) {
      // Auto-start scanning when modal opens
      startScanning();
    } else {
      // Clean up when modal closes
      stopScanning();
      setDiscoveredDevices([]);
      setIsConnecting(null);
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.cancelButton}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Pair Device</Text>
          <TouchableOpacity
            onPress={isScanning ? stopScanning : startScanning}
            disabled={isConnecting !== null}
          >
            <Text style={[
              styles.scanButton,
              (isScanning || isConnecting !== null) && styles.disabledText
            ]}>
              {isScanning ? 'Stop' : 'Scan'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <Text style={styles.instructions}>
            Make sure your BIL device is in pairing mode and nearby.
          </Text>

          <FlatList
            data={discoveredDevices}
            renderItem={renderDevice}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={renderEmpty}
            style={styles.deviceList}
            showsVerticalScrollIndicator={false}
          />

          {isScanning && (
            <View style={styles.scanningIndicator}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.scanningText}>Scanning for devices...</Text>
            </View>
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Having trouble? Make sure Bluetooth is enabled and your device is in pairing mode.
          </Text>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E0E0E0',
  },
  cancelButton: {
    fontSize: 16,
    color: '#007AFF',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  scanButton: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  instructions: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  deviceList: {
    flex: 1,
  },
  deviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  deviceItemDisabled: {
    opacity: 0.6,
    backgroundColor: '#f5f5f5',
  },
  deviceItemConnecting: {
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  deviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  deviceIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  deviceDetails: {
    flex: 1,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  deviceId: {
    fontSize: 14,
    color: '#666666',
  },
  deviceStatus: {
    alignItems: 'center',
  },
  signalStrength: {
    fontSize: 16,
    marginBottom: 4,
  },
  connectButton: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  disabledText: {
    color: '#CCCCCC',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 32,
  },
  scanningIndicator: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  scanningText: {
    fontSize: 16,
    color: '#666666',
    marginTop: 12,
  },
  footer: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E0E0E0',
  },
  footerText: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
    lineHeight: 20,
  },
});