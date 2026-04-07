#!/bin/bash
# =============================================================================
# CaravanWert - OpenHands Sandbox Setup Script
# Wird automatisch bei jedem Conversation-Start ausgeführt.
# =============================================================================

set -e

echo "🔧 CaravanWert Sandbox Setup startet..."

# 1. Node.js Dependencies installieren
echo "📦 Installiere Node.js Dependencies..."
npm install --no-audit --no-fund 2>/dev/null

# 2. Environment-Variablen vorbereiten
echo "🔑 Bereite Environment vor..."
if [ ! -f .env ] && [ -f env.example ]; then
    cp env.example .env
    echo "   .env aus env.example erstellt"
fi

# 3. TypeScript-Check (Fehler sofort sichtbar machen)
echo "🔍 Prüfe TypeScript..."
npx tsc --noEmit 2>&1 | tail -5 || true

# 4. Supabase CLI installieren
echo "🗄️ Installiere Supabase CLI..."
npm install -g supabase@latest 2>/dev/null || true

# 5. Playwright für E2E-Tests installieren
echo "🎭 Installiere Playwright (Chromium)..."
npx playwright install chromium 2>/dev/null || true

# 6. Git konfigurieren
echo "🔧 Konfiguriere Git..."
git config user.name "OpenHands Bot"
git config user.email "bot@caravanwert.de"

# 7. Build testen (prüft ob der aktuelle Stand fehlerfrei baut)
echo "🏗️ Teste Build..."
npm run build 2>&1 | tail -5 || true

echo "✅ CaravanWert Sandbox Setup abgeschlossen!"
