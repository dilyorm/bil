# BIL Mobile Application

React Native mobile application for the BIL Core System, built with Expo.

## Features

- Cross-platform support (iOS and Android)
- Navigation with React Navigation
- Authentication with secure token storage
- Voice interaction capabilities
- Real-time synchronization across devices
- Device management
- Settings and preferences

## Development

### Prerequisites

- Node.js 18+
- Expo CLI
- iOS Simulator (for iOS development)
- Android Studio/Emulator (for Android development)

### Getting Started

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Run on specific platforms:
```bash
npm run ios     # iOS simulator
npm run android # Android emulator
npm run web     # Web browser
```

### Scripts

- `npm run dev` - Start Expo development server
- `npm run start` - Start with cache cleared
- `npm run ios` - Run on iOS simulator
- `npm run android` - Run on Android emulator
- `npm run web` - Run in web browser
- `npm run build` - Build for production
- `npm run test` - Run tests
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking

### Project Structure

```
src/
├── navigation/          # Navigation configuration
├── screens/            # Screen components
│   ├── auth/          # Authentication screens
│   └── main/          # Main app screens
├── hooks/             # Custom React hooks
├── theme/             # Theme and styling
└── test/              # Test configuration
```

### Testing

Run tests with:
```bash
npm test
```

For watch mode:
```bash
npm run test:watch
```

### Building

For production builds, use Expo Application Services (EAS):

```bash
# Android
npm run build:android

# iOS
npm run build:ios
```

## Architecture

The mobile app follows a modular architecture with:

- **Navigation**: React Navigation for screen management
- **State Management**: React hooks and context
- **Authentication**: Expo SecureStore for token storage
- **Voice**: Expo AV and Speech for voice interaction
- **Real-time**: Socket.io for device synchronization
- **Styling**: Custom theme system with TypeScript

## Dependencies

### Core
- React Native with Expo
- React Navigation
- TypeScript

### Features
- Expo SecureStore (authentication)
- Expo AV (voice recording)
- Expo Speech (text-to-speech)
- Socket.io (real-time sync)

### Development
- Jest (testing)
- ESLint (linting)
- TypeScript (type checking)