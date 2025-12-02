import React, { useState, useRef, useCallback } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet } from 'react-native';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  onTypingChange?: (isTyping: boolean) => void;
  disabled?: boolean;
  placeholder?: string;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  onTypingChange,
  disabled = false,
  placeholder = 'Type a message...',
}) => {
  const [message, setMessage] = useState('');
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);

  const handleSend = () => {
    if (message.trim() && !disabled) {
      // Stop typing indicator
      if (isTypingRef.current) {
        onTypingChange?.(false);
        isTypingRef.current = false;
      }
      
      onSendMessage(message.trim());
      setMessage('');
    }
  };

  const handleTextChange = useCallback((text: string) => {
    setMessage(text);
    
    if (!onTypingChange) return;

    // Start typing indicator if not already active
    if (!isTypingRef.current && text.trim()) {
      onTypingChange(true);
      isTypingRef.current = true;
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set timeout to stop typing indicator
    if (text.trim()) {
      typingTimeoutRef.current = setTimeout(() => {
        if (isTypingRef.current) {
          onTypingChange(false);
          isTypingRef.current = false;
        }
      }, 2000); // Stop typing indicator after 2 seconds of inactivity
    } else {
      // Stop typing immediately if text is empty
      if (isTypingRef.current) {
        onTypingChange(false);
        isTypingRef.current = false;
      }
    }
  }, [onTypingChange]);

  return (
    <View style={styles.container}>
      <TextInput
        style={[styles.input, disabled && styles.inputDisabled]}
        value={message}
        onChangeText={handleTextChange}
        placeholder={placeholder}
        placeholderTextColor="#999999"
        multiline
        maxLength={1000}
        editable={!disabled}
        onSubmitEditing={handleSend}
        blurOnSubmit={false}
      />
      <TouchableOpacity
        style={[
          styles.sendButton,
          (!message.trim() || disabled) && styles.sendButtonDisabled,
        ]}
        onPress={handleSend}
        disabled={!message.trim() || disabled}
      >
        <Text style={[
          styles.sendButtonText,
          (!message.trim() || disabled) && styles.sendButtonTextDisabled,
        ]}>
          Send
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    gap: 12,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    maxHeight: 100,
    backgroundColor: '#F8F8F8',
  },
  inputDisabled: {
    backgroundColor: '#F0F0F0',
    color: '#999999',
  },
  sendButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#C7C7CC',
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  sendButtonTextDisabled: {
    color: '#FFFFFF',
    opacity: 0.6,
  },
});