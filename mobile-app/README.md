# INDEXUS Connect Mobile Application

React Native (Expo) mobile application for field representatives (collaborators) to manage hospital visits, track GPS location, and record voice notes.

## Prerequisites

- Node.js 18+
- Expo CLI: `npm install -g expo-cli`
- iOS Simulator (Mac) or Android Emulator
- Expo Go app on your physical device (optional)

## Getting Started

1. Install dependencies:
```bash
cd mobile-app
npm install
```

2. Start the development server:
```bash
npm start
```

3. Run on device/emulator:
- Press `i` for iOS Simulator
- Press `a` for Android Emulator
- Scan QR code with Expo Go app on your phone

## Project Structure

```
mobile-app/
├── app/                    # Expo Router screens
│   ├── (auth)/            # Authentication screens
│   ├── (tabs)/            # Main tab navigation
│   └── visit/             # Visit detail screens
├── components/
│   └── ui/                # Reusable UI components
├── lib/                   # Core utilities
│   ├── api.ts             # API client with JWT
│   └── auth.ts            # Authentication helpers
├── stores/                # Zustand state stores
├── hooks/                 # Custom React hooks
├── i18n/                  # Translations (7 languages)
├── constants/             # App configuration
└── assets/                # Images and icons
```

## Features

- Multi-language support (SK, CZ, HU, DE, IT, RO, EN)
- JWT-based authentication with secure token storage
- Offline-first architecture (coming soon)
- GPS tracking during visits
- Voice note recording with transcription
- Push notifications

## API Endpoints

The app connects to the INDEXUS CRM backend:
- Production: `https://indexus.cordbloodcenter.com`

All mobile endpoints require JWT Bearer token authentication:
- `POST /api/mobile/auth/login`
- `GET /api/mobile/auth/verify`
- `GET /api/mobile/hospitals`
- `GET/POST /api/mobile/visit-events`
- `POST /api/mobile/voice-notes`

## Building for Production

```bash
# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android
```

## License

Proprietary - Cord Blood Center Europe
