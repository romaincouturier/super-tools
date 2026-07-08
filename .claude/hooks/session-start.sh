#!/bin/bash
set -euo pipefail

# Uniquement pour les sessions Claude Code web — en local chacun gère ses deps.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# Idempotent. npm install (plutôt que ci) profite du cache du conteneur.
npm install --no-audit --no-fund
