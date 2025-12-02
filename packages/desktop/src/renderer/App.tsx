import React, { useState } from 'react';

// Simple inline styles to avoid styled-components complexity for now
const styles = {
  app: {
    display: 'flex',
    height: '100vh',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif',
    backgroundColor: '#f5f5f5',
  },
  sidebar: {
    width: '240px',
    backgroundColor: '#2c3e50',
    color: 'white',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  logo: {
    fontSize: '20px',
    fontWeight: 'bold',
    marginBottom: '30px',
    color: '#3498db',
  },
  navItem: {
    padding: '12px 16px',
    marginBottom: '8px',
    borderRadius: '6px',
    cursor: 'pointer',
    backgroundColor: 'transparent',
    transition: 'background-color 0.2s',
  },
  navItemActive: {
    backgroundColor: '#34495e',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    backgroundColor: 'white',
  },
  header: {
    padding: '20px',
    borderBottom: '1px solid #e0e0e0',
    backgroundColor: 'white',
  },
  title: {
    fontSize: '24px',
    fontWeight: '600',
    color: '#2c3e50',
    margin: 0,
  },
  chatContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    padding: '20px',
  },
  messagesArea: {
    flex: 1,
    overflowY: 'auto' as const,
    marginBottom: '20px',
    padding: '20px',
    backgroundColor: '#f8f9fa',
    borderRadius: '8px',
    minHeight: '300px',
  },
  message: {
    marginBottom: '16px',
    padding: '12px 16px',
    borderRadius: '8px',
    maxWidth: '80%',
  },
  userMessage: {
    backgroundColor: '#3498db',
    color: 'white',
    marginLeft: 'auto',
    textAlign: 'right' as const,
  },
  assistantMessage: {
    backgroundColor: '#ecf0f1',
    color: '#2c3e50',
    marginRight: 'auto',
  },
  inputContainer: {
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-end',
  },
  textInput: {
    flex: 1,
    padding: '12px 16px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    fontSize: '16px',
    resize: 'none' as const,
    minHeight: '44px',
    maxHeight: '120px',
    fontFamily: 'inherit',
  },
  sendButton: {
    padding: '12px 24px',
    backgroundColor: '#3498db',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    cursor: 'pointer',
    fontWeight: '500',
  },
  sendButtonDisabled: {
    backgroundColor: '#bdc3c7',
    cursor: 'not-allowed',
  },
  emptyState: {
    textAlign: 'center' as const,
    color: '#7f8c8d',
    fontSize: '18px',
    marginTop: '60px',
  },
  loadingMessage: {
    fontStyle: 'italic',
    color: '#7f8c8d',
  }
};

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

function App() {
  const [currentScreen, setCurrentScreen] = useState('chat');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    // Simulate AI response (replace with actual API call later)
    setTimeout(() => {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `I received your message: "${userMessage.content}". This is a mock response from the BIL Desktop Assistant. The full AI integration will be available once the backend is connected.`,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, aiMessage]);
      setIsLoading(false);
    }, 1000);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const renderChatScreen = () => (
    <>
      <header style={styles.header}>
        <h1 style={styles.title}>Chat with BIL Assistant</h1>
      </header>
      <div style={styles.chatContainer}>
        <div style={styles.messagesArea}>
          {messages.length === 0 ? (
            <div style={styles.emptyState}>
              <div style={{ fontSize: '48px', marginBottom: '20px' }}>🤖</div>
              <p>Welcome to BIL Assistant!</p>
              <p style={{ fontSize: '14px', marginTop: '10px' }}>
                Start a conversation by typing a message below.
              </p>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                style={{
                  ...styles.message,
                  ...(message.role === 'user' ? styles.userMessage : styles.assistantMessage),
                }}
              >
                {message.content}
              </div>
            ))
          )}
          {isLoading && (
            <div style={{ ...styles.message, ...styles.assistantMessage, ...styles.loadingMessage }}>
              Thinking...
            </div>
          )}
        </div>
        <div style={styles.inputContainer}>
          <textarea
            style={styles.textInput}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message here..."
            disabled={isLoading}
            rows={1}
          />
          <button
            style={{
              ...styles.sendButton,
              ...((!inputValue.trim() || isLoading) ? styles.sendButtonDisabled : {}),
            }}
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isLoading}
          >
            Send
          </button>
        </div>
      </div>
    </>
  );

  const renderSettingsScreen = () => (
    <>
      <header style={styles.header}>
        <h1 style={styles.title}>Settings</h1>
      </header>
      <div style={styles.chatContainer}>
        <div style={{ padding: '20px' }}>
          <h3 style={{ marginBottom: '20px', color: '#2c3e50' }}>Application Settings</h3>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
              Theme
            </label>
            <select style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}>
              <option>Light</option>
              <option>Dark</option>
              <option>System</option>
            </select>
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="checkbox" />
              Enable notifications
            </label>
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="checkbox" />
              Start with system
            </label>
          </div>
          <div style={{ marginTop: '30px', padding: '16px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
            <h4 style={{ marginBottom: '10px' }}>About</h4>
            <p>BIL Desktop Assistant v1.0.0</p>
            <p>Electron API: {window.electronAPI ? 'Available' : 'Not Available'}</p>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div style={styles.app}>
      <div style={styles.sidebar}>
        <div style={styles.logo}>🤖 BIL Assistant</div>
        <div
          style={{
            ...styles.navItem,
            ...(currentScreen === 'chat' ? styles.navItemActive : {}),
          }}
          onClick={() => setCurrentScreen('chat')}
        >
          💬 Chat
        </div>
        <div
          style={{
            ...styles.navItem,
            ...(currentScreen === 'settings' ? styles.navItemActive : {}),
          }}
          onClick={() => setCurrentScreen('settings')}
        >
          ⚙️ Settings
        </div>
        <div style={{ marginTop: 'auto', fontSize: '12px', color: '#95a5a6' }}>
          Status: {window.electronAPI ? '🟢 Connected' : '🔴 Disconnected'}
        </div>
      </div>
      <main style={styles.main}>
        {currentScreen === 'chat' ? renderChatScreen() : renderSettingsScreen()}
      </main>
    </div>
  );
}

export default App;
