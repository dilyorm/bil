#!/bin/bash

# Start Backend Server

echo "🚀 Starting BIL Backend Server..."
echo "=================================="
echo ""

cd packages/backend

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found!"
    echo "Creating from template..."
    cp .env.example .env
    echo ""
    echo "❗ IMPORTANT: Add your GEMINI_API_KEY to packages/backend/.env"
    echo "Get your key from: https://makersuite.google.com/app/apikey"
    echo ""
    read -p "Press Enter after adding your API key..."
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

echo ""
echo "✅ Starting backend on http://localhost:3000"
echo ""
echo "Available endpoints:"
echo "  • Health: http://localhost:3000/health"
echo "  • API: http://localhost:3000/api"
echo ""
echo "Press Ctrl+C to stop"
echo ""

npm run dev