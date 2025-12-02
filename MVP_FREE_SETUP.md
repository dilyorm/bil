# BIL MVP - Free Hosting Setup Guide

## 🎯 Goal
Get BIL running with **zero cost** using free tier services and Gemini API.

## 🆓 Free Services Stack

### Backend Hosting Options (Choose One)

#### Option 1: Railway.app (Recommended)
- **Free Tier**: 500 hours/month, $5 credit
- **Includes**: PostgreSQL, Redis
- **Best for**: Full-stack apps with database
- **Setup time**: 5 minutes

#### Option 2: Render.com
- **Free Tier**: 750 hours/month
- **Includes**: PostgreSQL (90 days free)
- **Best for**: Simple APIs
- **Setup time**: 10 minutes

#### Option 3: Fly.io
- **Free Tier**: 3 VMs, 3GB storage
- **Includes**: PostgreSQL, Redis
- **Best for**: Docker deployments
- **Setup time**: 15 minutes

### Frontend Hosting
- **Vercel**: Unlimited for personal projects
- **Netlify**: 100GB bandwidth/month
- **Cloudflare Pages**: Unlimited

### Database (if not included)
- **Supabase**: 500MB PostgreSQL free
- **Neon**: 10GB PostgreSQL free
- **Upstash**: Redis free tier (10K commands/day)

### Domain (Free Options)
- **Free subdomain**: Use Railway/Render/Vercel subdomain
- **Free domain**: Get .tk, .ml, .ga from Freenom (or use subdomain)
- **Custom domain**: Use existing domain with free DNS (Cloudflare)

## 🚀 Quick MVP Setup (Railway - Recommended)

### Step 1: Install Railway CLI
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login
```

### Step 2: Prepare Your Project
```bash
# Navigate to your project
cd /path/to/bil-core-system

# Initialize Railway project
railway init

# Link to new project
railway link
```

### Step 3: Add Gemini API Support

First, let's update the AI client to support Gemini:

```bash
# Install Gemini SDK
cd packages/backend
npm install @google/generative-ai
```

### Step 4: Create Railway Configuration

Create `railway.json`:
```json
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
```

### Step 5: Add PostgreSQL and Redis
```bash
# Add PostgreSQL
railway add --plugin postgresql

# Add Redis
railway add --plugin redis

# Get connection strings
railway variables
```

### Step 6: Set Environment Variables
```bash
# Set required variables
railway variables set NODE_ENV=production
railway variables set PORT=3000
railway variables set JWT_SECRET=$(openssl rand -base64 64)
railway variables set JWT_REFRESH_SECRET=$(openssl rand -base64 64)
railway variables set GEMINI_API_KEY=your-gemini-api-key
railway variables set CORS_ORIGIN=https://your-app.vercel.app

# Railway automatically sets DATABASE_URL and REDIS_URL
```

### Step 7: Deploy
```bash
# Deploy to Railway
railway up

# Get your app URL
railway domain
```

## 🎨 Frontend Deployment (Vercel)

### Step 1: Install Vercel CLI
```bash
npm install -g vercel
```

### Step 2: Deploy Frontend
```bash
# Navigate to your frontend (if you have one)
cd packages/web  # or create a simple frontend

# Deploy to Vercel
vercel

# Set environment variables
vercel env add NEXT_PUBLIC_API_URL production
# Enter your Railway backend URL
```

## 🔧 Minimal Configuration

### Required Environment Variables (Railway)
```bash
# Core Settings
NODE_ENV=production
PORT=3000

# Database (automatically set by Railway)
DATABASE_URL=postgresql://...
REDIS_URL=redis://...

# Security
JWT_SECRET=<generate-with-openssl-rand-base64-64>
JWT_REFRESH_SECRET=<generate-with-openssl-rand-base64-64>

# AI Service (Gemini instead of OpenAI)
GEMINI_API_KEY=your-gemini-api-key-from-google-ai-studio

# CORS (your Vercel frontend URL)
CORS_ORIGIN=https://your-app.vercel.app

# Optional - Disable features not needed for MVP
ENABLE_EXPERIMENTAL_FEATURES=false
ENABLE_DEBUG_ENDPOINTS=false
```

### Get Your Gemini API Key
1. Go to https://makersuite.google.com/app/apikey
2. Click "Create API Key"
3. Copy the key

## 📝 Simplified MVP Setup Script

Create `scripts/mvp-setup.sh`:

```bash
#!/bin/bash

echo "🚀 BIL MVP Setup - Free Hosting"
echo "================================"

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "Installing Railway CLI..."
    npm install -g @railway/cli
fi

# Login to Railway
echo "Please login to Railway..."
railway login

# Initialize project
echo "Initializing Railway project..."
railway init

# Add PostgreSQL
echo "Adding PostgreSQL..."
railway add --plugin postgresql

# Add Redis
echo "Adding Redis..."
railway add --plugin redis

# Generate secrets
JWT_SECRET=$(openssl rand -base64 64)
JWT_REFRESH_SECRET=$(openssl rand -base64 64)

