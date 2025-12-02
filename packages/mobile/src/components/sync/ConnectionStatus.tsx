import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSync } from '../../hooks/useSync';

interface ConnectionStatusProps {
  showDetails?: boolean;
  onPress?: () => void;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ 
  showDetails = false, 
  onPress 
}) => {
  const { syncState, connectedDevices, deviceCount } = useSync();

  const getStatusColor = () => {
    if (syncState.isConnected) return '#4CAF50'; // Green
    if (syncState.isConnecting) return '#FF9800'; // Orange
    return '#F44336'; // Red
  };

  const getStatusText = () => {
    if (syncState.isConnected) return 'Connected';
    if (syncState.isConnecting) return 'Connecting...';
    return 'Disconnected';
  };

  const getStatusIcon = () => {
    if (syncState.isConnected) return '●';
    if (syncState.isConnecting) return '◐';
    return '○';
  };

  const content = (
    <View style={styles.container}>
      <View style={styles.statusRow}>
        <Text style={[styles.statusIcon, { color: getStatusColor() }]}>
          {getStatusIcon()}
        </Text>
        <Text style={[styles.statusText, { color: getStatusColor() }]}>
          {getStatusText()}
        </Text>
        {syncState.isConnected && deviceCount > 0 && (
          <Text style={styles.deviceCount}>
            {deviceCount} device{deviceCount !== 1 ? 's' : ''}
          </Text>
        )}
      </View>
      
      {showDetails && (
        <View style={styles.details}>
          {syncState.connectionError && (
            <Text style={styles.errorText}>
              Error: {syncState.connectionError}
            </Text>
          )}
          
          {syncState.retryCount > 0 && (
            <Text style={styles.retryText}>
              Retry attempt: {syncState.retryCount}/{syncState.maxRetries}
            </Text>
          )}
          
          {syncState.lastSyncTime && (
            <Text style={styles.lastSyncText}>
              Last sync: {syncState.lastSyncTime.toLocaleTimeString()}
            </Text>
          )}
        </View>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} style={styles.touchable}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  touchable: {
    borderRadius: 8,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusIcon: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  deviceCount: {
    fontSize: 12,
    color: '#666',
    marginLeft: 'auto',
  },
  details: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  errorText: {
    fontSize: 12,
    color: '#F44336',
    marginBottom: 4,
  },
  retryText: {
    fontSize: 12,
    color: '#FF9800',
    marginBottom: 4,
  },
  lastSyncText: {
    fontSize: 12,
    color: '#666',
  },
});