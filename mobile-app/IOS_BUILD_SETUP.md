# INDEXUS Connect - iOS Build Setup (macOS)

This guide explains how to build the INDEXUS Connect mobile app for iOS on macOS.

> **Important:** The same source code (`mobile-app/`) is used for both Android and iOS. No separate iOS codebase is needed — Expo/React Native handles both platforms from a single codebase.

## Prerequisites

- **macOS 13 (Ventura)** or newer (macOS 14 Sonoma recommended)
- **Xcode 15+** installed from the Mac App Store
- **Apple Developer Account** ($99/year) — https://developer.apple.com
- At least **16GB RAM** (8GB minimum)
- At least **30GB free disk space**
- **Node.js 20+** installed (via Homebrew: `brew install node`)

## Step-by-Step Build Guide

### Step 1: Install Xcode & Command Line Tools

```bash
# Install Xcode from Mac App Store (if not already installed)
# https://apps.apple.com/app/xcode/id497799835

# Install command line tools
sudo xcode-select --install

# Accept license
sudo xcodebuild -license accept

# Verify
xcodebuild -version
# Expected: Xcode 15.x or 16.x
```

### Step 2: Install CocoaPods

```bash
sudo gem install cocoapods
pod --version
# Expected: 1.14.x or newer
```

### Step 3: Install Node.js & EAS CLI

```bash
# Install Node.js via Homebrew (if not installed)
brew install node

# Install EAS CLI globally
npm install -g eas-cli

# Verify
node --version   # Expected: v20.x
eas --version    # Expected: 5.x or newer
```

### Step 4: Clone the Project

```bash
# Clone the repository
git clone https://PeterSem16:github_pat_TOKEN@github.com/PeterSem16/indexus-crm.git
cd indexus-crm/mobile-app

# Install dependencies
npm install
```

### Step 5: Configure Apple Developer Account

#### 5a. Log in to EAS

```bash
eas login
# Enter your Expo account credentials
```

#### 5b. Configure Apple Signing

For **Ad Hoc** distribution (internal testing — install via link):

```bash
# EAS will guide you through Apple Developer Portal setup
# You'll need:
#   - Apple ID
#   - Apple Developer Team ID
#   - App-specific password (generate at appleid.apple.com)

eas credentials --platform ios
```

This will:
- Create a Distribution Certificate (if needed)
- Create a Provisioning Profile (Ad Hoc)
- Register the app's Bundle ID: `com.cordbloodcenter.indexusconnect`

#### 5c. Register Test Devices (Ad Hoc only)

For Ad Hoc distribution, each iPhone/iPad must have its UDID registered:

```bash
# Option 1: Register devices via EAS
eas device:create

# Option 2: Register manually in Apple Developer Portal
# Go to: https://developer.apple.com/account/resources/devices/list
# Add each device's UDID
```

**How to find a device's UDID:**
1. Connect iPhone to Mac via USB
2. Open **Finder** (macOS 10.15+) or **iTunes** (older macOS)
3. Click the device, click on the serial number until UDID appears
4. Right-click and copy

### Step 6: Build the IPA

#### Option A: Using the Build Script (Recommended)

```bash
# For simulator testing (no signing needed):
./build-ios.sh simulator

# For Ad Hoc / internal testing (requires signing):
./build-ios.sh preview

# For App Store submission:
./build-ios.sh production
```

#### Option B: Using EAS Directly

```bash
# Simulator build (no Apple account needed)
npx eas build --platform ios --profile development --local

# Ad Hoc IPA (requires Apple Developer account)
npx eas build --platform ios --profile preview --local

# App Store IPA
npx eas build --platform ios --profile production --local
```

#### Option C: Cloud Build (Expo Servers)

If local build fails or you prefer cloud builds:

```bash
# Cloud build (code uploaded to Expo servers)
npx eas build --platform ios --profile preview

# This builds on Expo's servers — no Xcode needed
# But requires an Expo account and uses build credits
```

