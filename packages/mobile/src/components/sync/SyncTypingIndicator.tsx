import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useSync } from '../../hooks/useSync';

interface SyncTypingIndicatorProps {
  style?: any;
}

export const SyncTypingIndicator: React.FC<SyncTypingIndicatorProps> = ({ style }) => {
  const { typingDevices, hasTypingDevices } = useSync();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    if (hasTypingDevices) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [hasTypingDevices, fadeAnim, scaleAnim]);

  if (!hasTypingDevices) {
    return null;
  }

  const getTypingText = () => {
    const count = typingDevices.length;
    if (count === 1) {
      return 'Another device is typing...';
    } else if (count === 2) {
      return '2 devices are typing...';
    } else {
      return `${count} devices are typing...`;
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        style,
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <View style={styles.content}>
        <View style={styles.dotsContainer}>
          <TypingDot delay={0} />
          <TypingDot delay={200} />
          <TypingDot delay={400} />
        </View>
        <Text style={styles.text}>{getTypingText()}</Text>
      </View>
    </Animated.View>
  );
};

const TypingDot: React.FC<{ delay: number }> = ({ delay }) => {
  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animate = () => {
      Animated.sequence([
        Animated.timing(animValue, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(animValue, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start(() => animate());
    };

    const timeout = setTimeout(animate, delay);
    return () => clearTimeout(timeout);
  }, [animValue, delay]);

  return (
    <Animated.View
      style={[
        styles.dot,
        {
          opacity: animValue,
        },
      ]}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  dotsContainer: {
    flexDirection: 'row',
    marginRight: 8,
    gap: 2,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#666',
  },
  text: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
});