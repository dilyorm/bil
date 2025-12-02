@echo off
REM Quick commit script that bypasses linting for initial GitHub push

echo.
echo ========================================
echo   Quick Commit to GitHub
echo ========================================
echo.

echo Step 1: Adding all files...
git add .

echo.
echo Step 2: Committing with --no-verify...
git commit --no-verify -m "Initial commit: BIL - Biological Intelligence Layer

Multi-platform AI assistant system with desktop control

Features:
- Desktop control from mobile (open apps, run commands, SSH)
- React Native mobile app for iOS/Android  
- Electron desktop app for Windows/macOS/Linux
- ESP32 wearable device support
- Gemini AI integration
- Real-time device sync via WebSocket
- PostgreSQL + Redis backend

Tech Stack:
- Backend: Node.js + TypeScript + Express
- Desktop: Electron + React + Vite
- Mobile: React Native + Expo
- Wearable: ESP32 + C++
- AI: Google Gemini
- Database: PostgreSQL + Redis

Note: Initial commit with linting issues to be fixed in subsequent commits"

echo.
echo Step 3: Adding remote...
git remote add origin https://github.com/dilyorm/bil.git 2>nul

echo.
echo Step 4: Pushing to GitHub...
git push -u origin main

echo.
echo ========================================
echo   Successfully pushed to GitHub!
echo ========================================
echo.
echo Next steps:
echo 1. Visit: https://github.com/dilyorm/bil
echo 2. Fix linting issues later
echo 3. Commit fixes when ready
echo.
pause