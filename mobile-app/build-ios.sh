#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=============================================="
echo "INDEXUS Connect - iOS Local Build (no Expo account needed)"
echo "=============================================="
echo ""

if [[ "$(uname)" != "Darwin" ]]; then
    echo "ERROR: iOS builds require macOS."
    echo ""
    echo "Please run this script on a Mac with Xcode installed."
    echo "See IOS_BUILD_SETUP.md for details."
    echo ""
    exit 1
fi

if ! command -v xcodebuild &> /dev/null; then
    echo "ERROR: Xcode is not installed."
    echo ""
    echo "Install Xcode from the Mac App Store:"
    echo "  https://apps.apple.com/app/xcode/id497799835"
    echo ""
    echo "After installation, run:"
    echo "  sudo xcode-select --install"
    echo "  sudo xcodebuild -license accept"
    echo ""
    exit 1
fi

XCODE_VERSION=$(xcodebuild -version | head -n 1)
echo "Environment check passed:"
echo "  $XCODE_VERSION"
echo "  macOS: $(sw_vers -productVersion)"
echo ""

BUILD_TYPE="${1:-simulator}"

case $BUILD_TYPE in
    simulator)
        OUTPUT_DESC="Simulator build (.app) — no signing needed"
        DESTINATION="generic/platform=iOS Simulator"
        CONFIGURATION="Debug"
        ;;
    device)
        OUTPUT_DESC="Device build (.app) — requires signing"
        DESTINATION="generic/platform=iOS"
        CONFIGURATION="Release"
        ;;
    ipa)
        OUTPUT_DESC="IPA archive — requires signing + provisioning"
        DESTINATION="generic/platform=iOS"
        CONFIGURATION="Release"
        ;;
    *)
        echo "Usage: ./build-ios.sh [simulator|device|ipa]"
        echo ""
        echo "  simulator - Build for iOS Simulator (default, no signing needed)"
        echo "  device    - Build for real device (requires Apple Developer signing)"
        echo "  ipa       - Build IPA for distribution (requires signing + provisioning)"
        echo ""
        exit 1
        ;;
esac

echo "Build configuration:"
echo "  Type: $BUILD_TYPE"
echo "  Output: $OUTPUT_DESC"
echo ""

if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
    echo ""
fi

if ! command -v pod &> /dev/null; then
    echo "CocoaPods not found. Checking Ruby version..."
    RUBY_MAJOR=$(ruby -e 'puts RUBY_VERSION.split(".")[0].to_i')
    if [ "$RUBY_MAJOR" -lt 3 ]; then
        echo ""
        echo "ERROR: Ruby $(ruby --version | head -1) is too old for CocoaPods."
        echo ""
        echo "Install Ruby 3.x+ via Homebrew first:"
        echo "  brew install ruby"
        echo '  echo '\''export PATH="/opt/homebrew/opt/ruby/bin:/opt/homebrew/lib/ruby/gems/4.0.0/bin:$PATH"'\'' >> ~/.bash_profile'
        echo "  source ~/.bash_profile"
        echo "  gem install cocoapods"
        echo ""
        exit 1
    fi
    echo "Installing CocoaPods..."
    gem install cocoapods
    echo ""
fi

echo "=============================================="
echo "Step 1: Generating native iOS project..."
echo "=============================================="
echo ""

if [ -d "ios" ]; then
    echo "Removing old ios/ directory..."
    rm -rf ios
fi

npx expo prebuild --platform ios --clean --no-install

echo ""
echo "=============================================="
echo "Step 2: Installing CocoaPods dependencies..."
echo "=============================================="
echo ""

cd ios
pod install
cd ..

echo ""
echo "=============================================="
echo "Step 3: Building with xcodebuild..."
echo "=============================================="
echo ""

WORKSPACE="ios/indexusconnect.xcworkspace"

if [ ! -d "$WORKSPACE" ]; then
    WORKSPACE=$(find ios -name "*.xcworkspace" -maxdepth 1 | head -n 1)
fi

if [ -z "$WORKSPACE" ]; then
    echo "ERROR: Could not find .xcworkspace in ios/ directory."
    echo "Contents of ios/:"
    ls -la ios/
    exit 1
fi

ALL_SCHEMES=$(xcodebuild -list -workspace "$WORKSPACE" 2>/dev/null | awk '/Schemes:/{found=1; next} found && NF{gsub(/^[ \t]+/, ""); print}')

echo "Available schemes:"
echo "$ALL_SCHEMES"
echo ""

SCHEME=$(echo "$ALL_SCHEMES" | grep -i "indexus" | head -n 1)

if [ -z "$SCHEME" ]; then
    SCHEME=$(echo "$ALL_SCHEMES" | grep -iv "boost\|hermes\|flipper\|yoga\|react\|glog\|double\|fmt\|socket\|folly" | head -n 1)
fi

