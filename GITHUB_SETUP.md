# 📤 Upload BIL Project to GitHub

## Step-by-Step Guide

### Step 1: Prepare Your Project

#### 1.1 Update .gitignore
Your `.gitignore` file should already exclude sensitive files. Let's verify:

```bash
# Check if .gitignore exists and has the right content
cat .gitignore
```

The `.gitignore` should include:
```
# Dependencies
node_modules/
npm-debug.log*

# Environment variables (IMPORTANT - keeps secrets safe)
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
```

#### 1.2 Create .env.example (Template for others)
```bash
# Create a template .env file (without real secrets)
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
```

### Step 2: Create GitHub Repository

#### Option A: Using GitHub Website (Easiest)

1. **Go to GitHub**: https://github.com
2. **Sign in** or create an account
3. **Click the "+" icon** in the top right
4. **Select "New repository"**
5. **Fill in details**:
   - Repository name: `bil-core-system`
   - Description: `BIL - AI Assistant with Gemini API`
   - Visibility: Choose **Private** (recommended) or Public
   - **DO NOT** initialize with README (you already have one)
6. **Click "Create repository"**

#### Option B: Using GitHub CLI (Advanced)

```bash
# Install GitHub CLI (if not installed)
# Windows: winget install GitHub.cli
# Mac: brew install gh
# Linux: See https://github.com/cli/cli#installation

# Login to GitHub
gh auth login

# Create repository
gh repo create bil-core-system --private --source=. --remote=origin
```

### Step 3: Initialize Git (if not already done)

```bash
# Check if git is initialized
git status

# If not initialized, run:
git init

# Configure git (first time only)
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

### Step 4: Add Files to Git

```bash
# Add all files (respecting .gitignore)
git add .

# Check what will be committed (make sure no .env files!)
git status

# If you see .env files, they should NOT be there!
# If they appear, add them to .gitignore and run:
# git rm --cached packages/backend/.env
# git add .gitignore
```

### Step 5: Create First Commit

```bash
# Commit your files
git commit -m "Initial commit: BIL AI Assistant with Gemini support"
```

### Step 6: Connect to GitHub

```bash
# Add GitHub as remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/bil-core-system.git

# Or if you used GitHub CLI, it's already connected
```

### Step 7: Push to GitHub

```bash
# Push to GitHub
git push -u origin main

# If you get an error about 'master' vs 'main', run:
# git branch -M main
# git push -u origin main
```

### Step 8: Verify Upload

1. Go to your GitHub repository: `https://github.com/YOUR_USERNAME/bil-core-system`
2. Check that files are there
3. **IMPORTANT**: Verify that `.env` file is NOT visible (it should be ignored)

## 🔒 Security Checklist

Before pushing to GitHub, verify:

- [ ] `.env` file is in `.gitignore`
- [ ] `.env` file is NOT in git: `git ls-files | grep .env` (should return nothing)
- [ ] `.env.example` exists (template without secrets)
- [ ] No API keys in code files
- [ ] No passwords in code files
- [ ] `node_modules/` is ignored
- [ ] Database files are ignored

## 🔑 Managing Secrets

### For Local Development
1. Copy `.env.example` to `.env`
2. Fill in your actual API keys
3. Never commit `.env` to git

### For Team Members
When someone clones your repo:
```bash
# They should:
cd packages/backend
cp .env.example .env
# Then edit .env with their own keys
```

### For Production (Railway)
Set environment variables in Railway dashboard:
```bash
railway variables set GEMINI_API_KEY="your-key"
railway variables set JWT_SECRET="your-secret"
# etc.
```

## 📝 Create a Good README

Update your `README.md` with:

