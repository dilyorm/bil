# 🖥️ Desktop App Setup & Testing Guide

## Quick Start (5 minutes)

### Step 1: Start Backend
```bash
# Terminal 1: Start backend server
cd packages/backend
npm install
npm run dev

# Backend will run on http://localhost:3000
```

### Step 2: Start Desktop App
```bash
# Terminal 2: Start desktop app
cd packages/desktop
npm install
npm run dev

# Desktop app will launch automatically
```

### Step 3: Test AI Chat
1. Register a new user in the desktop app
2. Login with your credentials
3. Start chatting with the AI!

## 📋 Detailed Setup

### Prerequisites
- Node.js 18+
- Backend running on port 3000
- Gemini API key in backend `.env`

### Backend Setup

#### 1. Configure Environment
```bash
cd packages/backend

# Make sure .env has your Gemini API key
cat .env | grep GEMINI_API_KEY

# If not set, add it:
echo "GEMINI_API_KEY=your-key-here" >> .env
```

#### 2. Install Dependencies
```bash
npm install
```

#### 3. Setup Database (First Time Only)
```bash
# Start local PostgreSQL and Redis with Docker
cd ../..
docker-compose -f docker-compose.dev.yml up -d

# Or use the quick setup script
chmod +x scripts/quick-setup.sh
./scripts/quick-setup.sh
```

#### 4. Run Migrations
```bash
cd packages/backend
npm run migrate:up
```

#### 5. Start Backend
```bash
npm run dev

# You should see:
# 🚀 BIL Core API server running on port 3000
# 📊 Environment: development
# 🔗 Health check: http://localhost:3000/health
```

### Desktop App Setup

#### 1. Install Dependencies
```bash
cd packages/desktop
npm install
```

#### 2. Configure API URL (if needed)
The desktop app should automatically connect to `http://localhost:3000`.

If you need to change it, create a `.env` file:
```bash
# packages/desktop/.env
VITE_API_URL=http://localhost:3000
```

#### 3. Start Desktop App
```bash
npm run dev

# This will:
# - Start Vite dev server
# - Launch Electron app
# - Open the desktop window
```

## 🧪 Testing the Desktop App

### Test 1: Health Check
```bash
# In a new terminal
curl http://localhost:3000/health

# Should return:
# {"status":"healthy","timestamp":"...","uptime":...}
```

### Test 2: Register User

**In the Desktop App:**
1. Click "Register" or "Sign Up"
2. Enter:
   - Email: `test@example.com`
   - Password: `TestPassword123!`
   - Name: `Test User`
3. Click "Register"

**Or via API:**
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!",
    "name": "Test User"
  }'
```

### Test 3: Login

**In the Desktop App:**
1. Enter your email and password
2. Click "Login"
3. You should see the chat screen

**Or via API:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!"
  }'

# Save the accessToken from response
```

### Test 4: AI Chat

**In the Desktop App:**
1. Type a message: "Hello! Tell me about yourself."
2. Press Enter or click Send
3. Wait for AI response (should appear in 2-3 seconds)

**Or via API:**
```bash
# Replace YOUR_TOKEN with the token from login
curl -X POST http://localhost:3000/api/ai/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "message": "Hello! Tell me about yourself."
  }'
```

## 🎨 Desktop App Features

### Available Screens
1. **Login Screen** - User authentication
2. **Register Screen** - New user signup
3. **Chat Screen** - Main AI chat interface
4. **Settings Screen** - User preferences
5. **Floating Assistant** - Compact chat window

### Keyboard Shortcuts
- `Ctrl/Cmd + N` - New chat
- `Ctrl/Cmd + ,` - Settings
- `Ctrl/Cmd + Q` - Quit
- `Enter` - Send message
- `Shift + Enter` - New line

## 🔧 Development Commands

### Backend Commands
```bash
cd packages/backend

# Development mode (auto-reload)
npm run dev

# Build for production
npm run build

# Start production build
npm start

# Run tests
npm test

# Run migrations
npm run migrate:up
npm run migrate:down
npm run migrate:status
```

### Desktop Commands
```bash
cd packages/desktop

# Development mode
npm run dev

# Build for production
npm run build

# Package for distribution
npm run package

# Package for current platform
npm run make
```

## 🐛 Troubleshooting

### Issue: Backend won't start

**Check if port 3000 is in use:**
```bash
# Windows
netstat -ano | findstr :3000

# Mac/Linux
lsof -i :3000

# Kill the process if needed
# Windows: taskkill /PID <PID> /F
# Mac/Linux: kill -9 <PID>
```

**Check database connection:**
```bash
# Make sure Docker containers are running
docker ps

# Should see postgres and redis containers
# If not, start them:
docker-compose -f docker-compose.dev.yml up -d
```

### Issue: Desktop app won't connect to backend

**Check API URL:**
```bash
# In packages/desktop/.env
VITE_API_URL=http://localhost:3000
```

