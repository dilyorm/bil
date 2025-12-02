import { useState, useEffect, useCallback } from 'react';
import { Message, ChatState, VoiceState } from '../types/chat';
import { apiService } from '../services/api';
import { voiceService } from '../services/voice';
import { useAuth } from './useAuth';
import { useSync } from './useSync';

export const useChat = () => {
  const { accessToken } = useAuth();
  const [chatState, setChatState] = useState<ChatState>({
    messages: [],
    isLoading: false,
    isTyping: false,
    error: null,
  });

  const [voiceState, setVoiceState] = useState<VoiceState>({
    isRecording: false,
    isPlaying: false,
    isProcessing: false,
    transcript: '',
    error: null,
  });

  // Sync integration
  const sync = useSync({
    onMessageReceived: (message: Message) => {
      // Add message from other device to local state
      setChatState(prev => ({
        ...prev,
        messages: [...prev.messages, message],
      }));
    },
    onTypingIndicator: (deviceId: string, isTyping: boolean) => {
      // This is handled by the SyncTypingIndicator component
      console.log(`Device ${deviceId} typing: ${isTyping}`);
    },
    autoConnect: true,
  });

  // Initialize voice service and load conversation history
  useEffect(() => {
    const initialize = async () => {
      try {
        await voiceService.initialize();
        if (accessToken) {
          apiService.setAccessToken(accessToken);
          await loadConversationHistory();
        }
      } catch (error) {
        console.error('Failed to initialize chat:', error);
        setChatState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Failed to initialize chat',
        }));
      }
    };

    initialize();
  }, [accessToken]);

  const loadConversationHistory = useCallback(async () => {
    try {
      setChatState(prev => ({ ...prev, isLoading: true, error: null }));
      const response = await apiService.getConversationHistory();
      
      setChatState(prev => ({
        ...prev,
        messages: response.data.messages,
        isLoading: false,
      }));
    } catch (error) {
      console.error('Failed to load conversation history:', error);
      setChatState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load conversation history',
      }));
    }
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
      metadata: {
        inputMethod: 'text',
      },
    };

    // Add user message immediately
    setChatState(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      isTyping: true,
      error: null,
    }));

    // Broadcast user message to other devices
    try {
      await sync.broadcastMessage(userMessage);
    } catch (error) {
      console.warn('Failed to broadcast user message:', error);
    }

    try {
      const response = await apiService.sendMessage({
        message: content.trim(),
        deviceContext: {
          type: 'mobile',
          capabilities: ['voice_input', 'voice_output', 'text_input'],
        },
      });

      const assistantMessage: Message = {
        id: response.data.messageId,
        role: 'assistant',
        content: response.data.response,
        timestamp: new Date(),
        metadata: {
          inputMethod: 'text',
          processingTime: response.data.processingTime,
        },
      };

      setChatState(prev => ({
        ...prev,
        messages: [...prev.messages, assistantMessage],
        isTyping: false,
      }));

      // Broadcast assistant message to other devices
      try {
        await sync.broadcastMessage(assistantMessage);
      } catch (error) {
        console.warn('Failed to broadcast assistant message:', error);
      }

      // Speak the response if voice is available
      if (response.data.response) {
        await speakMessage(response.data.response);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      setChatState(prev => ({
        ...prev,
        isTyping: false,
        error: error instanceof Error ? error.message : 'Failed to send message',
      }));
    }
  }, [sync]);

  const startVoiceRecording = useCallback(async () => {
    try {
      setVoiceState(prev => ({ ...prev, error: null }));
      
      await voiceService.startRecording({
        onStart: () => {
          setVoiceState(prev => ({ ...prev, isRecording: true }));
        },
        onError: (error) => {
          setVoiceState(prev => ({
            ...prev,
            isRecording: false,
            error,
          }));
        },
      });
    } catch (error) {
      console.error('Failed to start voice recording:', error);
      setVoiceState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to start recording',
      }));
    }
  }, []);

  const stopVoiceRecording = useCallback(async () => {
    try {
      setVoiceState(prev => ({ ...prev, isProcessing: true }));
      
      const audioUri = await voiceService.stopRecording();
      setVoiceState(prev => ({ ...prev, isRecording: false }));

      if (audioUri) {
        // Send voice message to backend
        const response = await apiService.sendVoiceMessage({
          audioUri,
          deviceContext: {
            type: 'mobile',
            capabilities: ['voice_input', 'voice_output', 'text_input'],
          },
        });

        // Add user message (transcript will be provided by backend)
        const userMessage: Message = {
          id: Date.now().toString(),
          role: 'user',
          content: 'Voice message', // Backend should provide transcript
          timestamp: new Date(),
          metadata: {
            inputMethod: 'voice',
          },
        };

        const assistantMessage: Message = {
          id: response.data.messageId,
          role: 'assistant',
          content: response.data.response,
          timestamp: new Date(),
          metadata: {
            inputMethod: 'voice',
            processingTime: response.data.processingTime,
          },
        };

        setChatState(prev => ({
          ...prev,
          messages: [...prev.messages, userMessage, assistantMessage],
        }));

        // Broadcast messages to other devices
        try {
          await sync.broadcastMessage(userMessage);
          await sync.broadcastMessage(assistantMessage);
        } catch (error) {
          console.warn('Failed to broadcast voice messages:', error);
        }

        // Speak the response
        await speakMessage(response.data.response);
      }

      setVoiceState(prev => ({ ...prev, isProcessing: false }));
    } catch (error) {
      console.error('Failed to process voice recording:', error);
      setVoiceState(prev => ({
        ...prev,
        isRecording: false,
        isProcessing: false,
        error: error instanceof Error ? error.message : 'Failed to process voice message',
      }));
    }
  }, []);

  const speakMessage = useCallback(async (text: string) => {
    try {
      setVoiceState(prev => ({ ...prev, error: null }));
      
      await voiceService.speak(text, {
        onStart: () => {
          setVoiceState(prev => ({ ...prev, isPlaying: true }));
        },
        onDone: () => {
          setVoiceState(prev => ({ ...prev, isPlaying: false }));
        },
        onError: (error) => {
          setVoiceState(prev => ({
            ...prev,
            isPlaying: false,
            error,
          }));
        },
      });
    } catch (error) {
      console.error('Failed to speak message:', error);
      setVoiceState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to speak message',
      }));
    }
  }, []);

  const stopSpeaking = useCallback(async () => {
    try {
      await voiceService.stopSpeaking();
      setVoiceState(prev => ({ ...prev, isPlaying: false }));
    } catch (error) {
      console.error('Failed to stop speaking:', error);
    }
  }, []);

  const clearError = useCallback(() => {
    setChatState(prev => ({ ...prev, error: null }));
    setVoiceState(prev => ({ ...prev, error: null }));
  }, []);

  const clearMessages = useCallback(async () => {
    try {
      await apiService.deleteConversationHistory();
      setChatState(prev => ({ ...prev, messages: [] }));
    } catch (error) {
      console.error('Failed to clear messages:', error);
      setChatState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to clear messages',
      }));
    }
  }, []);

  // Typing indicator support
  const sendTypingIndicator = useCallback(async (isTyping: boolean) => {
    try {
      await sync.sendTypingIndicator(isTyping);
    } catch (error) {
      console.warn('Failed to send typing indicator:', error);
    }
  }, [sync]);

  return {
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
    loadConversationHistory,
    sendTypingIndicator,
  };
};