# Set environment variables
echo "Setting environment variables..."
railway variables set NODE_ENV=production
railway variables set PORT=3000
railway variables set JWT_SECRET="$JWT_SECRET"
railway variables set JWT_REFRESH_SECRET="$JWT_REFRESH_SECRET"

# Prompt for Gemini API key
read -p "Enter your Gemini API key: " GEMINI_API_KEY
railway variables set GEMINI_API_KEY="$GEMINI_API_KEY"

# Prompt for CORS origin
read -p "Enter your frontend URL (or press Enter for default): " CORS_ORIGIN
CORS_ORIGIN=${CORS_ORIGIN:-"http://localhost:3000"}
railway variables set CORS_ORIGIN="$CORS_ORIGIN"

# Deploy
echo "Deploying to Railway..."
railway up

# Get URL
echo ""
echo "✅ Deployment complete!"
echo "Your API is available at:"
railway domain

echo ""
echo "Next steps:"
echo "1. Test your API: curl \$(railway domain)/health"
echo "2. Deploy frontend to Vercel"
echo "3. Update CORS_ORIGIN with your Vercel URL"
```

## 🧪 Testing Your MVP

### Test Backend
```bash
# Get your Railway URL
BACKEND_URL=$(railway domain)

# Test health endpoint
curl $BACKEND_URL/health

# Test API
curl $BACKEND_URL/api/health
```

### Test with Postman/Insomnia
```bash
# Register user
POST https://your-app.railway.app/api/auth/register
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "TestPassword123!",
  "name": "Test User"
}

# Login
POST https://your-app.railway.app/api/auth/login
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "TestPassword123!"
}

# Test AI chat
POST https://your-app.railway.app/api/ai/chat
Authorization: Bearer <your-token>
Content-Type: application/json

{
  "message": "Hello, how are you?"
}
```

## 💰 Cost Breakdown (All Free!)

| Service | Free Tier | Cost |
|---------|-----------|------|
| Railway | 500 hours/month + $5 credit | $0 |
| PostgreSQL | Included with Railway | $0 |
| Redis | Included with Railway | $0 |
| Vercel | Unlimited for personal | $0 |
| Gemini API | 60 requests/minute free | $0 |
| Domain | Railway subdomain | $0 |
| **Total** | | **$0/month** |

## 🎯 MVP Feature Set

### Included in Free MVP
✅ User authentication (register/login)
✅ AI chat with Gemini
✅ Basic conversation history
✅ RESTful API
✅ PostgreSQL database
✅ Redis caching
✅ HTTPS (automatic with Railway)
✅ Health monitoring

### Not Included (Can Add Later)
❌ Real-time sync (WebSockets)
❌ File uploads
❌ OAuth integrations
❌ Advanced monitoring
❌ Multiple replicas
❌ Custom domain

## 🔄 Alternative: Render.com Setup

If you prefer Render:

```bash
# Create render.yaml
cat > render.yaml << EOF
services:
  - type: web
    name: bil-api
    env: node
    buildCommand: npm install && npm run build --workspace=packages/backend
    startCommand: npm start --workspace=packages/backend
    envVars:
      - key: NODE_ENV
        value: production
      - key: JWT_SECRET
        generateValue: true
      - key: JWT_REFRESH_SECRET
        generateValue: true
      - key: GEMINI_API_KEY
        sync: false
      - key: DATABASE_URL
        fromDatabase:
          name: bil-db
          property: connectionString
      - key: REDIS_URL
        fromService:
          name: bil-redis
          type: redis
          property: connectionString

databases:
  - name: bil-db
    databaseName: bil_production
    user: bil_user

  - name: bil-redis
    type: redis
    plan: free
EOF

# Deploy to Render
# 1. Push to GitHub
# 2. Connect GitHub repo to Render
# 3. Render will auto-deploy using render.yaml
```

## 🚨 Troubleshooting

### Railway Issues
```bash
# Check logs
railway logs

# Check variables
railway variables

# Restart service
railway restart
```

### Database Connection Issues
```bash
# Test database connection
railway run npm run migrate:status --workspace=packages/backend

# Run migrations
railway run npm run migrate:up --workspace=packages/backend
```

### Gemini API Issues
```bash
# Test Gemini API key
curl -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"Hello"}]}]}' \
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=YOUR_API_KEY"
```

## 📚 Next Steps

1. **Deploy MVP**: Follow Railway setup above
2. **Test thoroughly**: Use the testing guide
3. **Add frontend**: Deploy simple React app to Vercel
4. **Monitor usage**: Check Railway dashboard
5. **Scale when needed**: Upgrade to paid tier if you exceed limits

## 🎓 Learning Resources

- Railway Docs: https://docs.railway.app
- Gemini API: https://ai.google.dev/docs
- Vercel Docs: https://vercel.com/docs
- Render Docs: https://render.com/docs

## 💡 Pro Tips

1. **Use Railway's free $5 credit wisely** - It lasts ~1 month with moderate usage
2. **Monitor your usage** - Set up alerts in Railway dashboard
3. **Optimize database queries** - Free tier has limited resources
4. **Use Redis for caching** - Reduce database load
5. **Deploy during off-peak hours** - Faster deployment times

Your MVP can run completely free for testing and initial users!