#!/bin/bash
# =============================================================================
# CaravanWert – Pre-Commit Hook
# Läuft automatisch vor jedem git commit.
# Verhindert fehlerhafte Commits.
# =============================================================================

set -e

echo "🔍 Pre-Commit Check startet..."

# 1. TypeScript-Check (nur geänderte Dateien)
CHANGED_TS=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|tsx)$' || true)
if [ -n "$CHANGED_TS" ]; then
    echo "📝 TypeScript-Check für geänderte Dateien..."
    npx tsc --noEmit 2>&1 | tail -20
    if [ ${PIPESTATUS[0]} -ne 0 ]; then
        echo "❌ TypeScript-Fehler gefunden. Commit abgebrochen."
        exit 1
    fi
    echo "✅ TypeScript OK"
fi

# 2. ESLint (nur geänderte Dateien)
if [ -n "$CHANGED_TS" ]; then
    echo "📝 ESLint-Check für geänderte Dateien..."
    for file in $CHANGED_TS; do
        if [ -f "$file" ]; then
            npx eslint "$file" 2>&1 | tail -5 || {
                echo "❌ ESLint-Fehler in $file. Commit abgebrochen."
                exit 1
            }
        fi
    done
    echo "✅ ESLint OK"
fi

# 3. Build-Check
echo "🏗️ Build-Check..."
npm run build 2>&1 | tail -10
if [ ${PIPESTATUS[0]} -ne 0 ]; then
    echo "❌ Build fehlgeschlagen. Commit abgebrochen."
    exit 1
fi
echo "✅ Build OK"

echo "✅ Alle Pre-Commit Checks bestanden!"
