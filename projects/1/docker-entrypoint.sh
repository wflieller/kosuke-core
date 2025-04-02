#!/bin/sh
set -e

# Print the Node.js and npm versions
echo "🚀 Node version: $(node -v)"
echo "📦 NPM version: $(npm -v)"

# Check if package.json exists in the mounted volume
if [ -f "package.json" ]; then
  echo "📋 Found package.json, installing dependencies..."
  npm install
else
  echo "❌ No package.json found in /app directory"
  exit 1
fi

# Execute the command passed to the script
echo "🚀 Starting Next.js development server..."
exec "$@" 