#!/bin/bash

# BIL Quick Setup Script for Development and Testing
# This script sets up a local development environment for testing

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Node.js
    if ! command -v node >/dev/null 2>&1; then
        log_error "Node.js is required but not installed. Please install Node.js 18+"
        exit 1
    fi
    
    # Check npm
    if ! command -v npm >/dev/null 2>&1; then
        log_error "npm is required but not installed."
        exit 1
    fi
    
    # Check Docker
    if ! command -v docker >/dev/null 2>&1; then
        log_warning "Docker not found. Some features may not work."
    fi
    
    # Check PostgreSQL
    if ! command -v psql >/dev/null 2>&1; then
        log_warning "PostgreSQL client not found. Will use Docker for database."
    fi
    
    # Check Redis
    if ! command -v redis-cli >/dev/null 2>&1; then
        log_warning "Redis client not found. Will use Docker for Redis."
    fi
    
    log_success "Prerequisites check completed"
}

# Setup environment files
setup_environment() {
    log_info "Setting up environment files..."
    
    cd "$PROJECT_ROOT"
    
    # Backend environment
    if [[ ! -f "packages/backend/.env" ]]; then
        log_info "Creating backend .env file..."
        cat > packages/backend/.env << EOF
# Development Environment Configuration
NODE_ENV=development
PORT=3000

# Database Configuration (using Docker)
DATABASE_URL=postgresql://bil_user:bil_password@localhost:5432/bil_development
REDIS_URL=redis://localhost:6379

# JWT Configuration (development keys)
JWT_SECRET=development-jwt-secret-key-for-testing-only-32-chars
JWT_REFRESH_SECRET=development-refresh-secret-key-for-testing-only-32-chars
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# External APIs (use test keys or leave empty)
OPENAI_API_KEY=sk-test-key-or-your-actual-key
WHISPER_API_KEY=test-key-or-your-actual-key
ELEVENLABS_API_KEY=test-key-or-your-actual-key

# Data Integration (development OAuth apps)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
DROPBOX_CLIENT_ID=your-dropbox-client-id
DROPBOX_CLIENT_SECRET=your-dropbox-client-secret

# CORS Configuration
CORS_ORIGIN=http://localhost:3000,http://localhost:5173,http://localhost:8081

# Development Settings
LOG_LEVEL=debug
ENABLE_REQUEST_LOGGING=true
ENABLE_DEBUG_ENDPOINTS=true
ENABLE_EXPERIMENTAL_FEATURES=true

# Rate Limiting (lenient for development)
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=1000

# File Upload
MAX_FILE_SIZE=52428800
UPLOAD_PATH=./uploads

# Security (relaxed for development)
HELMET_CSP_ENABLED=false
TRUST_PROXY=false
EOF
        log_success "Backend .env file created"
    else
        log_info "Backend .env file already exists"
    fi
    
    # Create uploads directory
    mkdir -p packages/backend/uploads
    
    log_success "Environment setup completed"
}

# Setup databases with Docker
setup_databases() {
    log_info "Setting up databases with Docker..."
    
    cd "$PROJECT_ROOT"
    
    # Create docker-compose for development
    cat > docker-compose.dev.yml << EOF
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: bil_development
      POSTGRES_USER: bil_user
      POSTGRES_PASSWORD: bil_password
    ports:
      - "5432:5432"
    volumes:
      - postgres_dev_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U bil_user -d bil_development"]
      interval: 30s
      timeout: 10s
      retries: 3

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_dev_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  postgres_dev_data:
  redis_dev_data:
EOF
    
    # Start databases
    log_info "Starting databases..."
    docker-compose -f docker-compose.dev.yml up -d
    
    # Wait for databases to be ready
    log_info "Waiting for databases to be ready..."
    sleep 10
    
    # Check if databases are ready
    if docker-compose -f docker-compose.dev.yml exec postgres pg_isready -U bil_user -d bil_development >/dev/null 2>&1; then
        log_success "PostgreSQL is ready"
    else
        log_error "PostgreSQL failed to start"
        exit 1
    fi
    
    if docker-compose -f docker-compose.dev.yml exec redis redis-cli ping >/dev/null 2>&1; then
        log_success "Redis is ready"
    else
        log_error "Redis failed to start"
        exit 1
    fi
    
    log_success "Databases setup completed"
}