**Check CORS settings:**
```bash
# In packages/backend/.env
CORS_ORIGIN=http://localhost:3000,http://localhost:5173
```

**Restart both backend and desktop app**

### Issue: AI not responding

**Check Gemini API key:**
```bash
cd packages/backend
cat .env | grep GEMINI_API_KEY

# Test the key
cd ../..
GEMINI_API_KEY=your-key node tests/test-gemini.js
```

**Check backend logs:**
```bash
# Look for errors in the terminal running the backend
# Should see: "Initializing AI Agent with Gemini"
```

### Issue: Database errors

**Reset database:**
```bash
cd packages/backend

# Down migrations
npm run migrate:down

# Up migrations
npm run migrate:up

# Or recreate database
docker-compose -f ../../docker-compose.dev.yml down -v
docker-compose -f ../../docker-compose.dev.yml up -d
sleep 10
npm run migrate:up
```

## 📊 Monitoring & Debugging

### View Backend Logs
```bash
# Backend terminal shows all requests
# Look for:
# - POST /api/auth/register
# - POST /api/auth/login
# - POST /api/ai/chat
```

### View Desktop App Logs
```bash
# Open DevTools in the desktop app
# Windows/Linux: Ctrl + Shift + I
# Mac: Cmd + Option + I

# Check Console tab for errors
```

### Test API Endpoints Manually
```bash
# Health check
curl http://localhost:3000/health

# Database health
curl http://localhost:3000/health/db

# Redis health
curl http://localhost:3000/health/redis

# Register user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!","name":"Test"}'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!"}'
```

## 🎯 Testing Scenarios

### Scenario 1: Basic Chat Flow
1. Start backend
2. Start desktop app
3. Register new user
4. Login
5. Send message: "Hello!"
6. Verify AI responds
7. Send follow-up: "What can you help me with?"
8. Verify context is maintained

### Scenario 2: Multiple Conversations
1. Login to desktop app
2. Start conversation about coding
3. Start new conversation about cooking
4. Switch between conversations
5. Verify context is separate

### Scenario 3: Voice Input (if implemented)
1. Click microphone button
2. Speak your message
3. Verify transcription
4. Send to AI
5. Verify response

### Scenario 4: File Upload (if implemented)
1. Click file upload button
2. Select a file
3. Verify file is uploaded
4. Ask AI about the file
5. Verify AI can reference it

## 🚀 Quick Test Script

Create `test-desktop.sh`:
```bash
#!/bin/bash

echo "🧪 Testing BIL Desktop App"
echo "=========================="

# Test 1: Backend health
echo "1. Testing backend health..."
if curl -s http://localhost:3000/health | grep -q "healthy"; then
    echo "   ✓ Backend is healthy"
else
    echo "   ✗ Backend is not responding"
    exit 1
fi

# Test 2: Register user
echo "2. Testing user registration..."
REGISTER_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test'$(date +%s)'@example.com","password":"Test123!","name":"Test User"}')

if echo "$REGISTER_RESPONSE" | grep -q "user"; then
    echo "   ✓ User registration works"
else
    echo "   ✗ User registration failed"
    echo "   Response: $REGISTER_RESPONSE"
fi

# Test 3: Login
echo "3. Testing login..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!"}')

TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

if [ -n "$TOKEN" ]; then
    echo "   ✓ Login works"
else
    echo "   ✗ Login failed"
    exit 1
fi

# Test 4: AI Chat
echo "4. Testing AI chat..."
CHAT_RESPONSE=$(curl -s -X POST http://localhost:3000/api/ai/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"message":"Hello!"}')

if echo "$CHAT_RESPONSE" | grep -q "response"; then
    echo "   ✓ AI chat works"
else
    echo "   ✗ AI chat failed"
    echo "   Response: $CHAT_RESPONSE"
fi

echo ""
echo "✅ All tests passed!"
echo "You can now use the desktop app"
```

Run it:
```bash
chmod +x test-desktop.sh
./test-desktop.sh
```

## 📱 Alternative: Test with Mobile App

If you want to test with the mobile app instead:

```bash
# Terminal 1: Backend
cd packages/backend
npm run dev

# Terminal 2: Mobile app
cd packages/mobile
npm start

# Then:
# - Press 'a' for Android emulator
# - Press 'i' for iOS simulator
# - Scan QR code for physical device
```

## 🎓 Next Steps

After testing locally:
1. Deploy backend to Railway (see QUICKSTART_MVP.md)
2. Update desktop app API URL to Railway URL
3. Build desktop app for distribution
4. Share with users

## 📚 Related Documentation

- **QUICKSTART_MVP.md** - Deploy backend to Railway
- **TESTING_GUIDE.md** - Comprehensive testing
- **QUICK_REFERENCE.md** - Command reference
- **packages/desktop/README.md** - Desktop app details

---

**Ready to test? Start with the Quick Start section at the top!** 🚀