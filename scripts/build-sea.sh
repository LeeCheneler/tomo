#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

NODE_VERSION="$(node -e 'console.log(process.version)')"
ARCH="$(uname -m)"
OS="$(uname -s | tr '[:upper:]' '[:lower:]')"

case "$ARCH" in
  arm64|aarch64) ARCH="arm64" ;;
  x86_64)        ARCH="x64" ;;
esac

case "$OS" in
  darwin) PLATFORM="darwin" ;;
  linux)  PLATFORM="linux" ;;
  *)      echo "Unsupported OS: $OS" && exit 1 ;;
esac

TARBALL="node-${NODE_VERSION}-${PLATFORM}-${ARCH}"
CACHE_DIR="/tmp/tomo-sea-cache"
NODE_BIN="${CACHE_DIR}/${TARBALL}/bin/node"

# Download official Node binary (has SEA fuse) if not cached
if [[ ! -f "$NODE_BIN" ]]; then
  echo "Downloading official Node ${NODE_VERSION} binary..."
  mkdir -p "$CACHE_DIR"
  curl -sL "https://nodejs.org/dist/${NODE_VERSION}/${TARBALL}.tar.gz" \
    | tar -xz -C "$CACHE_DIR" "${TARBALL}/bin/node"
fi

# Bundle the app
pnpm build

# Write sea-config with the official node binary path
cat > sea-config.json << EOF
{
  "main": "dist/tomo.js",
  "mainFormat": "module",
  "executable": "${NODE_BIN}",
  "output": "tomo",
  "disableExperimentalSEAWarning": true
}
EOF

# Build SEA — copies executable, generates blob, injects, all in one step
node --build-sea sea-config.json

# Codesign on macOS
if [[ "$PLATFORM" == "darwin" ]]; then
  codesign --sign - tomo
fi

echo "SEA binary built: ./tomo"
