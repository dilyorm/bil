import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import apiService from '../services/api';
import syncService from '../services/sync';
import audioService from '../services/audio';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  deviceId?: string;
}

interface ChatContextType {
  messages: Message[];
  isLoading: boolean;
  isConnected: boolean;
  sendMessage: (content: string) => Promise<void>;
  sendVoiceMessage: (audioBlob: Blob) => Promise<void>;
  clearMessages: () => void;
  triggerVoiceInput: () => void;
  isTyping: boolean;
  connectedDevices: string[];
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const useChat = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};

interface ChatProviderProps {
  children: ReactNode;
}

export const ChatProvider: React.FC<ChatProviderProps> = ({ children }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [connectedDevices, setConnectedDevices] = useState<string[]>([]);
  const [voiceInputCallback, setVoiceInputCallback] = useState<(() => void) | null>(null);

  useEffect(() => {
    // Load chat history on mount
    loadChatHistory();

    // Set up sync service event handlers
    syncService.setEventHandlers({
      onConversationUpdate: handleConversationUpdate,
      onDeviceStatusChange: handleDeviceStatusChange,
      onTypingIndicator: handleTypingIndicator,
      onConnectionChange: setIsConnected,
    });

    // Listen for voice input trigger from main process
    if (window.electronAPI) {
      window.electronAPI.onTriggerVoiceInput(() => {
        if (voiceInputCallback) {
          voiceInputCallback();
        }
      });

      return () => {
        window.electronAPI.removeAllListeners('trigger-voice-input');
      };
    }
  }, [voiceInputCallback]);

  const loadChatHistory = async () => {
    try {
      const history = await apiService.getChatHistory(50); // Load last 50 messages
      const formattedMessages = history.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: new Date(msg.timestamp),
        deviceId: msg.deviceId,
      }));
      setMessages(formattedMessages);
    } catch (error) {
      console.error('Failed to load chat history:', error);
    }
  };

  const handleConversationUpdate = useCallback((update: any) => {
    const newMessage: Message = {
      id: update.messageId,
      role: update.role,
      content: update.content,
      timestamp: new Date(update.timestamp),
      deviceId: update.deviceId,
    };

    setMessages(prev => {
      // Check if message already exists to avoid duplicates
      const exists = prev.some(msg => msg.id === newMessage.id);
      if (exists) return prev;
      
      return [...prev, newMessage];
    });
  }, []);

  const handleDeviceStatusChange = useCallback((status: any) => {
    setConnectedDevices(prev => {
      const filtered = prev.filter(id => id !== status.deviceId);
      return status.isActive ? [...filtered, status.deviceId] : filtered;
    });
  }, []);

  const handleTypingIndicator = useCallback((data: { deviceId: string; isTyping: boolean }) => {
    // For now, just show if any other device is typing
    setIsTyping(data.isTyping);
  }, []);

  const sendMessage = async (content: string) => {
    const userMessageId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const userMessage: Message = {
      id: userMessageId,
      role: 'user',
      content,
      timestamp: new Date(),
      deviceId: syncService.getConnectionStatus().deviceId
    };

    // Add user message immediately - use functional update to ensure it's added
    setMessages(prev => {
      // Check if message already exists to avoid duplicates
      if (prev.some(m => m.id === userMessageId)) {
        return prev;
      }
      return [...prev, userMessage];
    });
    
    // Small delay to ensure React has processed the state update
    await new Promise(resolve => setTimeout(resolve, 100));

    // First ask backend planner if this should execute actions
    try {
      const plan = await apiService.plan({ message: content });
      const actions = plan?.data?.actions || [];
      if (Array.isArray(actions) && actions.length > 0) {
        let executedCount = 0;
        let lastError: string | undefined;
        const executedActions: string[] = [];
        
        for (const raw of actions) {
          // Normalize action types commonly returned by LLMs
          const type = (raw.type || '').toString().toLowerCase().replace(/\s|-/g, '_');
          const action: any = { ...raw, type };

          try {
            let result: any = null;
            
            // Handle all action types
            if (action.type === 'open_url' && action.url) {
              result = await window.electronAPI?.executeIntent?.({ type: 'open_url', payload: { url: action.url } });
            } else if (action.type === 'open_path' && action.path) {
              result = await window.electronAPI?.executeIntent?.({ type: 'open_path', payload: { path: action.path } });
            } else if (action.type === 'open_application' && action.name) {
              result = await window.electronAPI?.executeIntent?.({ type: 'open_application', payload: { name: action.name } });
            } else if (action.type === 'close_application' && action.name) {
              result = await window.electronAPI?.executeIntent?.({ type: 'close_application', payload: { name: action.name } });
            } else if (action.type === 'create_folder' && action.path) {
              result = await window.electronAPI?.executeIntent?.({ type: 'create_folder', payload: { path: action.path } });
            } else if (action.type === 'create_file' && action.path) {
              result = await window.electronAPI?.executeIntent?.({ type: 'create_file', payload: { path: action.path, content: action.content || '' } });
            } else if (action.type === 'delete_file' && action.path) {
              result = await window.electronAPI?.executeIntent?.({ type: 'delete_file', payload: { path: action.path } });
            } else if (action.type === 'delete_folder' && action.path) {
              result = await window.electronAPI?.executeIntent?.({ type: 'delete_folder', payload: { path: action.path } });
            } else if (action.type === 'search_files' && action.pattern) {
              result = await window.electronAPI?.executeIntent?.({ type: 'search_files', payload: { path: action.path, pattern: action.pattern } });
            } else if (action.type === 'git_init') {
              result = await window.electronAPI?.executeIntent?.({ type: 'git_init', payload: { path: action.path } });
            } else if (action.type === 'create_virtual_env' && action.path) {
              result = await window.electronAPI?.executeIntent?.({ type: 'create_virtual_env', payload: { path: action.path, type: action.envType || 'python' } });
            } else if (action.type === 'install_dependencies') {
              result = await window.electronAPI?.executeIntent?.({ type: 'install_dependencies', payload: { path: action.path, packageManager: action.packageManager || 'npm' } });
            } else if (action.type === 'open_in_ide') {
              result = await window.electronAPI?.executeIntent?.({ type: 'open_in_ide', payload: { path: action.path, ide: action.ide || 'code' } });
            } else if (action.type === 'take_screenshot') {
              result = await window.electronAPI?.executeIntent?.({ type: 'take_screenshot', payload: { path: action.path } });
            } else if (action.type === 'kill_process' && action.name) {
              result = await window.electronAPI?.executeIntent?.({ type: 'kill_process', payload: { name: action.name } });
            } else if (action.type === 'shutdown') {
              result = await window.electronAPI?.executeIntent?.({ type: 'shutdown', payload: { delay: action.delay || 0 } });
            } else if (action.type === 'restart') {
              result = await window.electronAPI?.executeIntent?.({ type: 'restart', payload: { delay: action.delay || 0 } });
            } else if (action.type === 'sleep') {
              result = await window.electronAPI?.executeIntent?.({ type: 'sleep' });
            } else if (action.type === 'empty_trash') {
              result = await window.electronAPI?.executeIntent?.({ type: 'empty_trash' });
            } else if (action.type === 'run_script' && action.language && action.script) {
              result = await window.electronAPI?.executeIntent?.({ type: 'run_script', payload: { language: action.language, script: action.script, args: action.args || [] } });
            } else if (action.type === 'execute_command' && action.command) {
              result = await window.electronAPI?.executeIntent?.({ type: 'execute_command', payload: { command: action.command, args: action.args || [], workingDir: action.workingDir } });
            } else {
              // Action type not handled - try to execute it anyway (might be handled by main process)
              console.warn('Unhandled action type in ChatContext, forwarding to main process:', action.type);
              result = await window.electronAPI?.executeIntent?.({ type: action.type, payload: action });
            }
            
            if (result?.success) {
              executedCount++;
              executedActions.push(action.type);
            } else {
              const errorMsg = result?.error || 'Unknown error';
              console.error(`Action ${action.type} failed:`, errorMsg);
              lastError = errorMsg;
            }
          } catch (error) {
            console.error(`Error executing action ${action.type}:`, error);
            lastError = error instanceof Error ? error.message : 'Unknown error';
          }
        }
        
        if (executedCount > 0) {
          const actionNames = executedActions.join(', ').replace(/_/g, ' ');
          const confirmation: Message = {
            id: `${Date.now() + 1}_${Math.random().toString(36).substr(2, 9)}`,
            role: 'assistant',
            content: `Done! Executed ${executedCount} action(s): ${actionNames}.`,
            timestamp: new Date(),
            deviceId: userMessage.deviceId
          };
          setMessages(prev => [...prev, confirmation]);
          return;
        } else {
          // Before failing, try local intent fallback (e.g., "open youtube")
          try {
            const handled = await maybeHandleLocalIntent(content);
            if (handled) {
              const confirmation: Message = {
                id: `${Date.now() + 1}_${Math.random().toString(36).substr(2, 9)}`,
                role: 'assistant',
                content: 'Opening it now.',
                timestamp: new Date(),
                deviceId: userMessage.deviceId
              };
              setMessages(prev => [...prev, confirmation]);
              return;
            }
          } catch {}

          const failure: Message = {
            id: `${Date.now() + 1}_${Math.random().toString(36).substr(2, 9)}`,
            role: 'assistant',
            content: `I couldn't execute that. ${lastError ? `Error: ${lastError}` : ''}`.trim(),
            timestamp: new Date(),
            deviceId: userMessage.deviceId
          };
          setMessages(prev => [...prev, failure]);
          return;
        }
      } else {
        // Fallback: Quick local intent handling (non-blocking). Example: "open youtube"
        try {
          const handled = await maybeHandleLocalIntent(content);
          if (handled) {
            const confirmation: Message = {
              id: `${Date.now() + 1}_${Math.random().toString(36).substr(2, 9)}`,
              role: 'assistant',
              content: 'Opening it now.',
              timestamp: new Date(),
              deviceId: userMessage.deviceId
            };
            setMessages(prev => [...prev, confirmation]);
            return;
          }
        } catch (e) {
          console.warn('Local intent handling failed:', e);
        }
      }
    } catch (e) {
      console.warn('Planner failed, attempting local intent:', e);
      try {
        const handled = await maybeHandleLocalIntent(content);
        if (handled) {
          const confirmation: Message = {
            id: `${Date.now() + 1}_${Math.random().toString(36).substr(2, 9)}`,
            role: 'assistant',
            content: 'On it.',
            timestamp: new Date(),
            deviceId: userMessage.deviceId
          };
          setMessages(prev => [...prev, confirmation]);
          return;
        }
      } catch {}
    }

    setIsLoading(true);

    try {
      // Broadcast conversation update to other devices
      syncService.broadcastConversationUpdate({
        messageId: userMessage.id,
        content: userMessage.content,
        role: userMessage.role,
        timestamp: userMessage.timestamp,
      });

      // Send message to AI agent
      const response = await apiService.sendChatMessage({
        message: content,
        deviceId: userMessage.deviceId!,
        context: {
          recentMessages: messages.slice(-5), // Send last 5 messages for context
        }
      });

      // Create AI message with timestamp definitely after user message
      const aiMessageTimestamp = new Date(userMessage.timestamp.getTime() + 1000);
      const aiMessage: Message = {
        id: response.data?.messageId || response.messageId || `${Date.now() + 1000}_${Math.random().toString(36).substr(2, 9)}`,
        role: 'assistant',
        content: response.data?.content || response.content || response.message || '',
        timestamp: aiMessageTimestamp,
        deviceId: userMessage.deviceId
      };

      console.log('AI message created:', { content: aiMessage.content, length: aiMessage.content.length });

      // Add AI message - React will preserve order since user message was added first
      setMessages(prev => {
        // Ensure user message exists, then add AI message
        const hasUserMessage = prev.some(m => m.id === userMessage.id);
        if (!hasUserMessage) {
          // User message wasn't added yet (shouldn't happen, but safety check)
          return [userMessage, aiMessage];
        }
        // User message exists, just add AI message
        return [...prev, aiMessage];
      });

      // Broadcast AI response to other devices
      syncService.broadcastConversationUpdate({
        messageId: aiMessage.id,
        content: aiMessage.content,
        role: aiMessage.role,
        timestamp: aiMessage.timestamp,
      });

      // Play TTS if enabled
      const settings = JSON.parse(localStorage.getItem('desktop_settings') || '{}');
      if (settings.voiceActivation && response.audioUrl) {
        try {
          await audioService.playAudioUrl(response.audioUrl);
        } catch (audioError) {
          console.error('Failed to play TTS audio:', audioError);
          // Fallback to Web Speech API
          await audioService.playTextToSpeech(aiMessage.content);
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      
      const errorMessage: Message = {
        id: `${Date.now() + 1}_${Math.random().toString(36).substr(2, 9)}`,
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your message. Please try again.',
        timestamp: new Date(),
        deviceId: userMessage.deviceId
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  async function maybeHandleLocalIntent(text: string): Promise<boolean> {
    if (!text) return false;
    const lower = text.trim().toLowerCase();

    // Patterns: "open <target>", "go to <target>", "launch <target>"
    const openMatch = /^(open|go to|launch)\s+(.+)$/.exec(lower);
    if (!openMatch) return false;

    const target = openMatch[2].trim();

    // Known site shortcuts
    const siteMap: Record<string, string> = {
      youtube: 'https://www.youtube.com/',
      'youtube.com': 'https://www.youtube.com/',
      google: 'https://www.google.com/',
      gmail: 'https://mail.google.com/',
      twitter: 'https://twitter.com/',
      x: 'https://twitter.com/',
      reddit: 'https://www.reddit.com/',
      github: 'https://github.com/',
    };

    // If a raw URL was provided
    if (target.startsWith('http://') || target.startsWith('https://')) {
      await window.electronAPI?.executeIntent?.({ type: 'open_url', payload: { url: target } });
      return true;
    }

    // Known shortcut mapping
    if (siteMap[target]) {
      await window.electronAPI?.executeIntent?.({ type: 'open_url', payload: { url: siteMap[target] } });
      return true;
    }

    // If it's like "open youtube cats" → try a site search
    const words = target.split(/\s+/);
    const site = words[0];
    const rest = words.slice(1).join(' ');
    if (siteMap[site] && rest) {
      // Use a generic search query for the site when possible
      if (site === 'youtube' || site === 'youtube.com') {
        const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(rest)}`;
        await window.electronAPI?.executeIntent?.({ type: 'open_url', payload: { url } });
        return true;
      }
      // Default: Google search
      const url = `https://www.google.com/search?q=${encodeURIComponent(`${site} ${rest}`)}`;
      await window.electronAPI?.executeIntent?.({ type: 'open_url', payload: { url } });
      return true;
    }

    // Fallback: Google the target
    const url = `https://www.google.com/search?q=${encodeURIComponent(target)}`;
    await window.electronAPI?.executeIntent?.({ type: 'open_url', payload: { url } });
    return true;
  }
  const sendVoiceMessage = async (audioBlob: Blob) => {
    setIsLoading(true);

    try {
      // Send audio to speech-to-text service
      const apiResponse = await apiService.sendVoiceMessage({
        audio: audioBlob,
        deviceId: syncService.getConnectionStatus().deviceId,
      });

      // Extract data from API response (backend wraps in { success, data })
      const response = apiResponse?.data || apiResponse;
      const transcription = response?.transcription;
      const aiResponse = response?.aiResponse;

      // The API should return the transcribed text and AI response
      const userMessageId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      if (transcription) {
        // Extract text from transcription object (has text, language, duration, confidence)
        const transcriptionText = typeof transcription === 'string' 
          ? transcription 
          : transcription.text || '';

        if (transcriptionText) {
          // Add user message with transcribed text
          const userMessage: Message = {
            id: userMessageId,
            role: 'user',
            content: transcriptionText,
            timestamp: new Date(),
            deviceId: syncService.getConnectionStatus().deviceId
          };

          setMessages(prev => {
            if (prev.some(m => m.id === userMessageId)) {
              return prev;
            }
            return [...prev, userMessage];
          });

          // Small delay to ensure user message is rendered
          await new Promise(resolve => setTimeout(resolve, 100));

          // Broadcast to other devices
          syncService.broadcastConversationUpdate({
            messageId: userMessage.id,
            content: userMessage.content,
            role: userMessage.role,
            timestamp: userMessage.timestamp,
          });
        }
      }

      if (aiResponse) {
        // Ensure AI message timestamp is after user message
        const userTimestamp = transcription ? new Date(Date.now() - 100) : new Date();
        const aiMessageTimestamp = new Date(userTimestamp.getTime() + 1000);
        
        const aiMessage: Message = {
          id: aiResponse.messageId || aiResponse.id || `${Date.now() + 1000}_${Math.random().toString(36).substr(2, 9)}`,
          role: 'assistant',
          content: aiResponse.content || aiResponse.message || '',
          timestamp: aiMessageTimestamp,
          deviceId: syncService.getConnectionStatus().deviceId
        };

        setMessages(prev => {
          // Ensure user message exists first
          const hasUserMessage = prev.some(m => m.id === userMessageId);
          if (!hasUserMessage && transcription) {
            const userMessage: Message = {
              id: userMessageId,
              role: 'user',
              content: typeof transcription === 'string' ? transcription : transcription.text || '',
              timestamp: userTimestamp,
              deviceId: syncService.getConnectionStatus().deviceId
            };
            return [userMessage, aiMessage];
          }
          return [...prev, aiMessage];
        });

        // Broadcast AI response
        syncService.broadcastConversationUpdate({
          messageId: aiMessage.id,
          content: aiMessage.content,
          role: aiMessage.role,
          timestamp: aiMessage.timestamp,
        });

        // Play TTS audio if provided (base64 encoded)
        if (response?.audioResponse) {
          try {
            // Convert base64 to blob (browser-compatible)
            const base64Data = response.audioResponse;
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const audioBlob = new Blob([byteArray], { type: 'audio/mpeg' });
            await audioService.playAudioBlob(audioBlob);
          } catch (audioError) {
            console.error('Failed to play audio response:', audioError);
          }
        } else if (aiResponse.audioUrl) {
          await audioService.playAudioUrl(aiResponse.audioUrl);
        }
      }
    } catch (error) {
      console.error('Failed to process voice message:', error);
      
      const errorMessage: Message = {
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        role: 'assistant',
        content: 'Sorry, I couldn\'t process your voice message. Please try again.',
        timestamp: new Date(),
        deviceId: syncService.getConnectionStatus().deviceId
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearMessages = async () => {
    try {
      await apiService.deleteChatHistory();
      setMessages([]);
    } catch (error) {
      console.error('Failed to clear chat history:', error);
      // Clear locally even if API call fails
      setMessages([]);
    }
  };

  const triggerVoiceInput = useCallback(() => {
    if (voiceInputCallback) {
      voiceInputCallback();
    }
  }, [voiceInputCallback]);

  // Method to register voice input callback from components
  const registerVoiceInputCallback = useCallback((callback: () => void) => {
    setVoiceInputCallback(() => callback);
  }, []);

  const value: ChatContextType = {
    messages,
    isLoading,
    isConnected,
    sendMessage,
    sendVoiceMessage,
    clearMessages,
    triggerVoiceInput,
    isTyping,
    connectedDevices,
  };

  // Add the callback registration to the context
  const extendedValue = {
    ...value,
    registerVoiceInputCallback,
  };

  return (
    <ChatContext.Provider value={extendedValue as any}>
      {children}
    </ChatContext.Provider>
  );
};