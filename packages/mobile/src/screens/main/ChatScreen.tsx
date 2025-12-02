import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Alert,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useChat } from '../../hooks/useChat';
import { MessageBubble } from '../../components/chat/MessageBubble';
import { TypingIndicator } from '../../components/chat/TypingIndicator';
import { ChatInput } from '../../components/chat/ChatInput';
import { VoiceButton } from '../../components/chat/VoiceButton';
import { WakeWordDetector } from '../../components/chat/WakeWordDetector';
import { ConnectionStatus } from '../../components/sync/ConnectionStatus';
import { SyncTypingIndicator } from '../../components/sync/SyncTypingIndicator';
import { Message } from '../../types/chat';

export const ChatScreen: React.FC = () => {
  const {
    chatState,
    voiceState,
    sync,
    sendMessage,
    startVoiceRecording,
    stopVoiceRecording,
    speakMessage,
    stopSpeaking,
    clearError,
    clearMessages,
    sendTypingIndicator,
  } = useChat();

  const [wakeWordEnabled, setWakeWordEnabled] = useState(false);
  const [inputMode, setInputMode] = useState<'text' | 'voice'>('text');
  const flatListRef = useRef<FlatList>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatState.messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [chatState.messages]);

  // Show error alerts
  useEffect(() => {
    const error = chatState.error || voiceState.error;
    if (error) {
      Alert.alert('Error', error, [
        { text: 'OK', onPress: clearError },
      ]);
    }
  }, [chatState.error, voiceState.error, clearError]);

  const handleWakeWordDetected = () => {
    if (!voiceState.isRecording && !voiceState.isProcessing) {
      startVoiceRecording();
    }
  };

  const handleClearChat = () => {
    Alert.alert(
      'Clear Chat',
      'Are you sure you want to clear all messages?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: clearMessages },
      ]
    );
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <MessageBubble
      message={item}
      onSpeak={speakMessage}
      isPlaying={voiceState.isPlaying}
    />
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.titleContainer}>
        <Text style={styles.title}>Chat with BIL</Text>
        <ConnectionStatus />
      </View>
      <View style={styles.headerControls}>
        <TouchableOpacity
          style={[styles.modeButton, inputMode === 'text' && styles.modeButtonActive]}
          onPress={() => setInputMode('text')}
        >
          <Text style={[styles.modeButtonText, inputMode === 'text' && styles.modeButtonTextActive]}>
            💬
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeButton, inputMode === 'voice' && styles.modeButtonActive]}
          onPress={() => setInputMode('voice')}
        >
          <Text style={[styles.modeButtonText, inputMode === 'voice' && styles.modeButtonTextActive]}>
            🎤
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.clearButton} onPress={handleClearChat}>
          <Text style={styles.clearButtonText}>🗑️</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderFooter = () => (
    <>
      {chatState.isTyping && <TypingIndicator visible={true} />}
      <SyncTypingIndicator />
      <View style={styles.footerSpacer} />
    </>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <WakeWordDetector
          enabled={wakeWordEnabled}
          onWakeWordDetected={handleWakeWordDetected}
          onToggle={setWakeWordEnabled}
        />

        {renderHeader()}

        <FlatList
          ref={flatListRef}
          style={styles.messagesList}
          data={chatState.messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          ListFooterComponent={renderFooter}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.messagesContainer}
        />

        {inputMode === 'text' ? (
          <ChatInput
            onSendMessage={sendMessage}
            onTypingChange={sendTypingIndicator}
            disabled={chatState.isLoading || voiceState.isRecording}
            placeholder="Type your message to BIL..."
          />
        ) : (
          <View style={styles.voiceInputContainer}>
            <VoiceButton
              isRecording={voiceState.isRecording}
              isProcessing={voiceState.isProcessing}
              onStartRecording={startVoiceRecording}
              onStopRecording={stopVoiceRecording}
              disabled={chatState.isLoading}
            />
            <Text style={styles.voiceInstructions}>
              {voiceState.isRecording
                ? 'Tap to stop recording'
                : voiceState.isProcessing
                ? 'Processing your message...'
                : 'Tap to start recording'}
            </Text>
            {voiceState.isPlaying && (
              <TouchableOpacity style={styles.stopSpeakingButton} onPress={stopSpeaking}>
                <Text style={styles.stopSpeakingText}>Stop Speaking</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
  },
  headerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modeButton: {
    padding: 8,
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
  },
  modeButtonActive: {
    backgroundColor: '#007AFF',
  },
  modeButtonText: {
    fontSize: 16,
  },
  modeButtonTextActive: {
    opacity: 0.8,
  },
  clearButton: {
    padding: 8,
    borderRadius: 16,
    backgroundColor: '#FF3B30',
  },
  clearButtonText: {
    fontSize: 16,
  },
  messagesList: {
    flex: 1,
  },
  messagesContainer: {
    paddingVertical: 8,
  },
  footerSpacer: {
    height: 20,
  },
  voiceInputContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
    backgroundColor: '#F8F8F8',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    gap: 12,
  },
  voiceInstructions: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
  },
  stopSpeakingButton: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  stopSpeakingText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});