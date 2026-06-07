#!/usr/bin/env bash
#
# Throughline — single-command setup (SPEC §3, §11; audit M-2 / slice D1).
#
# Run once from a fresh clone, from anywhere in the repo:
#
#     ./scripts/setup.sh
#
# It installs dependencies and builds every package (shared → frontend → backend) so that:
#   - the backend runs from its compiled `dist/` under production module resolution
#     (`node dist/index.js`, not `tsx --conditions=development`), and
#   - the backend can serve the built frontend SPA from `packages/frontend/dist`.
#
# After setup, start the backend in the foreground with:
#
#     pnpm start          # = pnpm --filter @throughline/backend start = node dist/index.js
#
# then open the local address it prints (default http://127.0.0.1:47823). For login
# auto-start (launchd / systemd / Task Scheduler), see docs/install/auto-start.md — the OS
# units run the same `start` command and therefore require this build to have run first.
#
set -euo pipefail

# Resolve the repo root (this script lives in <root>/scripts/) and run from there.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "error: pnpm is not installed. Install it first: https://pnpm.io/installation" >&2
  exit 1
fi

echo "==> Installing dependencies (pnpm install)"
pnpm install

echo "==> Building all packages (pnpm -r build)"
pnpm -r build

cat <<'DONE'

Setup complete.

  Start the backend:   pnpm start
  Then open:           http://127.0.0.1:47823   (or the address it prints)
  Login auto-start:    docs/install/auto-start.md

DONE
