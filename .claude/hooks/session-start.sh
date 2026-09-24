#!/bin/bash
set -euo pipefail

# Uniquement pour les sessions Claude Code web — en local chacun gère ses deps.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# Idempotent. npm install (plutôt que ci) profite du cache du conteneur.
npm install --no-audit --no-fund

# Orchestrateur bmad-loop (BMAD). Le conteneur est éphémère : réinstaller si absent.
export PATH="$HOME/.local/bin:$PATH"
if command -v uv >/dev/null && ! command -v bmad-loop >/dev/null; then
  uv tool install "bmad-loop[tui] @ git+https://github.com/bmad-code-org/bmad-loop.git@v0.12.0" >/dev/null 2>&1 || true
fi
