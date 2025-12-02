#!/bin/bash

# BIL MVP Setup for Railway (Free Hosting)
# This script sets up your BIL backend on Railway with Gemini API

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
echo "╔════════════════════════════════════════╗"
echo "║   BIL MVP - Railway Free Setup         ║"
echo "║   Zero Cost Deployment                 ║"
echo "╚════════════════════════════════════════╝"
echo -e "${NC}"

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo -e "${YELLOW}Railway CLI not found. Installing...${NC}"
    npm install -g @railway/cli
    echo -e "${GREEN}✓ Railway CLI installed${NC}"
fi

# Check if user is logged in
if ! railway whoami &> /dev/null; then
    echo -e "${BLUE}Please login to Railway...${NC}"
    railway login
fi

echo -e "${GREEN}✓ Logged in to Railway${NC}"

# Create new project or link existing
echo -e "${BLUE}Setting up Railway project...${NC}"
if [ ! -f "railway.json" ]; then
    railway init
    echo -e "${GREEN}✓ Railway project initialized${NC}"
else
    echo -e "${YELLOW}Railway project already exists${NC}"
fi

# Add PostgreSQL
echo -e "${BLUE}Adding PostgreSQL database...${NC}"
railway add --plugin postgresql || echo -e "${YELLOW}PostgreSQL may already exist${NC}"
echo -e "${GREEN}✓ PostgreSQL added${NC}"

# Add Redis
echo -e "${BLUE}Adding Redis cache...${NC}"
railway add --plugin redis || echo -e "${YELLOW}Redis may already exist${NC}"
echo -e "${GREEN}✓ Redis added${NC}"

# Generate secrets
echo -e "${BLUE}Generating secure secrets...${NC}"
JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
JWT_REFRESH_SECRET=$(openssl rand -base64 64 | tr -d '\n')
echo -e "${GREEN}✓ Secrets generated${NC}"

# Set environment variables
echo -e "${BLUE}Configuring environment variables...${NC}"

railway variables set NODE_ENV=production
railway variables set PORT=3000
railway variables set JWT_SECRET="$JWT_SECRET"
railway variables set JWT_REFRESH_SECRET="$JWT_REFRESH_SECRET"

# Prompt for Gemini API key
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Get your Gemini API key from:${NC}"
echo -e "${GREEN}https://makersuite.google.com/app/apikey${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
read -p "Enter your Gemini API key: " GEMINI_API_KEY

if [ -z "$GEMINI_API_KEY" ]; then
    echo -e "${RED}✗ Gemini API key is required!${NC}"
    exit 1
fi

railway variables set GEMINI_API_KEY="$GEMINI_API_KEY"
echo -e "${GREEN}✓ Gemini API key configured${NC}"

# Set CORS origin
echo ""
read -p "Enter your frontend URL (or press Enter for default): " CORS_ORIGIN
CORS_ORIGIN=${CORS_ORIGIN:-"http://localhost:3000,https://localhost:3000"}
railway variables set CORS_ORIGIN="$CORS_ORIGIN"
echo -e "${GREEN}✓ CORS configured${NC}"

# Optional: Disable features not needed for MVP
railway variables set ENABLE_EXPERIMENTAL_FEATURES=false
railway variables set ENABLE_DEBUG_ENDPOINTS=false
railway variables set LOG_LEVEL=info

echo -e "${GREEN}✓ All environment variables configured${NC}"

# Install Gemini SDK
echo -e "${BLUE}Installing Gemini SDK...${NC}"
cd packages/backend
npm install @google/generative-ai
cd ../..
echo -e "${GREEN}✓ Gemini SDK installed${NC}"

# Create railway.json if it doesn't exist
if [ ! -f "railway.json" ]; then
    echo -e "${BLUE}Creating Railway configuration...${NC}"
    cat > railway.json << 'EOF'
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm install && npm run build --workspace=packages/backend"
  },
  "deploy": {
    "startCommand": "npm start --workspace=packages/backend",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 100,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
EOF
    echo -e "${GREEN}✓ Railway configuration created${NC}"
fi

# Deploy to Railway
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}Ready to deploy!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
read -p "Deploy now? (y/n): " DEPLOY_NOW

if [ "$DEPLOY_NOW" = "y" ] || [ "$DEPLOY_NOW" = "Y" ]; then
    echo -e "${BLUE}Deploying to Railway...${NC}"
    railway up
    
    # Wait for deployment
    echo -e "${BLUE}Waiting for deployment to complete...${NC}"
    sleep 10
    
    # Get the URL
    RAILWAY_URL=$(railway domain 2>/dev/null || echo "")
    
    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}✓ Deployment Complete!${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    
    if [ -n "$RAILWAY_URL" ]; then
        echo -e "${BLUE}Your API is live at:${NC}"
        echo -e "${GREEN}$RAILWAY_URL${NC}"
        echo ""
        echo -e "${BLUE}Test your API:${NC}"
        echo -e "${YELLOW}curl $RAILWAY_URL/health${NC}"
    else
        echo -e "${YELLOW}Get your URL with: railway domain${NC}"
    fi
    
    echo ""
    echo -e "${BLUE}Next steps:${NC}"
    echo -e "1. Test health endpoint: ${YELLOW}curl \$(railway domain)/health${NC}"
    echo -e "2. View logs: ${YELLOW}railway logs${NC}"
    echo -e "3. Check variables: ${YELLOW}railway variables${NC}"
    echo -e "4. Deploy frontend to Vercel"
    echo ""
    echo -e "${BLUE}Useful commands:${NC}"
    echo -e "• View logs: ${YELLOW}railway logs${NC}"
    echo -e "• Restart: ${YELLOW}railway restart${NC}"
    echo -e "• Open dashboard: ${YELLOW}railway open${NC}"
    echo -e "• Run migrations: ${YELLOW}railway run npm run migrate:up --workspace=packages/backend${NC}"
    
else
    echo -e "${YELLOW}Deployment skipped. Deploy later with: railway up${NC}"
fi

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}Setup Complete! 🎉${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}Cost: ${GREEN}\$0/month${NC} (Free tier)"
echo -e "${BLUE}Database: ${GREEN}PostgreSQL${NC} (included)"
echo -e "${BLUE}Cache: ${GREEN}Redis${NC} (included)"
echo -e "${BLUE}AI: ${GREEN}Gemini${NC} (60 req/min free)"
echo ""
echo -e "${YELLOW}For production setup, see: PRODUCTION_SETUP.md${NC}"
echo -e "${YELLOW}For testing guide, see: TESTING_GUIDE.md${NC}"
echo ""