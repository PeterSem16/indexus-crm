#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=============================================="
echo "INDEXUS Connect - Deploy IPA"
echo "=============================================="
echo ""

DEPLOY_DIR="/var/www/indexus-crm/data/mobil-app"

LATEST_IPA=$(ls -t builds/*.ipa 2>/dev/null | head -n 1)

if [ -z "$LATEST_IPA" ]; then
    echo "ERROR: No IPA file found in builds/ directory."
    echo ""
    echo "Build first:"
    echo "  ./build-ios.sh preview"
    echo ""
    exit 1
fi

echo "Source: $LATEST_IPA"
echo "Size: $(du -h "$LATEST_IPA" | cut -f1)"
echo "Destination: $DEPLOY_DIR/indexus-connect-latest.ipa"
echo ""

if [ ! -d "$DEPLOY_DIR" ]; then
    echo "Creating deployment directory..."
    sudo mkdir -p "$DEPLOY_DIR"
    sudo chown www-data:www-data "$DEPLOY_DIR"
fi

sudo cp "$LATEST_IPA" "$DEPLOY_DIR/indexus-connect-latest.ipa"
sudo chmod 644 "$DEPLOY_DIR/indexus-connect-latest.ipa"

VERSION=$(grep '"version"' app.json | head -1 | cut -d'"' -f4)

cat > /tmp/indexus-connect-ios-manifest.plist << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>items</key>
    <array>
        <dict>
            <key>assets</key>
            <array>
                <dict>
                    <key>kind</key>
                    <string>software-package</string>
                    <key>url</key>
                    <string>https://indexus.cordbloodcenter.com/data/mobil-app/indexus-connect-latest.ipa</string>
                </dict>
            </array>
            <key>metadata</key>
            <dict>
                <key>bundle-identifier</key>
                <string>com.cordbloodcenter.indexusconnect</string>
                <key>bundle-version</key>
                <string>${VERSION}</string>
                <key>kind</key>
                <string>software</string>
                <key>title</key>
                <string>INDEXUS Connect</string>
            </dict>
        </dict>
    </array>
</dict>
</plist>
PLIST

sudo cp /tmp/indexus-connect-ios-manifest.plist "$DEPLOY_DIR/indexus-connect-ios-manifest.plist"
sudo chmod 644 "$DEPLOY_DIR/indexus-connect-ios-manifest.plist"

echo ""
echo "=============================================="
echo "Deployment Complete!"
echo "=============================================="
echo ""
echo "Files deployed:"
echo "  - $DEPLOY_DIR/indexus-connect-latest.ipa"
echo "  - $DEPLOY_DIR/indexus-connect-ios-manifest.plist"
echo ""
echo "OTA Install URL (for Safari on iOS):"
echo "  itms-services://?action=download-manifest&url=https://indexus.cordbloodcenter.com/data/mobil-app/indexus-connect-ios-manifest.plist"
echo ""
echo "NOTE: OTA installation requires:"
echo "  1. A valid Apple Enterprise or Ad Hoc provisioning profile"
echo "  2. The device UDID must be registered (for Ad Hoc)"
echo "  3. HTTPS with a valid SSL certificate on the server"
echo ""
echo "Done!"
