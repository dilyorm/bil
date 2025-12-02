import React from 'react';

console.log('App.test.tsx loaded');

function App() {
  console.log('App component rendering');
  
  React.useEffect(() => {
    console.log('App component mounted');
    document.body.style.backgroundColor = '#f0f0f0';
  }, []);
  
  return (
    <div style={{ 
      padding: '20px', 
      fontFamily: 'Arial, sans-serif',
      backgroundColor: '#f0f0f0',
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      color: '#333'
    }}>
      <h1 style={{ color: '#007AFF', marginBottom: '20px' }}>🚀 BIL Desktop App - Test</h1>
      <p style={{ color: '#666', fontSize: '18px' }}>✅ React is working!</p>
      <div style={{ 
        marginTop: '20px', 
        padding: '15px', 
        backgroundColor: '#fff', 
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        minWidth: '300px'
      }}>
        <p><strong>Electron API:</strong> {window.electronAPI ? '✅ Available' : '❌ Not Available'}</p>
        <p><strong>Location:</strong> {window.location.href}</p>
        <p><strong>Hash:</strong> {window.location.hash || 'None'}</p>
        <p><strong>User Agent:</strong> {navigator.userAgent.includes('Electron') ? '✅ Electron' : '❌ Browser'}</p>
      </div>
    </div>
  );
}

export default App;