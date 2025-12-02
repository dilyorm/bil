import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // App info
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  // Window management
  showFloatingWindow: () => ipcRenderer.invoke('show-floating-window'),
  hideFloatingWindow: () => ipcRenderer.invoke('hide-floating-window'),

  // File system access
  selectFiles: () => ipcRenderer.invoke('select-files'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),

  // Intent execution
  executeIntent: (intent: { type: string; payload?: any }) =>
    ipcRenderer.invoke('execute-intent', intent),

  // Desktop Agent
  startDesktopAgent: (authToken: string) =>
    ipcRenderer.invoke('start-desktop-agent', authToken),
  stopDesktopAgent: () =>
    ipcRenderer.invoke('stop-desktop-agent'),
  executeAgentCommand: (command: any) =>
    ipcRenderer.invoke('execute-agent-command', command),

  // Event listeners
  onNavigateTo: (callback: (route: string) => void) => {
    ipcRenderer.on('navigate-to', (_, route) => callback(route));
  },

  onTriggerVoiceInput: (callback: () => void) => {
    ipcRenderer.on('trigger-voice-input', callback);
  },

  // Remove listeners
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  }
});

// Type definitions for the exposed API
declare global {
  interface Window {
    electronAPI: {
      getAppVersion: () => Promise<string>;
      showFloatingWindow: () => Promise<void>;
      hideFloatingWindow: () => Promise<void>;
      selectFiles: () => Promise<string[]>;
      selectFolder: () => Promise<string>;
      executeIntent: (intent: { type: string; payload?: any }) => Promise<{ success: boolean; error?: string }>;
      startDesktopAgent: (authToken: string) => Promise<void>;
      stopDesktopAgent: () => Promise<void>;
      executeAgentCommand: (command: any) => Promise<any>;
      onNavigateTo: (callback: (route: string) => void) => void;
      onTriggerVoiceInput: (callback: () => void) => void;
      removeAllListeners: (channel: string) => void;
    };
  }
}
