#!/bin/bash
# PRISM — SessionStart hook for Claude Code on the web.
# Installs dependencies for the backend, frontend, and Anchor workspace so
# tests and linters are ready to run. Safe to re-run (idempotent).
set -euo pipefail

# Only run in the remote (web) environment; local devs manage their own setup.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
cd "$ROOT"

# Prisma's schema references DATABASE_URL; provide a placeholder so
# `prisma generate` and engine tests work without a live database.
export DATABASE_URL="${DATABASE_URL:-postgresql://prism:prism@localhost:5432/prism}"

# Retry npm install — package/binary downloads through the egress proxy can
# reset on the first attempt. Extra npm flags may be passed after the dir.
install_pkg() {
  local dir="$1"; shift
  [ -f "$dir/package.json" ] || return 0
  local attempt
  for attempt in 1 2 3; do
    echo "==> npm install ($dir) [attempt $attempt]"
    if npm install --prefix "$dir" --no-audit --no-fund "$@"; then
      return 0
    fi
    echo "    install failed, retrying in $((attempt * 5))s…"
    sleep $((attempt * 5))
  done
  echo "    ERROR: npm install failed for $dir after 3 attempts" >&2
  return 1
}

# Backend: the egress policy blocks the Prisma engine binary download
# (binaries.prisma.sh resets), so install without lifecycle scripts. This still
# provides everything the engine tests (vitest) and the linter (eslint) need.
install_pkg backend --ignore-scripts
install_pkg frontend
install_pkg programs

# Generate the Prisma client (best-effort: needs the engine binary, which the
# egress proxy may block — don't fail the session if it can't download).
if [ -f backend/prisma/schema.prisma ]; then
  echo "==> prisma generate (backend, best-effort)"
  npm --prefix backend exec -- prisma generate || \
    echo "    NOTE: prisma generate skipped (engine download blocked by egress policy)"
fi

# Persist DATABASE_URL for the session so backend tooling can read it.
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo "export DATABASE_URL=\"$DATABASE_URL\"" >> "$CLAUDE_ENV_FILE"
fi

echo "==> PRISM session setup complete"
