#!/bin/bash

# Development Environment Startup Script
# Starts backend and desktop app together

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
echo "╔════════════════════════════════════════╗"
echo "║   BIL Development Environment          ║"
echo "╚════════════════════════════════════════╝"
echo -e "${NC}"

# Check if Docker is running (for database)
echo -e "${BLUE}Checking Docker...${NC}"
if ! docker ps > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠ Docker is not running${NC}"
    echo "   Starting databases with Docker..."
    docker-compose -f docker-compose.dev.yml up -d
    echo "   Waiting for databases to be ready..."
    sleep 10
fi

# Check if databases are running
if docker ps | grep -q postgres; then
    echo -e "${GREEN}✓ PostgreSQL is running${NC}"
else
    echo -e "${YELLOW}⚠ Starting PostgreSQL...${NC}"
    docker-compose -f docker-compose.dev.yml up -d postgres
    sleep 5
fi

if docker ps | grep -q redis; then
    echo -e "${GREEN}✓ Redis is running${NC}"
else
    echo -e "${YELLOW}⚠ Starting Redis...${NC}"
    docker-compose -f docker-compose.dev.yml up -d redis
    sleep 5
fi

# Check if backend dependencies are installed
echo -e "\n${BLUE}Checking backend dependencies...${NC}"
if [ ! -d "packages/backend/node_modules" ]; then
    echo -e "${YELLOW}Installing backend dependencies...${NC}"
    cd packages/backend
    npm install
    cd ../..
fi

# Check if desktop dependencies are installed
echo -e "${BLUE}Checking desktop dependencies...${NC}"
if [ ! -d "packages/desktop/node_modules" ]; then
    echo -e "${YELLOW}Installing desktop dependencies...${NC}"
    cd packages/desktop
    npm install
    cd ../..
fi

# Check if .env exists
if [ ! -f "packages/backend/.env" ]; then
    echo -e "${YELLOW}⚠ .env file not found${NC}"
    echo "   Creating from template..."
    cp packages/backend/.env.example packages/backend/.env
    echo -e "${RED}⚠ IMPORTANT: Edit packages/backend/.env and add your GEMINI_API_KEY${NC}"
    echo "   Get your key from: https://makersuite.google.com/app/apikey"
    read -p "Press Enter to continue after adding your API key..."
fi

# Check if migrations have been run
echo -e "\n${BLUE}Checking database migrations...${NC}"
cd packages/backend
if npm run migrate:status 2>&1 | grep -q "No migrations"; then
    echo -e "${YELLOW}Running database migrations...${NC}"
    npm run migrate:up
fi
cd ../..

echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✓ Environment Ready!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo -e "\n${BLUE}Starting services...${NC}"
echo ""
echo -e "${YELLOW}This will open 2 terminal windows:${NC}"
echo "1. Backend API (http://localhost:3000)"
echo "2. Desktop App (Electron window)"
echo ""
echo -e "${YELLOW}To stop: Press Ctrl+C in each terminal${NC}"
echo ""
read -p "Press Enter to start..."

# Function to start backend
start_backend() {
    echo -e "${BLUE}Starting Backend...${NC}"
    cd packages/backend
    npm run dev
}

# Function to start desktop
start_desktop() {
    echo -e "${BLUE}Starting Desktop App...${NC}"
    sleep 5  # Wait for backend to start
    cd packages/desktop
    npm run dev
}

# Check OS and open terminals accordingly
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    osascript -e 'tell app "Terminal" to do script "cd '"$(pwd)"' && ./scripts/start-backend.sh"'
    sleep 2
    osascript -e 'tell app "Terminal" to do script "cd '"$(pwd)"' && ./scripts/start-desktop.sh"'
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
    # Windows
    start cmd /k "cd packages/backend && npm run dev"
    timeout /t 2 /nobreak > nul
    start cmd /k "cd packages/desktop && npm run dev"
else
    # Linux
    if command -v gnome-terminal > /dev/null; then
        gnome-terminal -- bash -c "cd packages/backend && npm run dev; exec bash"
        sleep 2
        gnome-terminal -- bash -c "cd packages/desktop && npm run dev; exec bash"
    elif command -v xterm > /dev/null; then
        xterm -e "cd packages/backend && npm run dev" &
        sleep 2
        xterm -e "cd packages/desktop && npm run dev" &
    else
        echo -e "${YELLOW}Could not detect terminal emulator${NC}"
        echo "Please run these commands in separate terminals:"
        echo "1. cd packages/backend && npm run dev"
        echo "2. cd packages/desktop && npm run dev"
        exit 1
    fi
fi

echo -e "\n${GREEN}✓ Services starting...${NC}"
echo ""
echo -e "${BLUE}Access Points:${NC}"
echo "• Backend API: http://localhost:3000"
echo "• Health Check: http://localhost:3000/health"
echo "• Desktop App: Will launch automatically"
echo ""
echo -e "${BLUE}Test Credentials:${NC}"
echo "• Email: test@example.com"
echo "• Password: TestPassword123!"
echo ""
echo -e "${YELLOW}Tip: Run './scripts/test-desktop.sh' to test the API${NC}"
echo ""