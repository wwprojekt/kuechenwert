#!/bin/bash
# =============================================================================
# Stop Hook: Build-Check bevor der Agent aufhören darf
# Wenn der Build fehlschlägt, MUSS der Agent den Fehler beheben.
# =============================================================================

cd "$OPENHANDS_PROJECT_DIR"

echo "🔍 Running build check before stop..."

# 1. TypeScript-Check
if ! npx tsc --noEmit 2>&1; then
    echo '{"decision": "deny", "reason": "TypeScript-Fehler gefunden. Bitte behebe alle TypeScript-Fehler bevor du aufhörst."}'
    exit 2
fi

# 2. Production Build
if ! npm run build 2>&1; then
    echo '{"decision": "deny", "reason": "Build fehlgeschlagen. Bitte behebe den Build-Fehler bevor du aufhörst."}'
    exit 2
fi

echo "✅ Build check passed."
exit 0
