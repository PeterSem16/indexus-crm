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
        GRADLE_TASK="assembleRelease"
        OUTPUT_DESC="APK (internal testing)"
        OUTPUT_PATH="android/app/build/outputs/apk/release/app-release.apk"
        EXT="apk"
        ;;
    production)
        GRADLE_TASK="bundleRelease"
        OUTPUT_DESC="AAB (Play Store)"
        OUTPUT_PATH="android/app/build/outputs/bundle/release/app-release.aab"
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

VERSION=$(grep '"version"' app.json | head -1 | cut -d'"' -f4)
VERSION_CODE=$(grep '"versionCode"' app.json | head -1 | grep -o '[0-9]*')

echo "Build configuration:"
echo "  Type: $BUILD_TYPE"
echo "  Output: $OUTPUT_DESC"
echo "  Version: $VERSION (versionCode: $VERSION_CODE)"
echo ""

if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
    echo ""
fi

echo "Running expo prebuild..."
npx expo prebuild --platform android --clean
echo ""

echo "Starting Gradle build ($GRADLE_TASK)..."
echo "This may take 10-30 minutes depending on your hardware."
echo ""

cd android
./gradlew "$GRADLE_TASK"
cd ..

echo ""
echo "=============================================="
echo "Build Complete!"
echo "=============================================="
echo ""

if [ -f "$OUTPUT_PATH" ]; then
    echo "Output file: $OUTPUT_PATH"
    echo "Size: $(du -h "$OUTPUT_PATH" | cut -f1)"
    echo ""

    mkdir -p builds
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    NEW_NAME="builds/indexus-connect-v${VERSION}-${TIMESTAMP}.${EXT}"
    cp "$OUTPUT_PATH" "$NEW_NAME"
    echo "Copied to: $NEW_NAME"
else
    echo "Warning: Could not locate output file at $OUTPUT_PATH"
    echo "Check the build output above for errors."
fi

echo ""
echo "Done!"
