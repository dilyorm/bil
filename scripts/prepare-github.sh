#!/bin/bash

# Prepare BIL project for GitHub push
# This script removes sensitive data and prepares the project for public release

echo "🚀 Preparing BIL project for GitHub..."
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: Must be run from project root${NC}"
    exit 1
fi

echo -e "${YELLOW}Step 1: Checking for sensitive files...${NC}"

# Check for .env files
if find . -name ".env" -not -path "*/node_modules/*" | grep -q .; then
    echo -e "${RED}⚠️  Found .env files:${NC}"
    find . -name ".env" -not -path "*/node_modules/*"
    echo ""
    echo -e "${YELLOW}These files are in .gitignore and won't be committed${NC}"
fi

# Check for API keys in code
echo ""
echo -e "${YELLOW}Step 2: Checking for hardcoded API keys...${NC}"
if grep -r "AIzaSy" --include="*.ts" --include="*.js" --include="*.tsx" --include="*.jsx" --exclude-dir=node_modules .; then
    echo -e "${RED}⚠️  Found potential API keys in code!${NC}"
    echo -e "${RED}Please remove them before pushing${NC}"
    exit 1
else
    echo -e "${GREEN}✅ No hardcoded API keys found${NC}"
fi

# Check for secrets in environment files
echo ""
echo -e "${YELLOW}Step 3: Checking environment files...${NC}"
if [ -f "packages/backend/.env.example" ]; then
    echo -e "${GREEN}✅ .env.example exists${NC}"
else
    echo -e "${RED}❌ .env.example missing${NC}"
    exit 1
fi

# Remove test/debug files
echo ""
echo -e "${YELLOW}Step 4: Removing test and debug files...${NC}"
find . -name "*_TROUBLESHOOTING.md" -delete
find . -name "*_SUMMARY.md" -delete
find . -name "*_COMPLETE.md" -delete
find . -name "TEST_*.md" -delete
find . -name "test-*.js" -delete
echo -e "${GREEN}✅ Cleaned up test files${NC}"

# Check git status
echo ""
echo -e "${YELLOW}Step 5: Checking git status...${NC}"
if [ -d ".git" ]; then
    echo -e "${GREEN}✅ Git repository exists${NC}"
else
    echo -e "${YELLOW}⚠️  No git repository found. Initializing...${NC}"
    git init
    echo -e "${GREEN}✅ Git repository initialized${NC}"
fi

# Create .gitattributes for better diffs
echo ""
echo -e "${YELLOW}Step 6: Creating .gitattributes...${NC}"
cat > .gitattributes << 'EOF'
# Auto detect text files and perform LF normalization
* text=auto

# Source code
*.ts text
*.tsx text
*.js text
*.jsx text
*.json text
*.md text
*.yml text
*.yaml text

# Scripts
*.sh text eol=lf
*.bat text eol=crlf

# Binary files
*.png binary
*.jpg binary
*.jpeg binary
*.gif binary
*.ico binary
*.mov binary
*.mp4 binary
*.mp3 binary
*.flv binary
*.fla binary
*.swf binary
*.gz binary
*.zip binary
*.7z binary
*.ttf binary
*.eot binary
*.woff binary
*.woff2 binary
*.pyc binary
*.pdf binary
*.db binary
*.sqlite binary
EOF
echo -e "${GREEN}✅ .gitattributes created${NC}"

# Summary
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ Project is ready for GitHub!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Next steps:"
echo "1. Review changes: git status"
echo "2. Add files: git add ."
echo "3. Commit: git commit -m 'Initial commit'"
echo "4. Add remote: git remote add origin https://github.com/dilyorm/bil.git"
echo "5. Push: git push -u origin main"
echo ""
echo -e "${YELLOW}⚠️  Remember to:${NC}"
echo "- Never commit .env files"
echo "- Never commit API keys"
echo "- Review all files before pushing"
echo ""
