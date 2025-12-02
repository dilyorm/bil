# BIL Production Configuration Checklist

## Essential Configuration Items

### 🔐 Security Configuration (CRITICAL)

#### JWT Secrets
- [ ] `JWT_SECRET` - Generate with: `openssl rand -base64 64`
- [ ] `JWT_REFRESH_SECRET` - Generate with: `openssl rand -base64 64`
- [ ] Both secrets must be at least 32 characters
- [ ] Different secrets for staging and production

#### Database Passwords
- [ ] `DATABASE_URL` - Strong password for PostgreSQL
- [ ] `POSTGRES_PASSWORD` - Same password as above
- [ ] `POSTGRES_REPLICATION_PASSWORD` - For read replicas
- [ ] Use AWS Secrets Manager in production

#### Redis Authentication
- [ ] `REDIS_URL` - Include auth token if using Redis AUTH
- [ ] Configure Redis AUTH in production

### 🔑 API Keys (REQUIRED FOR FUNCTIONALITY)

#### AI Services
- [ ] `OPENAI_API_KEY` - Get from https://platform.openai.com/api-keys
- [ ] `WHISPER_API_KEY` - Usually same as OpenAI key
- [ ] `ELEVENLABS_API_KEY` - Get from https://elevenlabs.io/

#### OAuth Integration
- [ ] `GOOGLE_CLIENT_ID` - Google OAuth app
- [ ] `GOOGLE_CLIENT_SECRET` - Google OAuth app
- [ ] `DROPBOX_CLIENT_ID` - Dropbox OAuth app
- [ ] `DROPBOX_CLIENT_SECRET` - Dropbox OAuth app

### 🌐 Domain and CORS Configuration

#### Domain Setup
- [ ] Purchase and configure domain (e.g., `bil.com`)
- [ ] Set up DNS records:
  - [ ] `api.bil.com` → Load Balancer
  - [ ] `app.bil.com` → Frontend
  - [ ] `staging-api.bil.com` → Staging

#### CORS Configuration
- [ ] `CORS_ORIGIN` - Set to your actual domains
- [ ] Production: `https://app.bil.com,https://bil.com`
- [ ] Staging: `https://staging-app.bil.com,https://staging.bil.com`

### 📧 Email and Notifications

#### Slack Integration (Optional)
- [ ] `SLACK_WEBHOOK_URL` - For alerts and notifications
- [ ] Create webhook at https://api.slack.com/messaging/webhooks

#### Email Service (Future)
- [ ] Configure email service for user notifications
- [ ] Set up SMTP or service like SendGrid

## Environment-Specific Settings

### Development Environment
```bash
NODE_ENV=development
LOG_LEVEL=debug
ENABLE_DEBUG_ENDPOINTS=true
ENABLE_EXPERIMENTAL_FEATURES=true
RATE_LIMIT_MAX_REQUESTS=1000
HELMET_CSP_ENABLED=false
```

### Staging Environment
```bash
NODE_ENV=staging
LOG_LEVEL=info
ENABLE_DEBUG_ENDPOINTS=true
ENABLE_EXPERIMENTAL_FEATURES=true
RATE_LIMIT_MAX_REQUESTS=200
HELMET_CSP_ENABLED=true
```

### Production Environment
```bash
NODE_ENV=production
LOG_LEVEL=warn
ENABLE_DEBUG_ENDPOINTS=false
ENABLE_EXPERIMENTAL_FEATURES=false
RATE_LIMIT_MAX_REQUESTS=100
HELMET_CSP_ENABLED=true
TRUST_PROXY=true
```

## Quick Setup Commands

### 1. Generate Secrets
```bash
# Generate JWT secrets
echo "JWT_SECRET=$(openssl rand -base64 64)"
echo "JWT_REFRESH_SECRET=$(openssl rand -base64 64)"

# Generate database password
echo "DB_PASSWORD=$(openssl rand -base64 32)"

# Generate Redis auth token
echo "REDIS_AUTH_TOKEN=$(openssl rand -base64 32)"
```

### 2. Create Environment File
```bash
# Copy template and edit
cp environments/production.env packages/backend/.env.production

# Edit with your values
nano packages/backend/.env.production
```

### 3. Test Configuration
```bash
# Test with development setup
chmod +x scripts/quick-setup.sh
./scripts/quick-setup.sh

# Test API endpoints
chmod +x tests/api/basic-tests.sh
./tests/api/basic-tests.sh http://localhost:3000
```

## Minimum Viable Configuration

For a basic working system, you need:

### Required Environment Variables
```bash
# Server
NODE_ENV=production
PORT=3000

# Database (use your actual values)
DATABASE_URL=postgresql://bil_user:YOUR_DB_PASSWORD@your-db-host:5432/bil_production
REDIS_URL=redis://your-redis-host:6379

# JWT (generate strong secrets)
JWT_SECRET=YOUR_64_CHAR_JWT_SECRET
JWT_REFRESH_SECRET=YOUR_64_CHAR_REFRESH_SECRET

# AI (at minimum, OpenAI key for basic functionality)
OPENAI_API_KEY=sk-your-openai-key

# CORS (your actual domain)
CORS_ORIGIN=https://your-domain.com
```

