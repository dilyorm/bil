import React, { useState } from 'react';
import styled from 'styled-components';
import { useChat } from '../contexts/ChatContext';

const FloatingContainer = styled.div`
  width: 100%;
  height: 100%;
  background-color: ${props => props.theme.colors.surface};
  border-radius: ${props => props.theme.borderRadius.lg};
  box-shadow: ${props => props.theme.shadows.xl};
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const Header = styled.div`
  padding: ${props => props.theme.spacing.md};
  background-color: ${props => props.theme.colors.primary};
  color: white;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: move;
  -webkit-app-region: drag;
`;

const Title = styled.h3`
  font-size: ${props => props.theme.fontSize.md};
  font-weight: ${props => props.theme.fontWeight.semibold};
  margin: 0;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  color: white;
  font-size: ${props => props.theme.fontSize.lg};
  cursor: pointer;
  padding: ${props => props.theme.spacing.xs};
  border-radius: ${props => props.theme.borderRadius.sm};
  -webkit-app-region: no-drag;

  &:hover {
    background-color: rgba(255, 255, 255, 0.2);
  }
`;

const Content = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: ${props => props.theme.spacing.md};
`;

const QuickActions = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${props => props.theme.spacing.sm};
  margin-bottom: ${props => props.theme.spacing.md};
`;

const ActionButton = styled.button`
  padding: ${props => props.theme.spacing.sm};
  background-color: ${props => props.theme.colors.backgroundSecondary};
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: ${props => props.theme.borderRadius.md};
  font-size: ${props => props.theme.fontSize.sm};
  cursor: pointer;
  transition: ${props => props.theme.transitions.fast};

  &:hover {
    background-color: ${props => props.theme.colors.surfaceHover};
  }
`;

const QuickInput = styled.input`
  width: 100%;
  padding: ${props => props.theme.spacing.sm};
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: ${props => props.theme.borderRadius.md};
  font-size: ${props => props.theme.fontSize.sm};
  margin-bottom: ${props => props.theme.spacing.sm};

  &:focus {
    outline: none;
    border-color: ${props => props.theme.colors.primary};
  }
`;

const SendButton = styled.button`
  width: 100%;
  padding: ${props => props.theme.spacing.sm};
  background-color: ${props => props.theme.colors.primary};
  color: white;
  border: none;
  border-radius: ${props => props.theme.borderRadius.md};
  font-size: ${props => props.theme.fontSize.sm};
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

const StatusIndicator = styled.div<{ $connected: boolean }>`
  display: flex;
  align-items: center;
  gap: ${props => props.theme.spacing.xs};
  font-size: ${props => props.theme.fontSize.xs};
  color: ${props => props.theme.colors.textSecondary};
  margin-top: auto;
`;

const StatusDot = styled.div<{ $connected: boolean }>`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: ${props => props.$connected ? props.theme.colors.success : props.theme.colors.error};
`;

const FloatingAssistant: React.FC = () => {
  const { sendMessage, isLoading, isConnected } = useChat();
  const [inputValue, setInputValue] = useState('');

  const handleClose = () => {
    if (window.electronAPI) {
      window.electronAPI.hideFloatingWindow();
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;
    
    const message = inputValue.trim();
    setInputValue('');
    await sendMessage(message);
  };

  const handleQuickAction = async (action: string) => {
    switch (action) {
      case 'time':
        await sendMessage('What time is it?');
        break;
      case 'weather':
        await sendMessage('What\'s the weather like?');
        break;
      case 'calendar':
        await sendMessage('What\'s on my calendar today?');
        break;
      case 'help':
        await sendMessage('How can you help me?');
        break;
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  return (
    <FloatingContainer>
      <Header>
        <Title>BIL Assistant</Title>
        <CloseButton onClick={handleClose}>×</CloseButton>
      </Header>

      <Content>
        <QuickActions>
          <ActionButton onClick={() => handleQuickAction('time')}>
            🕐 Time
          </ActionButton>
          <ActionButton onClick={() => handleQuickAction('weather')}>
            🌤️ Weather
          </ActionButton>
          <ActionButton onClick={() => handleQuickAction('calendar')}>
            📅 Calendar
          </ActionButton>
          <ActionButton onClick={() => handleQuickAction('help')}>
            ❓ Help
          </ActionButton>
        </QuickActions>

        <QuickInput
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Ask me anything..."
          disabled={isLoading}
        />

        <SendButton
          onClick={handleSend}
          disabled={!inputValue.trim() || isLoading}
        >
          {isLoading ? 'Sending...' : 'Send'}
        </SendButton>

        <StatusIndicator $connected={isConnected}>
          <StatusDot $connected={isConnected} />
          {isConnected ? 'Connected' : 'Disconnected'}
        </StatusIndicator>
      </Content>
    </FloatingContainer>
  );
};

export default FloatingAssistant;