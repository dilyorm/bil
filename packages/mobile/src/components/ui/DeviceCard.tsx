import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Device } from '../../types/device';

interface DeviceCardProps {
  device: Device;
  onEdit?: (device: Device) => void;
  onRemove?: (device: Device) => void;
  onToggleActive?: (device: Device) => void;
}

export const DeviceCard: React.FC<DeviceCardProps> = ({
  device,
  onEdit,
  onRemove,
  onToggleActive,
}) => {
  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'mobile':
        return '📱';
      case 'desktop':
        return '💻';
      case 'wearable':
        return '⌚';
      case 'web':
        return '🌐';
      default:
        return '📱';
    }
  };

  const getStatusColor = () => {
    if (!device.is_active) return '#999999';
    return device.isConnected ? '#4CAF50' : '#FF9800';
  };

  const getStatusText = () => {
    if (!device.is_active) return 'Inactive';
    return device.isConnected ? 'Connected' : 'Offline';
  };

  const formatLastSeen = (date: Date) => {
    const now = new Date();
    const lastSeen = new Date(date);
    const diffMs = now.getTime() - lastSeen.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const handleLongPress = () => {
    const options = [
      { text: 'Cancel', style: 'cancel' as const },
    ];

    if (onEdit) {
      options.unshift({ text: 'Edit', onPress: () => onEdit(device) });
    }

    if (onToggleActive) {
      options.unshift({
        text: device.is_active ? 'Deactivate' : 'Activate',
        onPress: () => onToggleActive(device),
      });
    }

    if (onRemove) {
      options.unshift({
        text: 'Remove',
        style: 'destructive' as const,
        onPress: () => onRemove(device),
      });
    }

    Alert.alert('Device Options', `Manage ${device.name}`, options);
  };

  return (
    <TouchableOpacity
      style={[styles.container, !device.is_active && styles.inactiveContainer]}
      onLongPress={handleLongPress}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <View style={styles.deviceInfo}>
          <Text style={styles.deviceIcon}>{getDeviceIcon(device.type)}</Text>
          <View style={styles.deviceDetails}>
            <Text style={[styles.deviceName, !device.is_active && styles.inactiveText]}>
              {device.name}
            </Text>
            <Text style={styles.deviceType}>
              {device.type.charAt(0).toUpperCase() + device.type.slice(1)}
            </Text>
          </View>
        </View>
        <View style={styles.statusContainer}>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
          <Text style={[styles.statusText, { color: getStatusColor() }]}>
            {getStatusText()}
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.lastSeen}>
          Last seen: {formatLastSeen(device.last_seen)}
        </Text>
        <View style={styles.capabilities}>
          {device.capabilities.hasVoiceInput && <Text style={styles.capability}>🎤</Text>}
          {device.capabilities.hasVoiceOutput && <Text style={styles.capability}>🔊</Text>}
          {device.capabilities.hasHapticFeedback && <Text style={styles.capability}>📳</Text>}
          {device.capabilities.hasFileAccess && <Text style={styles.capability}>📁</Text>}
          {device.capabilities.hasCamera && <Text style={styles.capability}>📷</Text>}
          {device.capabilities.hasBluetooth && <Text style={styles.capability}>📶</Text>}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginVertical: 6,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  inactiveContainer: {
    opacity: 0.6,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
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
  inactiveText: {
    color: '#666666',
  },
  deviceType: {
    fontSize: 14,
    color: '#666666',
    textTransform: 'capitalize',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastSeen: {
    fontSize: 12,
    color: '#999999',
  },
  capabilities: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  capability: {
    fontSize: 14,
    marginLeft: 4,
  },
});