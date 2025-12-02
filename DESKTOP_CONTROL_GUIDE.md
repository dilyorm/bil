# 🖥️ Desktop Control from Mobile - Complete Guide

Control your desktop computer remotely from your mobile phone using BIL!

## 🎯 What You Can Do

- **Open Applications**: Steam, CS2, Spotify, Faceit, Cursor, Chrome, Discord
- **Run Commands**: Execute any shell command on your desktop
- **SSH Connections**: Connect to servers from your desktop
- **Custom Scripts**: Run custom automation scripts
- **Gaming Setup**: "Open Steam and launch CS2 for gaming"

## 🚀 Quick Setup

### 1. Start Desktop Agent

The desktop app automatically starts the agent when you're logged in. It runs in the background and polls for commands from your mobile.

```bash
# Desktop app must be running
cd packages/desktop
npm run dev
```

### 2. Connect Mobile App

Open the mobile app and navigate to **Desktop Control** screen. Your desktop will appear if it's online.

### 3. Send Commands

Use quick actions or type natural language commands:
- "Open Steam"
- "Launch CS2"
- "Open Spotify and play music"
- "SSH to user@myserver.com"

## 📱 Mobile App Usage

### Quick Actions

Tap any quick action button:
- 🎮 Open Steam
- 🔫 Launch CS2
- 🎵 Open Spotify
- 🎯 Open Faceit
- 💻 Open Cursor
- 🌐 Open Chrome

### Custom Commands

Type natural language commands:

```
"Open Steam"
"Launch CS2"
"Open Spotify"
"Open Cursor and connect to my server"
"SSH to user@192.168.1.100"
```

## 🖥️ Desktop Agent Features

### Supported Applications

**Windows:**
- Steam: `start steam://open/main`
- CS2: `start steam://rungameid/730`
- Spotify: `start spotify:`
- Cursor: `start cursor`
- Chrome: `start chrome`
- Discord: `start discord`

**macOS:**
- Steam: `open -a Steam`
- CS2: `open steam://rungameid/730`
- Spotify: `open -a Spotify`
- Cursor: `open -a Cursor`
- Chrome: `open -a "Google Chrome"`
- Discord: `open -a Discord`

**Linux:**
- Steam: `steam`
- CS2: `steam steam://rungameid/730`
- Spotify: `spotify`
- Cursor: `cursor`
- Chrome: `google-chrome`
- Discord: `discord`

### Custom Commands

Run any shell command:

```typescript
// From mobile
desktopControl.runCommand(deviceId, 'npm', ['run', 'dev']);
desktopControl.runCommand(deviceId, 'git', ['pull', 'origin', 'main']);
```

### SSH Connections

Connect to servers:

```typescript
// From mobile
desktopControl.sshConnect(deviceId, 'user@server.com', 'password');
```

## 🔧 Advanced Usage

### Custom Scripts

Create custom scripts on your desktop:

```bash
# ~/scripts/gaming-setup.sh
#!/bin/bash
echo "Setting up gaming environment..."
open -a Steam
sleep 2
open steam://rungameid/730
open -a Discord
open -a Spotify
```

Then run from mobile:

```typescript
desktopControl.runCommand(deviceId, '~/scripts/gaming-setup.sh');
```

### Complex Workflows

Chain multiple commands:

```typescript
// Open Cursor and connect to server
await desktopControl.openApp(deviceId, 'cursor');
await new Promise(resolve => setTimeout(resolve, 2000));
await desktopControl.sshConnect(deviceId, 'user@myserver.com');
```

## 🔒 Security

### Authentication

All commands require authentication:
- Mobile app must be logged in
- Desktop app must be logged in with same account
- Commands are user-specific

### Command Validation

The desktop agent validates all commands before execution:
- Checks for malicious patterns
- Sandboxed execution
- User confirmation for sensitive operations (optional)

### Encryption

All communication is encrypted:
- HTTPS for API calls
- JWT tokens for authentication
- No passwords stored on server

## 🎮 Gaming Use Cases

### CS2 Setup

