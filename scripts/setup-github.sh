#!/bin/bash

# GitHub Setup Helper Script
# This script helps you safely upload your project to GitHub

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
echo "╔════════════════════════════════════════╗"
echo "║   BIL GitHub Setup Helper              ║"
echo "╚════════════════════════════════════════╝"
echo -e "${NC}"

# Step 1: Check if git is installed
echo -e "${BLUE}Step 1: Checking prerequisites...${NC}"
if ! command -v git &> /dev/null; then
    echo -e "${RED}✗ Git is not installed${NC}"
    echo "Please install Git from: https://git-scm.com/downloads"
    exit 1
fi
echo -e "${GREEN}✓ Git is installed${NC}"

# Step 2: Check if .gitignore exists
echo -e "${BLUE}Step 2: Checking .gitignore...${NC}"
if [ ! -f ".gitignore" ]; then
    echo -e "${YELLOW}! .gitignore not found, creating one...${NC}"
    cat > .gitignore << 'EOF'
# Dependencies
node_modules/
npm-debug.log*

# Environment variables
.env
.env.local
.env.production
.env.*.local
packages/backend/.env
packages/backend/.env.local

# Build outputs
dist/
build/
*.log

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Test coverage
coverage/
.nyc_output/

# Temporary files
*.tmp
tmp/
temp/

# Database
*.db
*.sqlite
*.sqlite3
dev.db

# Uploads
uploads/
packages/backend/uploads/

# Security reports
security-reports/
EOF
    echo -e "${GREEN}✓ .gitignore created${NC}"
else
    echo -e "${GREEN}✓ .gitignore exists${NC}"
fi

# Step 3: Create .env.example
echo -e "${BLUE}Step 3: Creating .env.example template...${NC}"
if [ ! -f "packages/backend/.env.example" ]; then
    cat > packages/backend/.env.example << 'EOF'
# Server Configuration
PORT=3000
NODE_ENV=development

# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/bil_development
REDIS_URL=redis://localhost:6379

# JWT Configuration (generate with: openssl rand -base64 64)
JWT_SECRET=your-jwt-secret-here-min-32-chars
JWT_REFRESH_SECRET=your-jwt-refresh-secret-here-min-32-chars
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# AI Configuration (choose one)
# Get Gemini key: https://makersuite.google.com/app/apikey
GEMINI_API_KEY=your-gemini-api-key-here
# Or use OpenAI: https://platform.openai.com/api-keys
OPENAI_API_KEY=your-openai-api-key-here

# Speech Services (optional)
WHISPER_API_KEY=your-whisper-key
ELEVENLABS_API_KEY=your-elevenlabs-key

# Data Integration (optional)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
DROPBOX_CLIENT_ID=your-dropbox-client-id
DROPBOX_CLIENT_SECRET=your-dropbox-client-secret

# CORS Configuration
CORS_ORIGIN=http://localhost:3000,http://localhost:5173

# Development Settings
LOG_LEVEL=debug
ENABLE_REQUEST_LOGGING=true
ENABLE_DEBUG_ENDPOINTS=true
ENABLE_EXPERIMENTAL_FEATURES=true
RATE_LIMIT_MAX_REQUESTS=1000
HELMET_CSP_ENABLED=false
TRUST_PROXY=false
MAX_FILE_SIZE=52428800
UPLOAD_PATH=./uploads
EOF
    echo -e "${GREEN}✓ .env.example created${NC}"
else
    echo -e "${GREEN}✓ .env.example already exists${NC}"
fi

# Step 4: Security check - make sure .env is not tracked
echo -e "${BLUE}Step 4: Security check...${NC}"
if git ls-files | grep -q "\.env$"; then
    echo -e "${RED}✗ WARNING: .env file is tracked by git!${NC}"
    echo -e "${YELLOW}Removing .env from git tracking...${NC}"
    git rm --cached packages/backend/.env 2>/dev/null || true
    git rm --cached .env 2>/dev/null || true
    echo -e "${GREEN}✓ .env removed from git tracking${NC}"
else
    echo -e "${GREEN}✓ No .env files are tracked${NC}"
fi

# Step 5: Initialize git if needed
echo -e "${BLUE}Step 5: Initializing git repository...${NC}"
if [ ! -d ".git" ]; then
    git init
    echo -e "${GREEN}✓ Git repository initialized${NC}"
else
    echo -e "${GREEN}✓ Git repository already initialized${NC}"
fi

# Step 6: Configure git user (if not configured)
echo -e "${BLUE}Step 6: Checking git configuration...${NC}"
if ! git config user.name &> /dev/null; then
    echo -e "${YELLOW}Git user not configured${NC}"
    read -p "Enter your name: " GIT_NAME
    git config --global user.name "$GIT_NAME"
    echo -e "${GREEN}✓ Git user name set${NC}"
fi