# Install dependencies
install_dependencies() {
    log_info "Installing dependencies..."
    
    cd "$PROJECT_ROOT"
    
    # Install root dependencies
    npm install
    
    # Install backend dependencies
    cd packages/backend
    npm install
    
    # Install shared dependencies
    cd ../shared
    npm install
    
    # Install mobile dependencies
    cd ../mobile
    npm install
    
    # Install desktop dependencies
    cd ../desktop
    npm install
    
    cd "$PROJECT_ROOT"
    log_success "Dependencies installed"
}

# Run database migrations
run_migrations() {
    log_info "Running database migrations..."
    
    cd "$PROJECT_ROOT/packages/backend"
    
    # Wait a bit more for database to be fully ready
    sleep 5
    
    # Run migrations
    npm run migrate:up
    
    log_success "Database migrations completed"
}

# Build the project
build_project() {
    log_info "Building the project..."
    
    cd "$PROJECT_ROOT"
    
    # Build shared package first
    cd packages/shared
    npm run build
    
    # Build backend
    cd ../backend
    npm run build
    
    cd "$PROJECT_ROOT"
    log_success "Project build completed"
}

# Run tests
run_tests() {
    log_info "Running tests..."
    
    cd "$PROJECT_ROOT/packages/backend"
    
    # Run backend tests
    npm test
    
    log_success "Tests completed"
}

# Start development servers
start_dev_servers() {
    log_info "Starting development servers..."
    
    cd "$PROJECT_ROOT"
    
    # Create a simple start script
    cat > start-dev.sh << 'EOF'
#!/bin/bash

# Start backend in development mode
cd packages/backend
npm run dev &
BACKEND_PID=$!

echo "Backend started with PID: $BACKEND_PID"
echo "API available at: http://localhost:3000"
echo "Health check: http://localhost:3000/health"
echo ""
echo "Press Ctrl+C to stop all servers"

# Wait for Ctrl+C
trap "kill $BACKEND_PID; exit" INT
wait
EOF
    
    chmod +x start-dev.sh
    
    log_success "Development environment ready!"
    log_info "To start the development server, run: ./start-dev.sh"
}

# Create test data
create_test_data() {
    log_info "Creating test data..."
    
    cd "$PROJECT_ROOT/packages/backend"
    
    # Create a simple test data script
    cat > create-test-data.js << 'EOF'
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://bil_user:bil_password@localhost:5432/bil_development',
});

async function createTestData() {
  try {
    console.log('Creating test data...');
    
    // Create test user
    const userResult = await pool.query(`
      INSERT INTO users (email, password_hash, name, created_at, updated_at)
      VALUES ($1, $2, $3, NOW(), NOW())
      ON CONFLICT (email) DO NOTHING
      RETURNING id
    `, ['test@example.com', '$2b$10$example.hash.for.testing', 'Test User']);
    
    if (userResult.rows.length > 0) {
      console.log('Test user created with ID:', userResult.rows[0].id);
    } else {
      console.log('Test user already exists');
    }
    
    console.log('Test data creation completed');
  } catch (error) {
    console.error('Error creating test data:', error);
  } finally {
    await pool.end();
  }
}

createTestData();
EOF
    
    # Run test data creation
    node create-test-data.js
    
    # Clean up
    rm create-test-data.js
    
    log_success "Test data created"
}

# Main setup function
main() {
    log_info "🚀 Starting BIL Quick Setup..."
    
    check_prerequisites
    setup_environment
    setup_databases
    install_dependencies
    run_migrations
    build_project
    create_test_data
    run_tests
    start_dev_servers
    
    log_success "🎉 BIL development environment setup completed!"
    
    echo ""
    echo "=== Quick Start Guide ==="
    echo "1. Start development server: ./start-dev.sh"
    echo "2. Test API health: curl http://localhost:3000/health"
    echo "3. View API docs: http://localhost:3000/api"
    echo "4. Stop databases: docker-compose -f docker-compose.dev.yml down"
    echo ""
    echo "=== Testing Commands ==="
    echo "• Run tests: cd packages/backend && npm test"
    echo "• Run security scan: ./scripts/security-scan.sh development"
    echo "• Run API tests: newman run tests/api/bil-api-tests.postman_collection.json"
    echo ""
    echo "=== Useful URLs ==="
    echo "• API Health: http://localhost:3000/health"
    echo "• API Docs: http://localhost:3000/api"
    echo "• Database: postgresql://bil_user:bil_password@localhost:5432/bil_development"
    echo "• Redis: redis://localhost:6379"
    echo ""
    echo "For production setup, see: PRODUCTION_SETUP.md"
    echo "For testing guide, see: TESTING_GUIDE.md"
}

# Run main function
main "$@"