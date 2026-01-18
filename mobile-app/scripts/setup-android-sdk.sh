#!/bin/bash
set -e

echo "=============================================="
echo "INDEXUS Connect - Android SDK Setup for Ubuntu"
echo "=============================================="
echo ""

ANDROID_SDK_ROOT="$HOME/android-sdk"
CMDLINE_TOOLS_VERSION="11076708"
BUILD_TOOLS_VERSION="34.0.0"
PLATFORM_VERSION="34"

if [ -f /etc/os-release ]; then
    . /etc/os-release
    echo "Detected OS: $NAME $VERSION"
else
    echo "Warning: Could not detect OS version"
fi

echo ""
echo "Step 1: Installing system dependencies..."
echo "----------------------------------------"
sudo apt-get update
sudo apt-get install -y \
    openjdk-17-jdk \
    unzip \
    wget \
    curl \
    git \
    build-essential \
    file

JAVA_HOME_PATH=$(dirname $(dirname $(readlink -f $(which java))))
echo "Java installed at: $JAVA_HOME_PATH"

echo ""
echo "Step 2: Setting up Android SDK..."
echo "----------------------------------"

mkdir -p "$ANDROID_SDK_ROOT/cmdline-tools"

if [ ! -f "$ANDROID_SDK_ROOT/cmdline-tools/latest/bin/sdkmanager" ]; then
    echo "Downloading Android Command Line Tools..."
    cd /tmp
    rm -rf cmdline-tools cmdline-tools.zip
    wget -q "https://dl.google.com/android/repository/commandlinetools-linux-${CMDLINE_TOOLS_VERSION}_latest.zip" -O cmdline-tools.zip
    unzip -q cmdline-tools.zip
    
    rm -rf "$ANDROID_SDK_ROOT/cmdline-tools/latest"
    mkdir -p "$ANDROID_SDK_ROOT/cmdline-tools/latest"
    mv cmdline-tools/* "$ANDROID_SDK_ROOT/cmdline-tools/latest/"
    
    rm -rf cmdline-tools cmdline-tools.zip
    
    if [ ! -f "$ANDROID_SDK_ROOT/cmdline-tools/latest/bin/sdkmanager" ]; then
        echo "ERROR: Failed to install Android Command Line Tools"
        echo "Expected: $ANDROID_SDK_ROOT/cmdline-tools/latest/bin/sdkmanager"
        exit 1
    fi
    
    echo "Command Line Tools installed."
else
    echo "Command Line Tools already installed."
fi

export ANDROID_HOME="$ANDROID_SDK_ROOT"
export ANDROID_SDK_ROOT="$ANDROID_SDK_ROOT"
export PATH="$PATH:$ANDROID_SDK_ROOT/cmdline-tools/latest/bin:$ANDROID_SDK_ROOT/platform-tools:$ANDROID_SDK_ROOT/build-tools/$BUILD_TOOLS_VERSION"

echo ""
echo "Step 3: Installing SDK packages..."
echo "-----------------------------------"

yes | "$ANDROID_SDK_ROOT/cmdline-tools/latest/bin/sdkmanager" --licenses > /dev/null 2>&1 || true

"$ANDROID_SDK_ROOT/cmdline-tools/latest/bin/sdkmanager" \
    "platform-tools" \
    "platforms;android-$PLATFORM_VERSION" \
    "build-tools;$BUILD_TOOLS_VERSION" \
    "ndk;26.1.10909125"

echo ""
echo "Step 4: Configuring environment variables..."
echo "---------------------------------------------"

ENV_FILE="$HOME/.indexus-android-env"
cat > "$ENV_FILE" << EOF
export JAVA_HOME="$JAVA_HOME_PATH"
export ANDROID_HOME="$ANDROID_SDK_ROOT"
export ANDROID_SDK_ROOT="$ANDROID_SDK_ROOT"
export ANDROID_NDK_HOME="$ANDROID_SDK_ROOT/ndk/26.1.10909125"
export PATH="\$PATH:\$ANDROID_SDK_ROOT/cmdline-tools/latest/bin:\$ANDROID_SDK_ROOT/platform-tools:\$ANDROID_SDK_ROOT/build-tools/$BUILD_TOOLS_VERSION"
EOF

if ! grep -q "source $ENV_FILE" "$HOME/.bashrc" 2>/dev/null; then
    echo "" >> "$HOME/.bashrc"
    echo "# Android SDK for INDEXUS Connect" >> "$HOME/.bashrc"
    echo "source $ENV_FILE" >> "$HOME/.bashrc"
fi

if ! grep -q "source $ENV_FILE" "$HOME/.profile" 2>/dev/null; then
    echo "" >> "$HOME/.profile"
    echo "# Android SDK for INDEXUS Connect" >> "$HOME/.profile"
    echo "source $ENV_FILE" >> "$HOME/.profile"
fi

echo ""
echo "Step 5: Verifying installation..."
echo "----------------------------------"

if [ -f "$ANDROID_SDK_ROOT/cmdline-tools/latest/bin/sdkmanager" ]; then
    echo "sdkmanager: OK"
else
    echo "sdkmanager: MISSING"
    exit 1
fi

if [ -d "$ANDROID_SDK_ROOT/build-tools/$BUILD_TOOLS_VERSION" ]; then
    echo "build-tools: OK"
else
    echo "build-tools: MISSING"
    exit 1
fi

if [ -d "$ANDROID_SDK_ROOT/platforms/android-$PLATFORM_VERSION" ]; then
    echo "platform: OK"
else
    echo "platform: MISSING"
    exit 1
fi

echo ""
echo "=============================================="
echo "Setup Complete!"
echo "=============================================="
echo ""
echo "Environment variables saved to: $ENV_FILE"
echo ""
echo "To use immediately, run:"
echo "  source $ENV_FILE"
echo ""
echo "Or start a new terminal session."
echo ""
echo "Installed components:"
echo "  - Java JDK 17: $JAVA_HOME_PATH"
echo "  - Android SDK: $ANDROID_SDK_ROOT"
echo "  - Build Tools: $BUILD_TOOLS_VERSION"
echo "  - Platform: android-$PLATFORM_VERSION"
echo "  - NDK: 26.1.10909125"
echo ""
echo "You can now run local builds with:"
echo "  cd mobile-app && ./build-android.sh"
echo ""
