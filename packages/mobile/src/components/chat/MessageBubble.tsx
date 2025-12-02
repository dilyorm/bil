import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Message } from '../../types/chat';

interface MessageBubbleProps {
  message: Message;
  onSpeak?: (text: string) => void;
  isPlaying?: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  onSpeak,
  isPlaying,
}) => {
  const isUser = message.role === 'user';
  const isVoiceMessage = message.metadata?.inputMethod === 'voice';

  const formatTime = (timestamp: Date) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <View style={[styles.container, isUser ? styles.userContainer : styles.assistantContainer]}>
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
        <Text style={[styles.messageText, isUser ? styles.userText : styles.assistantText]}>
          {message.content}
        </Text>
        
        <View style={styles.messageFooter}>
          <Text style={[styles.timestamp, isUser ? styles.userTimestamp : styles.assistantTimestamp]}>
            {formatTime(message.timestamp)}
          </Text>
          
          {isVoiceMessage && (
            <Text style={[styles.voiceIndicator, isUser ? styles.userVoiceIndicator : styles.assistantVoiceIndicator]}>
              🎤
            </Text>
          )}
          
          {message.metadata?.processingTime && (
            <Text style={[styles.processingTime, styles.assistantTimestamp]}>
              {message.metadata.processingTime}ms
            </Text>
          )}
        </View>
      </View>
      
      {!isUser && onSpeak && (
        <TouchableOpacity
          style={[styles.speakButton, isPlaying && styles.speakButtonActive]}
          onPress={() => onSpeak(message.content)}
          disabled={isPlaying}
        >
          <Text style={styles.speakButtonText}>
            {isPlaying ? '🔊' : '🔈'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    paddingHorizontal: 16,
  },
  userContainer: {
    alignItems: 'flex-end',
  },
  assistantContainer: {
    alignItems: 'flex-start',
    flexDirection: 'row',
  },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  userBubble: {
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: '#F0F0F0',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  userText: {
    color: '#FFFFFF',
  },
  assistantText: {
    color: '#000000',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  timestamp: {
    fontSize: 12,
    opacity: 0.7,
  },
  userTimestamp: {
    color: '#FFFFFF',
  },
  assistantTimestamp: {
    color: '#666666',
  },
  voiceIndicator: {
    fontSize: 12,
  },
  userVoiceIndicator: {
    opacity: 0.8,
  },
  assistantVoiceIndicator: {
    opacity: 0.6,
  },
  processingTime: {
    fontSize: 10,
  },
  speakButton: {
    marginLeft: 8,
    padding: 8,
    borderRadius: 16,
    backgroundColor: '#E0E0E0',
  },
  speakButtonActive: {
    backgroundColor: '#007AFF',
  },
  speakButtonText: {
    fontSize: 16,
  },
});