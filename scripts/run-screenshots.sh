#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Daily screenshot capture script.
#
# Run manually:
#   bash scripts/run-screenshots.sh
#
# Set up as cron (every day at 6:00 AM):
#   crontab -e
#   0 6 * * * cd /path/to/super-tools && bash scripts/run-screenshots.sh >> /tmp/screenshots.log 2>&1
#
# Required: Node.js 18+, npx, and Playwright chromium installed.
# First-time setup:
#   npm install
#   npx playwright install chromium
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

# ── Load env vars from .env.screenshots if it exists ─────────────────────────
ENV_FILE="$PROJECT_DIR/.env.screenshots"
if [ -f "$ENV_FILE" ]; then
  echo "Loading config from $ENV_FILE"
  set -a
  source "$ENV_FILE"
  set +a
else
  echo "⚠️  No .env.screenshots file found. Create it with:"
  echo ""
  echo "    APP_URL=https://your-app-url.com"
  echo "    SUPABASE_URL=https://xxx.supabase.co"
  echo "    SUPABASE_SERVICE_ROLE_KEY=eyJ..."
  echo "    SCREENSHOT_USER_EMAIL=admin@example.com"
  echo ""
  echo "Or set these as environment variables."
fi

# ── Validate required vars ───────────────────────────────────────────────────
for var in APP_URL SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY SCREENSHOT_USER_EMAIL; do
  if [ -z "${!var:-}" ]; then
    echo "❌ Missing required env var: $var"
    exit 1
  fi
done

# ── Run the screenshot script ────────────────────────────────────────────────
echo "🚀 Starting daily screenshots — $(date '+%Y-%m-%d %H:%M:%S')"
npx tsx scripts/daily-screenshots.ts
echo "✅ Done — $(date '+%Y-%m-%d %H:%M:%S')"
