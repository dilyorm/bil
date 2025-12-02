import React from 'react';
import styled, { keyframes } from 'styled-components';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  deviceId?: string;
}

interface MessageBubbleProps {
  message: Message;
  isLoading?: boolean;
}

const MessageContainer = styled.div<{ $isUser: boolean }>`
  display: flex;
  justify-content: ${props => props.$isUser ? 'flex-end' : 'flex-start'};
  margin-bottom: ${props => props.theme.spacing.md};
`;

const BubbleWrapper = styled.div<{ $isUser: boolean }>`
  max-width: 70%;
  display: flex;
  flex-direction: column;
  align-items: ${props => props.$isUser ? 'flex-end' : 'flex-start'};
`;

const Bubble = styled.div<{ $isUser: boolean }>`
  padding: ${props => props.theme.spacing.md} ${props => props.theme.spacing.lg};
  border-radius: ${props => props.theme.borderRadius.lg};
  background-color: ${props => props.$isUser ? props.theme.colors.primary : props.theme.colors.backgroundSecondary};
  color: ${props => props.$isUser ? 'white' : props.theme.colors.text};
  font-size: ${props => props.theme.fontSize.md};
  line-height: 1.5;
  word-wrap: break-word;
  box-shadow: ${props => props.theme.shadows.sm};
`;

const Timestamp = styled.span`
  font-size: ${props => props.theme.fontSize.xs};
  color: ${props => props.theme.colors.textSecondary};
  margin-top: ${props => props.theme.spacing.xs};
`;

const Avatar = styled.div<{ $isUser: boolean }>`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background-color: ${props => props.$isUser ? props.theme.colors.primary : props.theme.colors.secondary};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${props => props.theme.fontSize.sm};
  color: white;
  margin: ${props => props.$isUser ? `0 0 0 ${props.theme.spacing.md}` : `0 ${props.theme.spacing.md} 0 0`};
  flex-shrink: 0;
`;

const MessageRow = styled.div<{ $isUser: boolean }>`
  display: flex;
  align-items: flex-start;
  flex-direction: ${props => props.$isUser ? 'row-reverse' : 'row'};
`;

const pulse = keyframes`
  0%, 80%, 100% {
    opacity: 0.3;
  }
  40% {
    opacity: 1;
  }
`;

const LoadingDots = styled.div`
  display: inline-flex;
  gap: 2px;
  
  span {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background-color: ${props => props.theme.colors.textSecondary};
    animation: ${pulse} 1.4s infinite ease-in-out;
    
    &:nth-child(1) { animation-delay: -0.32s; }
    &:nth-child(2) { animation-delay: -0.16s; }
    &:nth-child(3) { animation-delay: 0s; }
  }
`;

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isLoading = false }) => {
  const isUser = message.role === 'user';

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <MessageContainer $isUser={isUser}>
      <MessageRow $isUser={isUser}>
        <Avatar $isUser={isUser}>
          {isUser ? '👤' : '🤖'}
        </Avatar>
        <BubbleWrapper $isUser={isUser}>
          <Bubble $isUser={isUser}>
            {isLoading ? (
              <LoadingDots>
                <span></span>
                <span></span>
                <span></span>
              </LoadingDots>
            ) : (
              message.content
            )}
          </Bubble>
          {!isLoading && (
            <Timestamp>
              {formatTime(message.timestamp)}
              {message.deviceId && ` • ${message.deviceId}`}
            </Timestamp>
          )}
        </BubbleWrapper>
      </MessageRow>
    </MessageContainer>
  );
};

export default MessageBubble;