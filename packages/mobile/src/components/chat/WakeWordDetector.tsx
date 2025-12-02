import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { voiceService } from '../../services/voice';

interface WakeWordDetectorProps {
  enabled: boolean;
  onWakeWordDetected: () => void;
  onToggle: (enabled: boolean) => void;
}

export const WakeWordDetector: React.FC<WakeWordDetectorProps> = ({
  enabled,
  onWakeWordDetected,
  onToggle,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const startListening = async () => {
      if (!enabled) return;

      try {
        setError(null);
        setIsListening(true);

        // In a real implementation, this would use continuous audio monitoring
        // For now, we'll simulate wake word detection with a simple interval
        intervalId = setInterval(async () => {
          if (enabled) {
            // Simulate wake word detection
            // In reality, this would analyze audio input for "Hey BIL"
            const detected = Math.random() < 0.001; // Very low probability for demo
            
            if (detected) {
              onWakeWordDetected();
            }
          }
        }, 1000);
      } catch (err) {
        console.error('Wake word detection error:', err);
        setError(err instanceof Error ? err.message : 'Wake word detection failed');
        setIsListening(false);
      }
    };

    const stopListening = () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
      setIsListening(false);
    };

    if (enabled) {
      startListening();
    } else {
      stopListening();
    }

    return () => {
      stopListening();
    };
  }, [enabled, onWakeWordDetected]);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.toggleButton, enabled && styles.toggleButtonActive]}
        onPress={() => onToggle(!enabled)}
      >
        <Text style={[styles.toggleText, enabled && styles.toggleTextActive]}>
          {enabled ? '👂' : '🔇'} Wake Word
        </Text>
      </TouchableOpacity>
      
      {enabled && (
        <View style={styles.statusContainer}>
          <View style={[styles.statusIndicator, isListening && styles.statusIndicatorActive]} />
          <Text style={styles.statusText}>
            {isListening ? 'Listening for "Hey BIL"' : 'Initializing...'}
          </Text>
        </View>
      )}
      
      {error && (
        <Text style={styles.errorText}>{error}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F8F8F8',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  toggleButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#E0E0E0',
  },
  toggleButtonActive: {
    backgroundColor: '#007AFF',
  },
  toggleText: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '500',
  },
  toggleTextActive: {
    color: '#FFFFFF',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#C7C7CC',
  },
  statusIndicatorActive: {
    backgroundColor: '#34C759',
  },
  statusText: {
    fontSize: 12,
    color: '#666666',
  },
  errorText: {
    fontSize: 12,
    color: '#FF3B30',
    marginTop: 4,
  },
});