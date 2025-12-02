#!/bin/bash

# Start Desktop App

echo "🖥️  Starting BIL Desktop App..."
echo "================================"
echo ""

cd packages/desktop

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

echo ""
echo "✅ Starting desktop app..."
echo ""
echo "The Electron window will open automatically"
echo ""
echo "Backend should be running on: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop"
echo ""

npm run dev