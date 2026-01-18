# INDEXUS Connect - Local Android Build Setup

This guide explains how to build the INDEXUS Connect mobile app locally on Ubuntu without using Expo's cloud build service.

## Prerequisites

- Ubuntu 20.04, 22.04, or 24.04 (or compatible Linux distribution)
- At least 8GB RAM (16GB recommended)
- At least 20GB free disk space
- sudo access for package installation

## Quick Start

### 1. Run Setup Script

```bash
cd mobile-app
chmod +x scripts/setup-android-sdk.sh
./scripts/setup-android-sdk.sh
```

This script will:
- Install OpenJDK 17
- Download and configure Android SDK
- Install Android Build Tools 34.0.0
- Install Android Platform 34
- Install Android NDK 26.1.10909125
- Configure environment variables

### 2. Apply Environment Variables

After setup, either:
- Start a new terminal session, OR
- Run: `source ~/.indexus-android-env`

### 3. Build the App

```bash
chmod +x build-android.sh
./build-android.sh preview    # For APK (testing)
./build-android.sh production # For AAB (Play Store)
```

## Build Outputs

- **Preview builds**: Creates `.apk` file in `builds/` directory
- **Production builds**: Creates `.aab` file in `builds/` directory

Files are named: `indexus-connect-v{VERSION}-{TIMESTAMP}.apk`

## Build Profiles

| Profile | Command | Output | Use Case |
|---------|---------|--------|----------|
| preview | `./build-android.sh preview` | APK | Internal testing, direct install |
| production | `./build-android.sh production` | AAB | Google Play Store upload |

## Manual EAS Commands

If you prefer to run EAS directly:

```bash
# Preview APK (local build)
npx eas build --platform android --profile preview --local

# Production AAB (local build)
npx eas build --platform android --profile production --local

# Cloud builds (if you prefer Expo servers)
npx eas build --platform android --profile preview
npx eas build --platform android --profile production
```

## Troubleshooting

### "ANDROID_HOME is not set"

Run the setup script or manually set:
```bash
source ~/.indexus-android-env
```

### "Java version too low"

Ensure Java 17 is the default:
```bash
sudo update-alternatives --config java
# Select Java 17
```

### Build fails with NDK errors

Re-run SDK manager:
```bash
$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager "ndk;26.1.10909125"
```

### Gradle memory issues

For systems with limited RAM, add to `~/.gradle/gradle.properties`:
```
org.gradle.jvmargs=-Xmx4g -XX:MaxMetaspaceSize=512m
org.gradle.daemon=false
```

### sdkmanager not found

The setup script verifies installation. If this error occurs:
```bash
# Check if the path is correct
ls -la $ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager

# Re-run setup if needed
rm -rf ~/android-sdk/cmdline-tools
./scripts/setup-android-sdk.sh
```

## Directory Structure

```
mobile-app/
├── build-android.sh          # Main build script
├── scripts/
│   └── setup-android-sdk.sh  # One-time setup script
├── builds/                   # Output directory (created on first build)
├── eas.json                  # EAS build configuration
└── LOCAL_BUILD_SETUP.md      # This file
```

## Comparison: Local vs Cloud Builds

| Aspect | Local Build | Cloud Build (EAS) |
|--------|-------------|-------------------|
| Speed | Depends on your hardware | Consistent (~15 min) |
| Cost | Free | Free tier: 30 builds/month |
| Privacy | Code stays on your server | Code uploaded to Expo |
| Dependencies | Requires Android SDK setup | None |
| Reliability | Depends on your setup | Managed by Expo |

## iOS Builds

Local iOS builds require:
- macOS with Xcode installed
- Apple Developer account
- Provisioning profiles and certificates

For iOS, cloud builds via EAS are typically easier:
```bash
npx eas build --platform ios --profile preview
```
