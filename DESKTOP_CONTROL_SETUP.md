# 🚀 Desktop Control - Quick Setup

Get desktop control working in 5 minutes!

## ✅ What's Been Added

1. **Desktop Agent** (`packages/desktop/src/electron/agent.ts`)
   - Executes commands on your computer
   - Supports: Steam, CS2, Spotify, Faceit, Cursor, Chrome, Discord
   - Cross-platform (Windows, macOS, Linux)

2. **Agent Service** (`packages/desktop/src/electron/agent-service.ts`)
   - Polls backend for commands every 3 seconds
   - Executes commands and reports results
   - Handles authentication

3. **Backend API** (`packages/backend/src/routes/desktop-agent.ts`)
   - `/api/desktop-agent/command` - Mobile sends commands
   - `/api/desktop-agent/poll` - Desktop polls for commands
   - `/api/desktop-agent/result` - Desktop reports results

4. **Mobile Service** (`packages/mobile/src/services/desktop-control.ts`)
   - Send commands to desktop
   - Natural language parsing
   - Command history

5. **Mobile Screen** (`packages/mobile/src/screens/main/DesktopControlScreen.tsx`)
   - Quick action buttons
   - Custom command input
   - Real-time status

## 🎯 How to Use

### Step 1: Start Backend

```bash
cd packages/backend
npm run dev
```

Backend will run on `http://localhost:3000`

### Step 2: Start Desktop App

```bash
cd packages/desktop
npm run dev
```

Desktop app will:
- Connect to backend
- Start polling for commands
- Execute commands when received

### Step 3: Use Mobile App

```bash
cd packages/mobile
npm start
# or
npx expo start
```

Navigate to **Desktop Control** screen and send commands!

## 🧪 Test It

### Test 1: Open Steam

**From Mobile:**
1. Open Desktop Control screen
2. Tap "🎮 Open Steam"
3. Steam should open on your desktop!

### Test 2: Launch CS2

**From Mobile:**
1. Tap "🔫 Launch CS2"
2. Steam opens and launches CS2!

### Test 3: Custom Command

**From Mobile:**
1. Type: "open spotify"
2. Tap "Send Command"
3. Spotify opens on desktop!

## 🔧 Integration with Chat

The desktop agent can also be triggered from chat! Update the AI agent to recognize commands:

```typescript
// In packages/backend/src/ai/agent.ts
// When user says "open steam" in chat, trigger desktop command
if (message.includes('open steam')) {
  // Queue command for desktop
  await queueDesktopCommand(userId, {
    type: 'open_app',
    target: 'steam'
  });
}
```

## 📱 Add to Mobile Navigation

Add Desktop Control to your mobile app navigation:

```typescript
// In packages/mobile/src/navigation/AppNavigator.tsx
import { DesktopControlScreen } from '../screens/main/DesktopControlScreen';

// Add to stack navigator
<Stack.Screen 
  name="DesktopControl" 
  component={DesktopControlScreen}
  options={{ title: 'Desktop Control' }}
/>
```

## 🎮 Gaming Workflow Example

**Scenario:** You're on the couch, want to play CS2

**From Mobile:**
```
1. Open BIL mobile app
2. Go to Desktop Control
3. Tap "Launch CS2"
4. Desktop opens Steam → Launches CS2
5. Grab controller and play!
```

**With Voice:**
```
1. Say: "Hey BIL, launch CS2"
2. BIL sends command to desktop
3. CS2 launches
4. Play!
```

## 🔒 Security Notes

- All commands require authentication
- Desktop and mobile must be logged in with same account
- Commands are encrypted in transit
- No passwords stored on server
- Desktop agent validates all commands

## 🐛 Troubleshooting

### Desktop not receiving commands?

1. Check desktop app is running
2. Check backend is running
3. Check both logged in with same account
4. Check console for errors

### Application not opening?

1. Verify application is installed
2. Check application name matches your system
3. Try custom command with full path

### SSH not working?

1. Install `sshpass` for password auth
2. Use SSH keys instead
3. Check server is accessible

## 🚀 Next Steps

1. **Test basic commands** - Open Steam, Spotify, etc.
2. **Try custom commands** - SSH, scripts, etc.
3. **Integrate with chat** - "Hey BIL, open Steam"
4. **Add voice control** - Voice commands from mobile
5. **Deploy to Railway** - Control from anywhere!

## 📝 Example Commands

```typescript
// Open applications
"open steam"
"launch cs2"
"open spotify"
"open cursor"

// SSH
"ssh to user@server.com"
"connect to my dev server"

// Custom
"run npm dev in ~/projects/myapp"
"git pull in ~/projects/myapp"
```

---

**Ready to control your desktop? Start the apps and try it out!** 🎉
