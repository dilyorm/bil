import React, { useState, useRef, useEffect } from 'react';
import styled from 'styled-components';
import { useChat } from '../contexts/ChatContext';
import MessageBubble from '../components/MessageBubble';
import VoiceButton from '../components/VoiceButton';

const ChatContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: ${props => props.theme.colors.background};
`;

const Header = styled.header`
  padding: ${props => props.theme.spacing.lg};
  border-bottom: 1px solid ${props => props.theme.colors.border};
  background-color: ${props => props.theme.colors.surface};
`;

const Title = styled.h1`
  font-size: ${props => props.theme.fontSize.xl};
  font-weight: ${props => props.theme.fontWeight.semibold};
  color: ${props => props.theme.colors.text};
  margin: 0;
`;

const MessagesContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: ${props => props.theme.spacing.lg};
  display: flex;
  flex-direction: column;
  gap: ${props => props.theme.spacing.md};
`;

const InputContainer = styled.div`
  padding: ${props => props.theme.spacing.lg};
  border-top: 1px solid ${props => props.theme.colors.border};
  background-color: ${props => props.theme.colors.surface};
`;

const InputRow = styled.div`
  display: flex;
  gap: ${props => props.theme.spacing.md};
  align-items: flex-end;
`;

const TextInput = styled.textarea`
  flex: 1;
  min-height: 44px;
  max-height: 120px;
  padding: ${props => props.theme.spacing.md};
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: ${props => props.theme.borderRadius.lg};
  font-size: ${props => props.theme.fontSize.md};
  font-family: inherit;
  resize: none;
  outline: none;
  background-color: ${props => props.theme.colors.backgroundTertiary};

  &:focus {
    border-color: ${props => props.theme.colors.primary};
  }

  &::placeholder {
    color: ${props => props.theme.colors.textSecondary};
  }
`;

const SendButton = styled.button`
  padding: ${props => props.theme.spacing.md} ${props => props.theme.spacing.lg};
  background-color: ${props => props.theme.colors.primary};
  color: white;
  border: none;
  border-radius: ${props => props.theme.borderRadius.lg};
  font-size: ${props => props.theme.fontSize.md};
  font-weight: ${props => props.theme.fontWeight.medium};
  cursor: pointer;
  transition: ${props => props.theme.transitions.fast};

  &:hover {
    background-color: ${props => props.theme.colors.primaryHover};
  }

  &:disabled {
    background-color: ${props => props.theme.colors.textTertiary};
    cursor: not-allowed;
  }
`;


const EmptyState = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: ${props => props.theme.colors.textSecondary};
`;

const EmptyStateIcon = styled.div`
  font-size: 48px;
  margin-bottom: ${props => props.theme.spacing.lg};
`;

const EmptyStateText = styled.p`
  font-size: ${props => props.theme.fontSize.lg};
  margin-bottom: ${props => props.theme.spacing.md};
`;

const EmptyStateSubtext = styled.p`
  font-size: ${props => props.theme.fontSize.md};
  max-width: 400px;
`;

const ChatScreen: React.FC = () => {
  const { messages, isLoading, sendMessage, sendVoiceMessage, registerVoiceInputCallback } = useChat() as any;
  const [inputValue, setInputValue] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Auto-resize textarea
    if (textInputRef.current) {
      textInputRef.current.style.height = 'auto';
      textInputRef.current.style.height = `${textInputRef.current.scrollHeight}px`;
    }
  }, [inputValue]);

  useEffect(() => {
    // Register voice input callback for global shortcut
    if (registerVoiceInputCallback) {
      registerVoiceInputCallback(() => {
        if (!isRecording && !isLoading) {
          // Focus the text input or trigger voice recording
          if (textInputRef.current) {
            textInputRef.current.focus();
          }
        }
      });
    }
  }, [registerVoiceInputCallback, isRecording, isLoading]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const message = inputValue.trim();
    setInputValue('');
    await sendMessage(message);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleVoiceRecord = async (audioBlob: Blob) => {
    setIsRecording(false);
    await sendVoiceMessage(audioBlob);
  };

  return (
    <ChatContainer>
      <Header>
        <Title>Chat with BIL Assistant</Title>
      </Header>

      <MessagesContainer>
        {messages.length === 0 ? (
          <EmptyState>
            <EmptyStateIcon>🤖</EmptyStateIcon>
            <EmptyStateText>Welcome to BIL Assistant!</EmptyStateText>
            <EmptyStateSubtext>
              Start a conversation by typing a message or using voice input.
            </EmptyStateSubtext>
          </EmptyState>
        ) : (
          [...messages].sort((a, b) => 
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          ).map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))
        )}
        {isLoading && (
          <MessageBubble
            message={{
              id: 'loading',
              role: 'assistant',
              content: 'Thinking...',
              timestamp: new Date()
            }}
            isLoading
          />
        )}
        <div ref={messagesEndRef} />
      </MessagesContainer>

      <InputContainer>
        <InputRow>
          <TextInput
            ref={textInputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message here..."
            disabled={isLoading}
            rows={1}
          />
          <VoiceButton
            onRecord={handleVoiceRecord}
            isRecording={isRecording}
            onRecordingChange={setIsRecording}
            disabled={isLoading}
          />
          <SendButton
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isLoading}
          >
            Send
          </SendButton>
        </InputRow>
      </InputContainer>
    </ChatContainer>
  );
};

export default ChatScreen;