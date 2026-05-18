#!/usr/bin/env bash
set -e

echo ">>> Step 1: Install pnpm globally"
npm install -g pnpm@9 --no-fund --no-audit

echo ">>> Step 2: Install workspace dependencies"
pnpm install --no-frozen-lockfile

echo ">>> Step 3: Build API server"
pnpm --filter @workspace/api-server run build

echo ">>> Build complete!"