```markdown
# BIL - AI Assistant

AI-powered assistant using Google Gemini API.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL
- Redis
- Gemini API key

### Setup

1. Clone the repository
\`\`\`bash
git clone https://github.com/YOUR_USERNAME/bil-core-system.git
cd bil-core-system
\`\`\`

2. Install dependencies
\`\`\`bash
npm install
\`\`\`

3. Configure environment
\`\`\`bash
cd packages/backend
cp .env.example .env
# Edit .env with your API keys
\`\`\`

4. Run development server
\`\`\`bash
npm run dev --workspace=packages/backend
\`\`\`

## 🔑 Getting API Keys

### Gemini API (Free)
1. Go to https://makersuite.google.com/app/apikey
2. Click "Create API Key"
3. Copy and add to `.env` as `GEMINI_API_KEY`

### Railway (Free Hosting)
1. Sign up at https://railway.app
2. Follow `QUICKSTART_MVP.md` for deployment

## 📖 Documentation

- **Quick Start**: See `QUICKSTART_MVP.md`
- **Free Hosting**: See `MVP_FREE_SETUP.md`
- **Testing**: See `TESTING_GUIDE.md`
- **Production**: See `PRODUCTION_SETUP.md`

## 🆘 Support

For issues, see `MVP_SUMMARY.md` or create an issue.

## 📄 License

MIT License - see LICENSE file
\`\`\`

## 🔄 Keeping Your Repo Updated

### After making changes:
```bash
# Check what changed
git status

# Add changes
git add .

# Commit with a message
git commit -m "Description of changes"

# Push to GitHub
git push
```

### Common Git Commands:
```bash
# See commit history
git log --oneline

# Create a new branch
git checkout -b feature-name

# Switch branches
git checkout main

# Pull latest changes
git pull

# See differences
git diff
```

## 🌿 Branching Strategy (Recommended)

```bash
# Main branch (production-ready code)
main

# Development branch
git checkout -b develop

# Feature branches
git checkout -b feature/new-feature
git checkout -b fix/bug-fix

# When done, merge back:
git checkout main
git merge feature/new-feature
git push
```

## 🤝 Collaborating with Others

### Adding Collaborators
1. Go to your GitHub repo
2. Click "Settings"
3. Click "Collaborators"
4. Click "Add people"
5. Enter their GitHub username

### They can then clone:
```bash
git clone https://github.com/YOUR_USERNAME/bil-core-system.git
cd bil-core-system
npm install
cd packages/backend
cp .env.example .env
# Edit .env with their keys
```

## 🔐 GitHub Secrets (for CI/CD)

If you want to use GitHub Actions:

1. Go to your repo on GitHub
2. Click "Settings" > "Secrets and variables" > "Actions"
3. Click "New repository secret"
4. Add secrets:
   - `GEMINI_API_KEY`
   - `RAILWAY_TOKEN` (if using Railway)
   - etc.

## 📦 .gitignore Best Practices

Your `.gitignore` should always exclude:
- Environment files (`.env`)
- Dependencies (`node_modules/`)
- Build outputs (`dist/`, `build/`)
- Logs (`*.log`)
- Database files (`*.db`)
- IDE files (`.vscode/`, `.idea/`)
- OS files (`.DS_Store`)

## ⚠️ What NOT to Commit

**NEVER commit these to GitHub:**
- API keys
- Passwords
- Database credentials
- JWT secrets
- OAuth secrets
- Private keys
- `.env` files
- Personal data

## 🎯 Quick Checklist

Before pushing to GitHub:
- [ ] `.env` is in `.gitignore`
- [ ] `.env.example` exists (without real secrets)
- [ ] No secrets in code
- [ ] README.md is updated
- [ ] Tests pass: `npm test`
- [ ] Code is formatted
- [ ] Commit message is clear

## 🚀 Next Steps

After uploading to GitHub:
1. ✅ Set up GitHub Actions (optional)
2. ✅ Deploy to Railway
3. ✅ Add collaborators
4. ✅ Create issues for features
5. ✅ Set up project board

## 📞 Need Help?

- GitHub Docs: https://docs.github.com
- Git Tutorial: https://git-scm.com/docs/gittutorial
- GitHub Desktop: https://desktop.github.com (GUI alternative)

---

**Remember**: Never commit secrets! Always use `.env` files and keep them in `.gitignore`.