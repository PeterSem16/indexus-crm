#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

DEST_DIR="/var/www/indexus-crm/data/mobil-app"
DEST_FILE="$DEST_DIR/indexus-connect.apk"

LATEST_APK=$(ls -t builds/*.apk 2>/dev/null | head -n 1)

if [ -z "$LATEST_APK" ]; then
    echo "ERROR: No APK found in builds/ directory"
    echo "Run ./build-android.sh preview first"
    exit 1
fi

echo "Deploying APK..."
echo "  Source: $LATEST_APK"
echo "  Destination: $DEST_FILE"

mkdir -p "$DEST_DIR"

cp -f "$LATEST_APK" "$DEST_FILE"

echo ""
echo "Done! APK deployed to: $DEST_FILE"
echo "Size: $(du -h "$DEST_FILE" | cut -f1)"
