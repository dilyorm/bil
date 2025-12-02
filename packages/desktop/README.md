# BIL Desktop Application

A cross-platform desktop application for the BIL (Biological Intelligence Layer) Core System, built with Electron and React.

## Features

### Desktop-Specific Features
- **System Tray Integration**: Minimize to system tray with context menu
- **Global Keyboard Shortcuts**: 
  - `Ctrl+Shift+B` (or `Cmd+Shift+B` on Mac): Show/hide main window
  - `Ctrl+Shift+F`: Toggle floating assistant window
  - `Ctrl+Shift+V`: Quick voice input
- **Floating Assistant Window**: Compact always-on-top window for quick access
- **File System Access**: Upload and discuss files and folders
- **Auto-updater**: Automatic application updates
- **Cross-platform**: Windows, macOS, and Linux support

### Core Functionality
- **Real-time Chat**: Text-based conversation with AI assistant
- **Voice Input/Output**: Speech-to-text and text-to-speech capabilities
- **Device Synchronization**: Real-time sync across all connected devices
- **Authentication**: Secure login and device registration
- **Settings Management**: Customizable preferences and configurations

## Architecture

### Main Process (Electron)
- **main.ts**: Main Electron process with window management, system tray, and global shortcuts
- **preload.ts**: Secure bridge between main and renderer processes

### Renderer Process (React)
- **App.tsx**: Main React application with routing
- **Contexts**: Authentication and chat state management
- **Services**: API client, WebSocket sync, and audio processing
- **Components**: Reusable UI components
- **Screens**: Main application screens (Chat, Settings, Floating Assistant)

## Development

### Prerequisites
- Node.js 18+
- npm or yarn

### Setup
```bash
cd packages/desktop
npm install --legacy-peer-deps
```

### Development Mode
```bash
npm run dev
```

### Building
```bash
# Build React frontend
npm run build:react

# Build Electron main process
npm run build:electron

# Build both
npm run build
```

### Packaging
```bash
# Package for current platform
npm run package

# Package for specific platforms
npm run package:win
npm run package:mac
npm run package:linux
```

## Configuration

### Environment Variables
Create a `.env` file based on `.env.example`:

```env
REACT_APP_API_URL=http://localhost:3001/api
REACT_APP_SOCKET_URL=http://localhost:3001
```

### Build Configuration
The application uses `electron-builder` for packaging. Configuration is in `package.json` under the `build` section.

### Code Signing
For production builds, configure code signing certificates:
- **Windows**: Set `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD` environment variables
- **macOS**: Set `APPLE_TEAM_ID` and configure certificates in Keychain

## Features Implementation

### System Tray
- Persistent background operation
- Context menu with quick actions
- Double-click to show main window

### Global Shortcuts
- System-wide keyboard shortcuts
- Configurable in settings
- Works even when app is in background

### Floating Window
- Always-on-top compact interface
- Quick actions for common tasks
- Draggable with close button

### File System Integration
- File and folder selection dialogs
- Document upload and discussion
- Secure file access permissions

### Voice Processing
- Web Audio API for recording
- Integration with backend STT/TTS services
- Fallback to Web Speech API

### Real-time Sync
- WebSocket connection to sync service
- Cross-device message synchronization
- Device status and presence indicators
- Typing indicators

### Auto-updater
- Automatic update checking
- Background download
- User notification and restart prompt

## Security

### Electron Security
- Context isolation enabled
- Node integration disabled in renderer
- Secure preload script for IPC
- Content Security Policy

### API Security
- JWT token authentication
- Automatic token refresh
- Secure token storage
- HTTPS enforcement in production

## Troubleshooting

### Common Issues

1. **Microphone Access**: Ensure microphone permissions are granted
2. **Build Errors**: Try `npm install --legacy-peer-deps` if dependency conflicts occur
3. **Auto-updater**: Requires code signing for production updates
4. **Global Shortcuts**: May conflict with other applications

### Logs
- Main process logs: Available in developer console
- Renderer logs: Available in DevTools (F12)
- Build logs: Check npm output during build process

## Contributing

1. Follow the existing code structure
2. Use TypeScript for type safety
3. Follow React best practices
4. Test on multiple platforms before submitting
5. Update documentation for new features