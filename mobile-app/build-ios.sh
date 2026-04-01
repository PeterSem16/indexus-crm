#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=============================================="
echo "INDEXUS Connect - iOS Local Build"
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

BUILD_TYPE="${1:-preview}"

case $BUILD_TYPE in
    simulator)
        PROFILE="development"
        OUTPUT_DESC="Simulator build (testing)"
        ;;
    preview)
        PROFILE="preview"
        OUTPUT_DESC="IPA (internal testing / Ad Hoc)"
        ;;
    production)
        PROFILE="production"
        OUTPUT_DESC="IPA (App Store)"
        ;;
    *)
        echo "Usage: ./build-ios.sh [simulator|preview|production]"
        echo ""
        echo "  simulator  - Build for iOS Simulator (no signing needed)"
        echo "  preview    - Build IPA for internal testing (Ad Hoc)"
        echo "  production - Build IPA for App Store submission"
        echo ""
        exit 1
        ;;
esac

echo "Build configuration:"
echo "  Profile: $PROFILE"
echo "  Output: $OUTPUT_DESC"
echo ""

if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
    echo ""
fi

if ! command -v pod &> /dev/null; then
    echo "Installing CocoaPods..."
    sudo gem install cocoapods
    echo ""
fi

echo "Starting local build..."
echo "This may take 15-45 minutes depending on your hardware."
echo ""

npx eas build --platform ios --profile "$PROFILE" --local --non-interactive

echo ""
echo "=============================================="
echo "Build Complete!"
echo "=============================================="
echo ""

OUTPUT_FILE=""

for search_dir in "." "./dist" "./ios/build"; do
    if [ -d "$search_dir" ]; then
        if [ "$BUILD_TYPE" = "simulator" ]; then
            FOUND=$(find "$search_dir" -maxdepth 5 -name "*.app" -type d 2>/dev/null | head -n 1)
        else
            FOUND=$(find "$search_dir" -maxdepth 5 -name "*.ipa" -type f 2>/dev/null | head -n 1)
        fi
        if [ -n "$FOUND" ]; then
            OUTPUT_FILE="$FOUND"
            break
        fi
    fi
done

if [ -n "$OUTPUT_FILE" ]; then
    echo "Output file: $OUTPUT_FILE"
    if [ -f "$OUTPUT_FILE" ]; then
        echo "Size: $(du -h "$OUTPUT_FILE" | cut -f1)"
    fi
    echo ""

    mkdir -p builds
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    VERSION=$(grep '"version"' app.json | head -1 | cut -d'"' -f4)
    
    if [ "$BUILD_TYPE" = "simulator" ]; then
        NEW_NAME="builds/indexus-connect-v${VERSION}-${TIMESTAMP}-simulator.app"
        cp -r "$OUTPUT_FILE" "$NEW_NAME"
    else
        EXT="ipa"
        NEW_NAME="builds/indexus-connect-v${VERSION}-${TIMESTAMP}.${EXT}"
        cp "$OUTPUT_FILE" "$NEW_NAME"
    fi
    echo "Copied to: $NEW_NAME"
else
    echo "Warning: Could not locate output file automatically."
    echo "Check the build output above for the file location."
fi

echo ""
echo "Done!"
