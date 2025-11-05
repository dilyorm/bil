# BIL Core System

The BIL (Biological Intelligence Layer) Core System is a personal AI assistant ecosystem that provides seamless interaction across multiple devices including mobile applications, desktop interfaces, and wearable devices.

## Project Structure

This is a monorepo containing the following packages:

- **`packages/shared`** - Shared TypeScript types and utilities
- **`packages/backend`** - Node.js/Express API server
- **`packages/mobile`** - React Native mobile application (Expo)
- **`packages/desktop`** - Electron desktop application
- **`packages/wearable`** - ESP32 firmware (to be added)

## Getting Started

### Prerequisites

- Node.js 18+ and npm 9+
- Git

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd bil-core-system
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp packages/backend/.env.example packages/backend/.env
# Edit the .env file with your configuration
```

### Development

Start all services in development mode:
```bash
npm run dev
```

Or start individual services:
```bash
npm run dev:backend    # Start backend API server
npm run dev:mobile     # Start mobile app with Expo
npm run dev:desktop    # Start desktop app
```

### Building

Build all packages:
```bash
npm run build
```

Or build individual packages:
```bash
npm run build:backend
npm run build:mobile
npm run build:desktop
```

### Testing

Run tests for all packages:
```bash
npm test
```

### Code Quality

Format code:
```bash
npm run format
```

Lint code:
```bash
npm run lint
npm run lint:fix  # Auto-fix issues
```

## Architecture

The system follows a hub-and-spoke architecture with the backend API as the central hub and various client applications as spokes. Real-time synchronization is maintained through WebSocket connections.

## Contributing

1. Follow the existing code style and formatting
2. Write tests for new functionality
3. Update documentation as needed
4. Ensure all checks pass before submitting PRs

## License

[License information to be added]