if [ -z "$SCHEME" ]; then
    SCHEME="indexusconnect"
fi

echo "Workspace: $WORKSPACE"
echo "Scheme: $SCHEME"
echo "Configuration: $CONFIGURATION"
echo ""

mkdir -p builds
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
VERSION=$(grep '"version"' app.json | head -1 | cut -d'"' -f4)
DERIVED_DATA="$(pwd)/ios/DerivedData"

echo "This may take 10-30 minutes depending on your hardware..."
echo ""

if [ "$BUILD_TYPE" = "simulator" ]; then
    xcodebuild \
        -workspace "$WORKSPACE" \
        -scheme "$SCHEME" \
        -configuration "$CONFIGURATION" \
        -destination "generic/platform=iOS Simulator" \
        -derivedDataPath "$DERIVED_DATA" \
        CODE_SIGNING_ALLOWED=NO \
        build 2>&1 | tail -20

    APP_PATH=$(find "$DERIVED_DATA" -name "*.app" -path "*/Debug-iphonesimulator/*" -type d 2>/dev/null | head -n 1)

    if [ -n "$APP_PATH" ]; then
        NEW_NAME="builds/indexus-connect-v${VERSION}-${TIMESTAMP}-simulator.app"
        cp -r "$APP_PATH" "$NEW_NAME"
        echo ""
        echo "=============================================="
        echo "Build Complete!"
        echo "=============================================="
        echo ""
        echo "Output: $NEW_NAME"
        echo ""
        echo "To install in Simulator:"
        echo "  1. Open Simulator: open -a Simulator"
        echo "  2. Drag & drop the .app file onto the Simulator window"
        echo "  OR run: xcrun simctl install booted '$NEW_NAME'"
        echo ""
    else
        echo ""
        echo "Build finished. Looking for output..."
        find "$DERIVED_DATA" -name "*.app" -type d 2>/dev/null
    fi

elif [ "$BUILD_TYPE" = "device" ]; then
    xcodebuild \
        -workspace "$WORKSPACE" \
        -scheme "$SCHEME" \
        -configuration "$CONFIGURATION" \
        -destination "generic/platform=iOS" \
        -derivedDataPath "$DERIVED_DATA" \
        DEVELOPMENT_TEAM=23GFY6JMPH \
        CODE_SIGN_STYLE=Automatic \
        build 2>&1 | tail -20

    APP_PATH=$(find "$DERIVED_DATA" -name "*.app" -path "*/Release-iphoneos/*" -type d 2>/dev/null | head -n 1)

    if [ -n "$APP_PATH" ]; then
        NEW_NAME="builds/indexus-connect-v${VERSION}-${TIMESTAMP}-device.app"
        cp -r "$APP_PATH" "$NEW_NAME"
        echo ""
        echo "=============================================="
        echo "Build Complete!"
        echo "=============================================="
        echo ""
        echo "Output: $NEW_NAME"
    fi

elif [ "$BUILD_TYPE" = "ipa" ]; then
    ARCHIVE_PATH="builds/indexus-connect-v${VERSION}-${TIMESTAMP}.xcarchive"

    xcodebuild \
        -workspace "$WORKSPACE" \
        -scheme "$SCHEME" \
        -configuration "$CONFIGURATION" \
        -destination "generic/platform=iOS" \
        -archivePath "$ARCHIVE_PATH" \
        DEVELOPMENT_TEAM=23GFY6JMPH \
        CODE_SIGN_STYLE=Automatic \
        archive 2>&1 | tail -30

    if [ -d "$ARCHIVE_PATH" ]; then
        cat > /tmp/ExportOptions.plist << 'EXPORTPLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key>
    <string>ad-hoc</string>
    <key>stripSwiftSymbols</key>
    <true/>
    <key>compileBitcode</key>
    <false/>
</dict>
</plist>
EXPORTPLIST

        xcodebuild \
            -exportArchive \
            -archivePath "$ARCHIVE_PATH" \
            -exportPath "builds/" \
            -exportOptionsPlist /tmp/ExportOptions.plist 2>&1 | tail -10

        IPA_PATH=$(find builds -name "*.ipa" -newer "$ARCHIVE_PATH" 2>/dev/null | head -n 1)

        if [ -z "$IPA_PATH" ]; then
            IPA_PATH=$(find builds -name "*.ipa" 2>/dev/null | sort -t/ -k2 | tail -n 1)
        fi

        echo ""
        echo "=============================================="
        echo "Build Complete!"
        echo "=============================================="
        echo ""
        echo "Archive: $ARCHIVE_PATH"
        if [ -n "$IPA_PATH" ]; then
            echo "IPA: $IPA_PATH"
            echo "Size: $(du -h "$IPA_PATH" | cut -f1)"
        fi
    else
        echo "ERROR: Archive failed."
        exit 1
    fi
fi

echo ""
echo "Done!"
