#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=============================================="
echo "INDEXUS Connect - Android Local Build"
echo "=============================================="
echo ""

if [ -f "$HOME/.indexus-android-env" ]; then
    source "$HOME/.indexus-android-env"
fi

if [ -z "$ANDROID_HOME" ]; then
    echo "ERROR: ANDROID_HOME is not set."
    echo ""
    echo "Please run the setup script first:"
    echo "  ./scripts/setup-android-sdk.sh"
    echo ""
    exit 1
fi

if ! command -v java &> /dev/null; then
    echo "ERROR: Java is not installed."
    echo ""
    echo "Please run the setup script first:"
    echo "  ./scripts/setup-android-sdk.sh"
    echo ""
    exit 1
fi

JAVA_VERSION=$(java -version 2>&1 | head -n 1 | cut -d'"' -f2 | cut -d'.' -f1)
if [ "$JAVA_VERSION" -lt 17 ]; then
    echo "ERROR: Java 17 or higher is required. Found Java $JAVA_VERSION."
    exit 1
fi

echo "Environment check passed:"
echo "  ANDROID_HOME: $ANDROID_HOME"
echo "  JAVA_HOME: $JAVA_HOME"
echo "  Java version: $JAVA_VERSION"
echo ""

BUILD_TYPE="${1:-preview}"

case $BUILD_TYPE in
    preview)
        PROFILE="preview"
        OUTPUT_DESC="APK (internal testing)"
        EXT="apk"
        ;;
    production)
        PROFILE="production"
        OUTPUT_DESC="AAB (Play Store)"
        EXT="aab"
        ;;
    *)
        echo "Usage: ./build-android.sh [preview|production]"
        echo ""
        echo "  preview    - Build APK for internal testing (default)"
        echo "  production - Build AAB for Play Store"
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

echo "Starting local build..."
echo "This may take 10-30 minutes depending on your hardware."
echo ""

npx eas build --platform android --profile "$PROFILE" --local --non-interactive

echo ""
echo "=============================================="
echo "Build Complete!"
echo "=============================================="
echo ""

OUTPUT_FILE=""

for search_dir in "." "./dist" "./android/app/build/outputs/apk" "./android/app/build/outputs/bundle"; do
    if [ -d "$search_dir" ]; then
        FOUND=$(find "$search_dir" -maxdepth 3 -name "*.${EXT}" -type f 2>/dev/null | head -n 1)
        if [ -n "$FOUND" ]; then
            OUTPUT_FILE="$FOUND"
            break
        fi
    fi
done

if [ -n "$OUTPUT_FILE" ]; then
    echo "Output file: $OUTPUT_FILE"
    echo "Size: $(du -h "$OUTPUT_FILE" | cut -f1)"
    echo ""
    
    mkdir -p builds
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    VERSION=$(grep '"version"' app.json | head -1 | cut -d'"' -f4)
    NEW_NAME="builds/indexus-connect-v${VERSION}-${TIMESTAMP}.${EXT}"
    cp "$OUTPUT_FILE" "$NEW_NAME"
    echo "Copied to: $NEW_NAME"
else
    echo "Warning: Could not locate output file automatically."
    echo "Check the build output above for the file location."
    echo ""
    echo "Common locations:"
    echo "  - Current directory (*.apk or *.aab)"
    echo "  - ./android/app/build/outputs/"
fi

echo ""
echo "Done!"
