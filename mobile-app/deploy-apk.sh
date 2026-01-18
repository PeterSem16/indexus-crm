#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

DEST_DIR="/var/www/indexus-crm/data/mobil-app"

# Get version from app.json
VERSION=$(grep '"version"' app.json | head -1 | cut -d'"' -f4)
VERSION_CODE=$(grep '"versionCode"' app.json | head -1 | grep -o '[0-9]*')

# Source APK - prefer fresh build from android directory
SOURCE_APK="android/app/build/outputs/apk/release/app-release.apk"

if [ ! -f "$SOURCE_APK" ]; then
    # Fallback to builds directory
    SOURCE_APK=$(ls -t builds/*.apk 2>/dev/null | head -n 1)
fi

if [ -z "$SOURCE_APK" ] || [ ! -f "$SOURCE_APK" ]; then
    echo "ERROR: No APK found"
    echo "Run ./build-android.sh preview first"
    exit 1
fi

# Destination filename with version
DEST_FILE="$DEST_DIR/indexus-connect-v${VERSION}.apk"

echo "Deploying APK..."
echo "  Version: $VERSION (versionCode: $VERSION_CODE)"
echo "  Source: $SOURCE_APK"
echo "  Destination: $DEST_FILE"

mkdir -p "$DEST_DIR"

# Copy with versioned name
cp -f "$SOURCE_APK" "$DEST_FILE"

# Also create a "latest" symlink for convenience
ln -sf "indexus-connect-v${VERSION}.apk" "$DEST_DIR/indexus-connect-latest.apk"

echo ""
echo "Done!"
echo "  APK: $DEST_FILE"
echo "  Latest: $DEST_DIR/indexus-connect-latest.apk"
echo "  Size: $(du -h "$DEST_FILE" | cut -f1)"
echo ""
echo "Download URL should be:"
echo "  .../mobil-app/indexus-connect-v${VERSION}.apk"
