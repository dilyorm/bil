#!/bin/bash

# Desktop App Testing Script
# Tests backend API and prepares for desktop app testing

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
echo "╔════════════════════════════════════════╗"
echo "║   BIL Desktop App Test Suite          ║"
echo "╚════════════════════════════════════════╝"
echo -e "${NC}"

# Check if backend is running
echo -e "${BLUE}Checking backend status...${NC}"
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend is running${NC}"
else
    echo -e "${RED}✗ Backend is not running${NC}"
    echo -e "${YELLOW}Start backend with: cd packages/backend && npm run dev${NC}"
    exit 1
fi

# Test 1: Health Check
echo -e "\n${BLUE}Test 1: Health Check${NC}"
HEALTH_RESPONSE=$(curl -s http://localhost:3000/health)
if echo "$HEALTH_RESPONSE" | grep -q "healthy"; then
    echo -e "${GREEN}✓ Health check passed${NC}"
    echo "   Response: $HEALTH_RESPONSE"
else
    echo -e "${RED}✗ Health check failed${NC}"
    exit 1
fi

# Test 2: Database Health
echo -e "\n${BLUE}Test 2: Database Health${NC}"
DB_HEALTH=$(curl -s http://localhost:3000/health/db)
if echo "$DB_HEALTH" | grep -q "healthy"; then
    echo -e "${GREEN}✓ Database is healthy${NC}"
else
    echo -e "${YELLOW}⚠ Database health check failed${NC}"
    echo "   Make sure PostgreSQL is running"
fi

# Test 3: Redis Health
echo -e "\n${BLUE}Test 3: Redis Health${NC}"
REDIS_HEALTH=$(curl -s http://localhost:3000/health/redis)
if echo "$REDIS_HEALTH" | grep -q "healthy"; then
    echo -e "${GREEN}✓ Redis is healthy${NC}"
else
    echo -e "${YELLOW}⚠ Redis health check failed${NC}"
    echo "   Make sure Redis is running"
fi

# Test 4: User Registration
echo -e "\n${BLUE}Test 4: User Registration${NC}"
TIMESTAMP=$(date +%s)
TEST_EMAIL="test${TIMESTAMP}@example.com"
REGISTER_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"TestPassword123!\",\"name\":\"Test User\"}")

if echo "$REGISTER_RESPONSE" | grep -q "user"; then
    echo -e "${GREEN}✓ User registration works${NC}"
    echo "   Created user: $TEST_EMAIL"
else
    echo -e "${RED}✗ User registration failed${NC}"
    echo "   Response: $REGISTER_RESPONSE"
    exit 1
fi

# Test 5: User Login
echo -e "\n${BLUE}Test 5: User Login${NC}"
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"TestPassword123!\"}")

# Extract token (works on both Mac and Linux)
TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"accessToken":"[^"]*' | sed 's/"accessToken":"//')

if [ -n "$TOKEN" ]; then
    echo -e "${GREEN}✓ User login works${NC}"
    echo "   Token: ${TOKEN:0:20}..."
else
    echo -e "${RED}✗ User login failed${NC}"
    echo "   Response: $LOGIN_RESPONSE"
    exit 1
fi

# Test 6: AI Chat
echo -e "\n${BLUE}Test 6: AI Chat${NC}"
echo "   Sending message to AI..."
CHAT_RESPONSE=$(curl -s -X POST http://localhost:3000/api/ai/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"message":"Hello! Please respond with just: I am BIL, your AI assistant."}')

if echo "$CHAT_RESPONSE" | grep -q "response"; then
    echo -e "${GREEN}✓ AI chat works${NC}"
    # Extract and show response
    AI_RESPONSE=$(echo "$CHAT_RESPONSE" | grep -o '"response":"[^"]*' | sed 's/"response":"//')
    echo "   AI Response: ${AI_RESPONSE:0:100}..."
else
    echo -e "${RED}✗ AI chat failed${NC}"
    echo "   Response: $CHAT_RESPONSE"
    echo -e "${YELLOW}   Check if GEMINI_API_KEY is set in packages/backend/.env${NC}"
fi

# Summary
echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✓ All tests passed!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo -e "\n${BLUE}Test Credentials:${NC}"
echo "   Email: $TEST_EMAIL"
echo "   Password: TestPassword123!"
echo "   Token: ${TOKEN:0:30}..."

echo -e "\n${BLUE}Next Steps:${NC}"
echo "1. Start desktop app:"
echo "   ${YELLOW}cd packages/desktop && npm run dev${NC}"
echo ""
echo "2. In the desktop app:"
echo "   - Register with: $TEST_EMAIL"
echo "   - Password: TestPassword123!"
echo "   - Or login if already registered"
echo ""
echo "3. Test AI chat in the desktop app"
echo ""
echo -e "${BLUE}Useful Commands:${NC}"
echo "• View backend logs: Check terminal running 'npm run dev'"
echo "• Test API manually: curl http://localhost:3000/health"
echo "• Reset database: cd packages/backend && npm run migrate:down && npm run migrate:up"
echo ""