### Step 7: Deploy the IPA

#### For OTA Installation (Ad Hoc):

```bash
# Copy IPA to the server
./deploy-ipa.sh
```

This creates:
- `/var/www/indexus-crm/data/mobil-app/indexus-connect-latest.ipa`
- `/var/www/indexus-crm/data/mobil-app/indexus-connect-ios-manifest.plist`

Users can then install by opening this URL in Safari on their iPhone:
```
itms-services://?action=download-manifest&url=https://indexus.cordbloodcenter.com/data/mobil-app/indexus-connect-ios-manifest.plist
```

#### For App Store:

```bash
# Submit to App Store via EAS
eas submit --platform ios --profile production

# Or upload manually via Transporter app on macOS
```

## Build Profiles Summary

| Profile | Command | Output | Signing | Use Case |
|---------|---------|--------|---------|----------|
| simulator | `./build-ios.sh simulator` | .app | None | Testing in Xcode Simulator |
| preview | `./build-ios.sh preview` | .ipa | Ad Hoc | Internal testing on real devices |
| production | `./build-ios.sh production` | .ipa | App Store | App Store submission |

## Nginx Configuration (for OTA Downloads)

Add to your Nginx server config to serve the IPA correctly:

```nginx
location /data/mobil-app/ {
    alias /var/www/indexus-crm/data/mobil-app/;
    
    # MIME types for iOS OTA installation
    types {
        application/octet-stream ipa;
        text/xml plist;
    }
    
    # Allow CORS for OTA
    add_header Access-Control-Allow-Origin *;
}
```

## Troubleshooting

### "No signing certificate found"

```bash
# Re-configure credentials
eas credentials --platform ios

# Or manually in Apple Developer Portal:
# 1. Go to Certificates, Identifiers & Profiles
# 2. Create new Distribution Certificate
# 3. Download and double-click to install in Keychain
```

### "Provisioning profile doesn't include device"

```bash
# Register the device UDID
eas device:create

# Then rebuild the provisioning profile
eas credentials --platform ios
# Select "Build Credentials" > "Provisioning Profile" > "Create new"
```

### CocoaPods install fails

```bash
cd ios
pod deintegrate
pod install --repo-update
cd ..
```

### Build fails with "Module not found"

```bash
# Clean and reinstall
rm -rf node_modules ios
npm install
npx expo prebuild --platform ios --clean
cd ios && pod install && cd ..
```

### Xcode version mismatch

```bash
# Ensure correct Xcode is selected
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
```

### Memory issues during build

Close other applications. If still failing:
```bash
# Increase Xcode build memory
defaults write com.apple.dt.XCBuild EnableSwiftBuildSystemSandbox NO
```

## Directory Structure

```
mobile-app/
├── build-android.sh          # Android build script
├── build-ios.sh              # iOS build script
├── deploy-apk.sh             # Deploy APK to server
├── deploy-ipa.sh             # Deploy IPA to server
├── scripts/
│   └── setup-android-sdk.sh  # Android SDK setup (Linux)
├── builds/                   # Output directory
├── eas.json                  # EAS build configuration (Android + iOS)
├── app.json                  # Expo app configuration (both platforms)
├── LOCAL_BUILD_SETUP.md      # Android build guide
└── IOS_BUILD_SETUP.md        # This file (iOS build guide)
```

## Quick Reference: Complete iOS Build Flow

```bash
# 1. Clone & setup (one-time)
git clone <repo-url>
cd indexus-crm/mobile-app
npm install
npm install -g eas-cli
eas login

# 2. Configure signing (one-time)
eas credentials --platform ios
eas device:create  # Register test devices

# 3. Build
./build-ios.sh preview

# 4. Deploy
./deploy-ipa.sh

# 5. Install on iPhone
# Open in Safari: itms-services://?action=download-manifest&url=https://indexus.cordbloodcenter.com/data/mobil-app/indexus-connect-ios-manifest.plist
```
