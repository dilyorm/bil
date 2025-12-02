# BIL

> A multi-platform AI assistant system with desktop control, mobile app, and wearable device support.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

## 🌟 Features

### 🤖 AI Assistant
- **Gemini AI Integration** - Powered by Google's Gemini AI
- **Natural Language Processing** - Conversational AI interactions
- **Context-Aware Responses** - Remembers conversation history
- **Multi-Device Sync** - Seamless experience across devices

### 💻 Desktop Control
- **Remote Desktop Control** - Control your computer from your phone
- **Application Launcher** - Open Steam, CS2, Spotify, Chrome, etc.
- **Command Execution** - Run shell commands remotely
- **SSH Support** - Connect to servers from your desktop
- **Cross-Platform** - Windows, macOS, and Linux support

### 📱 Mobile App
- **React Native** - iOS and Android support
- **Voice Input** - Talk to your AI assistant
- **Desktop Control** - Control your computer remotely
- **Device Management** - Manage connected devices
- **Offline Support** - Works without internet

### 🖥️ Desktop App
- **Electron-based** - Native desktop experience
- **System Tray** - Runs in background
- **Floating Window** - Quick access assistant
- **Global Shortcuts** - Keyboard shortcuts for quick access
- **Auto-updates** - Automatic updates via Electron

### ⌚ Wearable Support
- **ESP32-based** - Custom wearable device
- **Gesture Control** - Control with hand gestures
- **Voice Detection** - Wake word detection
- **Haptic Feedback** - Vibration feedback
- **BLE Communication** - Bluetooth Low Energy

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ ([Download](https://nodejs.org/))
- **Docker** ([Download](https://www.docker.com/products/docker-desktop/))
- **Git** ([Download](https://git-scm.com/))

### Installation

```bash
# Clone the repository
git clone https://github.com/dilyorm/bil.git
cd bil

# Install dependencies
npm install

# Start PostgreSQL and Redis
docker-compose -f docker-compose.dev.yml up -d

# Setup environment variables
cp packages/backend/.env.example packages/backend/.env
# Edit packages/backend/.env and add your API keys

# Start backend
cd packages/backend
npm run dev

# Start desktop app (new terminal)
cd packages/desktop
npm run dev

# Start mobile app (new terminal)
cd packages/mobile
npx expo start
```

## 📚 Documentation

- **[Quick Start Guide](QUICKSTART_DESKTOP_CONTROL.md)** - Get started in 5 minutes
- **[Desktop Control Guide](DESKTOP_CONTROL_GUIDE.md)** - Complete desktop control documentation
- **[Desktop App Guide](DESKTOP_APP_GUIDE.md)** - Desktop application documentation
- **[Production Setup](PRODUCTION_SETUP.md)** - Deploy to production
- **[Security Guide](SECURITY.md)** - Security best practices

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     BIL System                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │  Mobile  │  │ Desktop  │  │ Wearable │            │
│  │   App    │  │   App    │  │  Device  │            │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘            │
│       │             │              │                   │
│       └─────────────┼──────────────┘                   │
│                     │                                   │
│              ┌──────▼──────┐                           │
│              │   Backend   │                           │
│              │     API     │                           │
│              └──────┬──────┘                           │
│                     │                                   │
│       ┌─────────────┼─────────────┐                   │
│       │             │             │                   │
│  ┌────▼────┐  ┌────▼────┐  ┌────▼────┐              │
│  │ Gemini  │  │PostgreSQL│  │  Redis  │              │
│  │   AI    │  │ Database │  │  Cache  │              │
│  └─────────┘  └─────────┘  └─────────┘              │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## 🛠️ Tech Stack

### Backend
- **Node.js** + **TypeScript** - Runtime and language
- **Express** - Web framework
- **PostgreSQL** - Primary database
- **Redis** - Caching and pub/sub
- **WebSocket** - Real-time communication
- **JWT** - Authentication

### Desktop
- **Electron** - Desktop framework
- **React** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool

### Mobile
- **React Native** - Mobile framework
- **Expo** - Development platform
- **TypeScript** - Type safety

### Wearable
- **ESP32** - Microcontroller
- **C++** - Programming language
- **BLE** - Communication protocol

### AI
- **Google Gemini** - Primary AI model
- **OpenAI** (optional) - Alternative AI model

## 📦 Project Structure

```
bil/
├── packages/
│   ├── backend/          # Node.js backend API
│   ├── desktop/          # Electron desktop app
│   ├── mobile/           # React Native mobile app
│   └── wearable/         # ESP32 firmware
├── infrastructure/       # Deployment configs
│   ├── k8s/             # Kubernetes manifests
│   ├── terraform/       # Terraform configs
│   └── nginx/           # Nginx configs
├── scripts/             # Utility scripts
├── tests/               # Integration tests
└── docs/                # Documentation
```

## 🔧 Configuration

### Backend Configuration

Edit `packages/backend/.env`:

```env
# Required
GEMINI_API_KEY=your_api_key_here
DATABASE_URL=postgresql://user:pass@localhost:5432/bil
JWT_SECRET=your_secret_here

# Optional
OPENAI_API_KEY=your_openai_key
REDIS_URL=redis://localhost:6379
```

### Desktop Configuration

Edit `packages/desktop/.env`:

```env
VITE_API_URL=http://localhost:3000
```

### Mobile Configuration

Edit `packages/mobile/src/config/constants.ts`:

```typescript
export const API_URL = 'http://localhost:3000';
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run backend tests
cd packages/backend
npm test

# Run desktop tests
cd packages/desktop
npm test

# Run mobile tests
cd packages/mobile
npm test
```

## 🚀 Deployment

### Deploy to Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Deploy
railway up
```

### Deploy to AWS

```bash
# Configure AWS credentials
aws configure

# Deploy with Terraform
cd infrastructure/terraform
terraform init
terraform apply
```

### Deploy with Docker

```bash
# Build images
docker-compose build

# Start services
docker-compose up -d
```

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) first.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Google Gemini** - AI capabilities
- **Electron** - Desktop framework
- **React Native** - Mobile framework
- **Expo** - Mobile development platform

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/dilyorm/bil/issues)
- **Discussions**: [GitHub Discussions](https://github.com/dilyorm/bil/discussions)
- **Email**: support@bil.example.com

## 🗺️ Roadmap

- [ ] Voice control from mobile
- [ ] Scheduled commands
- [ ] Command macros
- [ ] Multi-language support
- [ ] Cloud sync
- [ ] Plugin system
- [ ] Web interface

## ⭐ Star History

[![Star History Chart](https://api.star-history.com/svg?repos=dilyorm/bil&type=Date)](https://star-history.com/#dilyorm/bil&Date)

---

**Made with ❤️ by the BIL Team**