if ! git config user.email &> /dev/null; then
    echo -e "${YELLOW}Git email not configured${NC}"
    read -p "Enter your email: " GIT_EMAIL
    git config --global user.email "$GIT_EMAIL"
    echo -e "${GREEN}✓ Git email set${NC}"
fi

echo -e "${GREEN}✓ Git is configured${NC}"

# Step 7: Add files to git
echo -e "${BLUE}Step 7: Adding files to git...${NC}"
git add .
echo -e "${GREEN}✓ Files added${NC}"

# Step 8: Show what will be committed
echo -e "${BLUE}Step 8: Files to be committed:${NC}"
git status --short

# Security warning
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${RED}⚠️  SECURITY CHECK${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}Please verify that NO sensitive files are listed above:${NC}"
echo -e "  • No .env files"
echo -e "  • No API keys"
echo -e "  • No passwords"
echo -e "  • No database files"
echo ""
read -p "Does everything look safe? (yes/no): " SAFE_CHECK

if [ "$SAFE_CHECK" != "yes" ]; then
    echo -e "${RED}Aborting. Please review the files and try again.${NC}"
    exit 1
fi

# Step 9: Create commit
echo -e "${BLUE}Step 9: Creating commit...${NC}"
git commit -m "Initial commit: BIL AI Assistant with Gemini support" || echo -e "${YELLOW}Nothing to commit or already committed${NC}"
echo -e "${GREEN}✓ Commit created${NC}"

# Step 10: GitHub repository setup
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 10: GitHub Repository Setup${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}Now you need to create a GitHub repository:${NC}"
echo ""
echo -e "${GREEN}Option 1: Using GitHub Website (Recommended)${NC}"
echo "1. Go to: https://github.com/new"
echo "2. Repository name: bil-core-system"
echo "3. Description: BIL - AI Assistant with Gemini API"
echo "4. Choose Private or Public"
echo "5. DO NOT initialize with README"
echo "6. Click 'Create repository'"
echo ""
echo -e "${GREEN}Option 2: Using GitHub CLI${NC}"
echo "1. Install GitHub CLI: https://cli.github.com"
echo "2. Run: gh auth login"
echo "3. Run: gh repo create bil-core-system --private --source=. --remote=origin"
echo ""
read -p "Have you created the GitHub repository? (yes/no): " REPO_CREATED

if [ "$REPO_CREATED" != "yes" ]; then
    echo -e "${YELLOW}Please create the repository first, then run this script again.${NC}"
    exit 0
fi

# Step 11: Add remote
echo -e "${BLUE}Step 11: Adding GitHub remote...${NC}"
read -p "Enter your GitHub username: " GITHUB_USERNAME
REPO_URL="https://github.com/$GITHUB_USERNAME/bil-core-system.git"

# Check if remote already exists
if git remote | grep -q "origin"; then
    echo -e "${YELLOW}Remote 'origin' already exists${NC}"
    read -p "Update it? (yes/no): " UPDATE_REMOTE
    if [ "$UPDATE_REMOTE" = "yes" ]; then
        git remote set-url origin "$REPO_URL"
        echo -e "${GREEN}✓ Remote updated${NC}"
    fi
else
    git remote add origin "$REPO_URL"
    echo -e "${GREEN}✓ Remote added${NC}"
fi

# Step 12: Push to GitHub
echo -e "${BLUE}Step 12: Pushing to GitHub...${NC}"
echo -e "${YELLOW}This will upload your code to GitHub${NC}"
read -p "Push now? (yes/no): " PUSH_NOW

if [ "$PUSH_NOW" = "yes" ]; then
    # Ensure we're on main branch
    git branch -M main
    
    # Push to GitHub
    if git push -u origin main; then
        echo -e "${GREEN}✓ Successfully pushed to GitHub!${NC}"
    else
        echo -e "${RED}✗ Push failed${NC}"
        echo -e "${YELLOW}You may need to authenticate with GitHub${NC}"
        echo "Try: git push -u origin main"
        exit 1
    fi
else
    echo -e "${YELLOW}Skipped push. You can push later with:${NC}"
    echo "git push -u origin main"
fi

# Success!
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✓ GitHub Setup Complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}Your repository:${NC}"
echo -e "${GREEN}https://github.com/$GITHUB_USERNAME/bil-core-system${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Visit your repository on GitHub"
echo "2. Verify files are uploaded"
echo "3. Check that .env is NOT visible"
echo "4. Share with collaborators"
echo ""
echo -e "${BLUE}Useful commands:${NC}"
echo "• View status: ${YELLOW}git status${NC}"
echo "• Make changes: ${YELLOW}git add . && git commit -m 'message' && git push${NC}"
echo "• Pull updates: ${YELLOW}git pull${NC}"
echo "• View history: ${YELLOW}git log --oneline${NC}"
echo ""
echo -e "${YELLOW}For detailed guide, see: GITHUB_SETUP.md${NC}"
echo ""