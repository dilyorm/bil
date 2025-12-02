#!/bin/bash

# Test Desktop Control - Quick Test Script
# This script helps you test the desktop control feature

echo "🧪 Desktop Control Test Script"
echo "================================"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}Step 1: Check if backend is running${NC}"
if curl -s http://localhost:3000/health > /dev/null; then
    echo -e "${GREEN}✅ Backend is running${NC}"
else
    echo -e "${YELLOW}⚠️  Backend is not running${NC}"
    echo "Start it with: cd packages/backend && npm run dev"
    exit 1
fi

echo ""
echo -e "${BLUE}Step 2: Test desktop agent endpoint${NC}"
RESPONSE=$(curl -s http://localhost:3000/api/desktop-agent/poll \
    -H "Authorization: Bearer test-token" 2>&1)

if [[ $RESPONSE == *"commands"* ]] || [[ $RESPONSE == *"401"* ]]; then
    echo -e "${GREEN}✅ Desktop agent endpoint is working${NC}"
else
    echo -e "${YELLOW}⚠️  Desktop agent endpoint might have issues${NC}"
    echo "Response: $RESPONSE"
fi

echo ""
echo -e "${BLUE}Step 3: Instructions${NC}"
echo "================================"
echo ""
echo "To test desktop control:"
echo ""
echo "1. Start Desktop App:"
echo "   cd packages/desktop"
echo "   npm run dev"
echo ""
echo "2. Login to desktop app"
echo ""
echo "3. Install Expo Go on your phone:"
echo "   - iOS: App Store"
echo "   - Android: Google Play"
echo ""
echo "4. Start mobile app:"
echo "   cd packages/mobile"
echo "   npx expo start"
echo ""
echo "5. Scan QR code with Expo Go"
echo ""
echo "6. Login to mobile app (same account as desktop)"
echo ""
echo "7. Go to Desktop Control screen"
echo ""
echo "8. Tap 'Open Steam' button"
echo ""
echo "9. Steam should open on your computer! 🎉"
echo ""
echo "================================"
echo ""
echo -e "${GREEN}Backend is ready for testing!${NC}"
echo ""
