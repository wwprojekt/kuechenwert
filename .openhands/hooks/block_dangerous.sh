#!/bin/bash
# =============================================================================
# PreToolUse Hook: Gefährliche Befehle blockieren
# Verhindert destruktive Operationen ohne Bestätigung.
# =============================================================================

input=$(cat)
command=$(echo "$input" | jq -r '.tool_input.command // ""')

# Blockiere rm -rf auf kritische Pfade
if [[ "$command" =~ rm[[:space:]]+-rf[[:space:]]+/ ]] || [[ "$command" =~ rm[[:space:]]+-rf[[:space:]]+\. ]]; then
    echo '{"decision": "deny", "reason": "rm -rf auf Root- oder Projektverzeichnis ist blockiert. Bitte lösche nur spezifische Dateien."}'
    exit 2
fi

# Blockiere DROP TABLE/DATABASE
if echo "$command" | grep -iqE "DROP\s+(TABLE|DATABASE|SCHEMA)"; then
    echo '{"decision": "deny", "reason": "DROP TABLE/DATABASE ist blockiert. Nutze Supabase MCP für Datenbankänderungen."}'
    exit 2
fi

# Blockiere git push --force
if echo "$command" | grep -qE "git\s+push\s+.*--force"; then
    echo '{"decision": "deny", "reason": "git push --force ist blockiert. Nutze normalen git push."}'
    exit 2
fi

# Blockiere npm publish
if echo "$command" | grep -qE "npm\s+publish"; then
    echo '{"decision": "deny", "reason": "npm publish ist blockiert. Deployment erfolgt über Netlify."}'
    exit 2
fi

exit 0
