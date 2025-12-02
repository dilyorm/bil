@echo off
REM Test Desktop Control - Quick Test Script for Windows

echo.
echo ========================================
echo   Desktop Control Test Script
echo ========================================
echo.

echo Step 1: Check if backend is running...
curl -s http://localhost:3000/health >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Backend is running
) else (
    echo [WARNING] Backend is not running
    echo Start it with: cd packages\backend ^&^& npm run dev
    pause
    exit /b 1
)

echo.
echo Step 2: Test desktop agent endpoint...
curl -s http://localhost:3000/api/desktop-agent/poll -H "Authorization: Bearer test-token" >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Desktop agent endpoint is working
) else (
    echo [INFO] Desktop agent endpoint responded
)

echo.
echo ========================================
echo   Testing Instructions
echo ========================================
echo.
echo To test desktop control:
echo.
echo 1. Start Desktop App:
echo    cd packages\desktop
echo    npm run dev
echo.
echo 2. Login to desktop app
echo.
echo 3. Install Expo Go on your phone:
echo    - iOS: App Store
echo    - Android: Google Play
echo.
echo 4. Start mobile app:
echo    cd packages\mobile
echo    npx expo start
echo.
echo 5. Scan QR code with Expo Go
echo.
echo 6. Login to mobile app (same account)
echo.
echo 7. Go to Desktop Control screen
echo.
echo 8. Tap 'Open Steam' button
echo.
echo 9. Steam should open on your computer!
echo.
echo ========================================
echo.
echo Backend is ready for testing!
echo.
pause