```
"Open Steam and launch CS2"
```

This will:
1. Open Steam
2. Wait for Steam to load
3. Launch CS2
4. Optionally open Discord/Spotify

### Faceit Setup

```
"Open Faceit and Steam"
```

### Full Gaming Environment

```
"Setup gaming: open Steam, CS2, Discord, and Spotify"
```

## 💻 Development Use Cases

### Open IDE and Connect to Server

```
"Open Cursor and SSH to dev@myserver.com"
```

### Run Development Server

```
"Run npm dev in ~/projects/myapp"
```

### Git Operations

```
"Git pull in ~/projects/myapp"
```

## 📊 How It Works

### Architecture

```
Mobile App → Backend API → Desktop Agent → Execute Command
     ↓           ↓              ↓              ↓
  Send Cmd → Queue Cmd → Poll Cmd → Run & Report
```

### Polling Mechanism

Desktop agent polls every 3 seconds:
1. Desktop polls: `GET /api/desktop-agent/poll`
2. Backend returns pending commands
3. Desktop executes commands
4. Desktop reports results: `POST /api/desktop-agent/result`

### Command Flow

```typescript
// 1. Mobile sends command
POST /api/desktop-agent/command
{
  "deviceId": "desktop-123",
  "action": "open_app",
  "target": "steam"
}

// 2. Desktop polls and receives
GET /api/desktop-agent/poll
Response: { commands: [...] }

// 3. Desktop executes
desktopAgent.executeAction(action)

// 4. Desktop reports result
POST /api/desktop-agent/result
{
  "commandId": "cmd_123",
  "success": true,
  "output": "Opened Steam"
}
```

## 🧪 Testing

### Test Desktop Agent Locally

```typescript
// In desktop app console
import { desktopAgent } from './electron/agent';

// Test opening Steam
const result = await desktopAgent.executeAction({
  type: 'open_app',
  target: 'steam'
});
console.log(result);
```

### Test from Mobile

1. Open mobile app
2. Go to Desktop Control
3. Tap "Open Steam"
4. Check desktop for Steam opening

### Test Natural Language

```typescript
// In mobile app
desktopControl.sendNaturalCommand(deviceId, 'open steam and launch cs2');
```

## 🐛 Troubleshooting

### Desktop Not Appearing in Mobile

- Ensure desktop app is running
- Check both devices are logged in with same account
- Verify network connectivity
- Check backend logs for errors

### Commands Not Executing

- Check desktop agent logs in console
- Verify application paths are correct
- Ensure permissions for command execution
- Check if application is installed

### SSH Not Working

- Install `sshpass` for password authentication
- Use SSH keys for better security
- Verify SSH server is accessible
- Check firewall settings

## 🎯 Next Steps

1. **Add Voice Commands**: "Hey BIL, open Steam"
2. **Add Confirmations**: Require confirmation for sensitive commands
3. **Add Scheduling**: "Open CS2 at 8 PM"
4. **Add Macros**: Save complex command sequences
5. **Add Monitoring**: See what's running on desktop

## 📝 Example Scenarios

### Scenario 1: Gaming from Couch

You're on the couch, want to game:
1. Open mobile app
2. Tap "Launch CS2"
3. Desktop opens Steam and CS2
4. Grab controller and play!

### Scenario 2: Remote Development

You're away, need to check server:
1. Type: "Open Cursor and SSH to dev@myserver.com"
2. Desktop opens Cursor
3. Desktop connects to server
4. You can now work remotely

### Scenario 3: Morning Routine

Wake up, start your day:
1. Type: "Setup work: open Cursor, Chrome, and Spotify"
2. Desktop opens all apps
3. Ready to work!

## 🚀 Deploy to Production

When deploying to Railway:

1. Desktop agent will use production API URL
2. Update desktop `.env`:
   ```
   VITE_API_URL=https://your-app.railway.app
   ```
3. Mobile app will automatically use production API
4. Commands work from anywhere with internet!

---

**Ready to control your desktop from your phone? Start the desktop app and try it out!** 🎉