### Optional but Recommended
```bash
# Additional AI services
WHISPER_API_KEY=your-whisper-key
ELEVENLABS_API_KEY=your-elevenlabs-key

# OAuth integrations
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Monitoring
SLACK_WEBHOOK_URL=your-slack-webhook
```

## Testing Your Configuration

### 1. Local Development Test
```bash
# Start local environment
./scripts/quick-setup.sh

# Run basic tests
./tests/api/basic-tests.sh
```

### 2. Staging Environment Test
```bash
# Deploy to staging
./scripts/deploy.sh staging

# Test staging API
./tests/api/basic-tests.sh https://staging-api.bil.com
```

### 3. Production Environment Test
```bash
# Deploy to production (after staging tests pass)
./scripts/deploy.sh production

# Test production API
./tests/api/basic-tests.sh https://api.bil.com

# Run comprehensive tests
./scripts/security-scan.sh production
```

## Configuration Validation

### Environment Validation Script
```bash
#!/bin/bash
# Save as scripts/validate-config.sh

echo "Validating BIL configuration..."

# Check required environment variables
required_vars=(
    "NODE_ENV"
    "DATABASE_URL"
    "REDIS_URL"
    "JWT_SECRET"
    "JWT_REFRESH_SECRET"
    "OPENAI_API_KEY"
    "CORS_ORIGIN"
)

missing_vars=()

for var in "${required_vars[@]}"; do
    if [[ -z "${!var}" ]]; then
        missing_vars+=("$var")
    fi
done

if [[ ${#missing_vars[@]} -gt 0 ]]; then
    echo "❌ Missing required environment variables:"
    printf '  - %s\n' "${missing_vars[@]}"
    exit 1
else
    echo "✅ All required environment variables are set"
fi

# Validate JWT secret length
if [[ ${#JWT_SECRET} -lt 32 ]]; then
    echo "❌ JWT_SECRET is too short (minimum 32 characters)"
    exit 1
fi

if [[ ${#JWT_REFRESH_SECRET} -lt 32 ]]; then
    echo "❌ JWT_REFRESH_SECRET is too short (minimum 32 characters)"
    exit 1
fi

echo "✅ Configuration validation passed"
```

## Common Configuration Issues

### 1. Database Connection Issues
```bash
# Test database connection
psql "$DATABASE_URL" -c "SELECT version();"

# Check if database exists
psql "$DATABASE_URL" -c "\l"
```

### 2. Redis Connection Issues
```bash
# Test Redis connection
redis-cli -u "$REDIS_URL" ping
```

### 3. API Key Issues
```bash
# Test OpenAI API key
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
  https://api.openai.com/v1/models
```

### 4. CORS Issues
```bash
# Test CORS configuration
curl -H "Origin: https://your-domain.com" \
  -H "Access-Control-Request-Method: POST" \
  -X OPTIONS \
  https://api.bil.com/api/auth/login
```

## Security Checklist

### Production Security Requirements
- [ ] Strong JWT secrets (64+ characters)
- [ ] Database passwords (32+ characters)
- [ ] HTTPS enabled with valid certificates
- [ ] Security headers configured
- [ ] Rate limiting enabled
- [ ] CORS properly configured
- [ ] Debug endpoints disabled
- [ ] Request logging disabled (or anonymized)
- [ ] Secrets stored in secure vault (AWS Secrets Manager)

### Security Testing
```bash
# Run security scan
./scripts/security-scan.sh production

# Test SSL configuration
curl -I https://api.bil.com

# Test security headers
curl -I https://api.bil.com | grep -E "(X-Frame-Options|X-Content-Type-Options|Strict-Transport-Security)"
```

## Monitoring Configuration

### Required Monitoring
- [ ] Health check endpoints responding
- [ ] Prometheus metrics collection
- [ ] Grafana dashboards configured
- [ ] Alert manager configured
- [ ] Log aggregation setup

### Monitoring Test
```bash
# Test monitoring endpoints
curl https://api.bil.com/health
curl https://api.bil.com/metrics

# Setup monitoring stack
./scripts/setup-monitoring.sh
```

## Final Checklist

Before going live:
- [ ] All environment variables configured
- [ ] Database migrations run successfully
- [ ] SSL certificates valid and auto-renewing
- [ ] All tests passing (unit, integration, API, security)
- [ ] Monitoring and alerting configured
- [ ] Backup and disaster recovery tested
- [ ] Load testing completed
- [ ] Security scan passed
- [ ] Documentation updated

## Getting Help

If you encounter issues:
1. Check the logs: `kubectl logs -l app=bil-api -n bil-production`
2. Review the troubleshooting sections in PRODUCTION_SETUP.md
3. Run the validation script: `./scripts/validate-config.sh`
4. Test individual components with the testing guide
5. Contact support: ops@bil.com