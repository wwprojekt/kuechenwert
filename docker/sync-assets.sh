#!/bin/sh
# =============================================================================
# sync-assets.sh — Old-Chunk-Preservation für Zero-Downtime-Deploys
# =============================================================================
#
# Läuft bei jedem Container-Start (via /docker-entrypoint.d/ Hook von
# nginx:alpine). Synct den Build-Output aus /tmp/dist-stage in das
# laufende nginx-html-Verzeichnis und behält dabei alte Chunk-Hashes.
#
# WARUM:
# Standard-Dockerfile-COPY ersetzt das gesamte /usr/share/nginx/html bei
# jedem Deploy → alte Chunk-Filenames (z.B. AuctionDetail-XYZ123.js) sind
# weg. User mit alter index.html im Tab bekommen 404. Cloudflare cached
# diese 404 — selbst nach unserem 404-Header-Fix dauert es Stunden bis
# Edge-PoPs frisch sind.
#
# WIE:
# - Root-Files (index.html, sw.js, robots.txt, sitemap, favicons, logos)
#   werden IMMER überschrieben — sie sind kanonisch für die laufende
#   Build-Version.
# - assets/ wird mit `cp -n` (no-clobber) gemerged — vorhandene Hashes
#   bleiben erhalten, neue Hashes werden ergänzt.
# - Alte Asset-Files (mtime > 30 Tage) werden gelöscht damit das Volume
#   nicht unbegrenzt wächst. 30 Tage = 4 Wochen Browser-Tab-Toleranz.
#
# FAIL-SAFE:
# Wenn /usr/share/nginx/html/assets KEIN persistent volume ist, läuft
# das Script trotzdem ohne Fehler — der Effekt ist dann identisch zum
# alten Verhalten (assets gehen beim nächsten Container-Replace verloren).
# Es entsteht kein Regress.
#
# DOKPLOY-CONFIG (einmalig):
# Im Service-Config muss ein Volume gemountet werden:
#   Mount Path: /usr/share/nginx/html/assets
#   Volume Type: Volume Mount (named volume oder bind mount, beides OK)
# Erst dann greift die Old-Chunk-Preservation tatsächlich.
# =============================================================================

set -eu

SRC="/tmp/dist-stage"
DST="/usr/share/nginx/html"
ASSETS_DIR="$DST/assets"
RETENTION_DAYS="${ASSET_RETENTION_DAYS:-30}"
LOG_PREFIX="[sync-assets]"

log() {
    echo "$LOG_PREFIX $1"
}

if [ ! -d "$SRC" ]; then
    log "ERROR: Source dir $SRC nicht gefunden — Build broken?"
    exit 1
fi

mkdir -p "$DST" "$ASSETS_DIR"

log "Starte Sync von $SRC → $DST (Retention: ${RETENTION_DAYS}d)"

# 1) Root-Level Files (index.html, sw.js, robots.txt, sitemap.xml,
#    _redirects, favicon.*, logo*.png/webp, og-image.*, etc.)
#    IMMER überschreiben — diese sind kanonisch für den aktuellen Build.
ROOT_FILE_COUNT=0
for f in "$SRC"/*; do
    [ -f "$f" ] || continue
    cp -f "$f" "$DST/"
    ROOT_FILE_COUNT=$((ROOT_FILE_COUNT + 1))
done
log "Root-Files überschrieben: $ROOT_FILE_COUNT"

# 2) Sub-Directories außer 'assets' (z.B. images/) — komplett überschreiben.
SUBDIR_COUNT=0
for d in "$SRC"/*/; do
    [ -d "$d" ] || continue
    name=$(basename "$d")
    if [ "$name" = "assets" ]; then
        continue
    fi
    rm -rf "${DST:?}/$name"
    cp -rf "$d" "$DST/"
    SUBDIR_COUNT=$((SUBDIR_COUNT + 1))
done
log "Sub-Dirs überschrieben (außer assets/): $SUBDIR_COUNT"

# 3) assets/ — NO-CLOBBER merge. Vorhandene Hashes bleiben erhalten,
#    neue Hashes werden hinzugefügt. Das ist das Herzstück der
#    Old-Chunk-Preservation.
#
# IMPLEMENTATION NOTE (2026-04-24 outage):
# Früher: `cp -rn "$SRC/assets/." "$ASSETS_DIR/" 2>/dev/null || true`
# Das hatte zwei Bugs:
#   1. BusyBox-`cp -rn` (Alpine) verhält sich inkonsistent mit dem
#      Trailing-Dot-Pattern — der Copy wurde silent zu einem No-Op.
#      Ergebnis: 0 von 331 Chunks im served directory → 404 für alle
#      JS/CSS-Assets → weiße Seite.
#   2. `2>/dev/null || true` hat den Fehler verschluckt, und der log
#      meldete nur "0 neue Files", was nicht als Fehler erkannt wurde.
# Fix: File-für-File-Loop mit `-f -n` Fallback-Check via `[ -e ]`.
#      Deterministisch, funktioniert auch in BusyBox, und jeder
#      Copy-Fehler wird geloggt (nicht verschluckt).
NEW_ASSET_COUNT=0
COPY_ERROR_COUNT=0
if [ -d "$SRC/assets" ]; then
    BEFORE=$(find "$ASSETS_DIR" -type f 2>/dev/null | wc -l | tr -d ' ')
    # Per-file no-clobber copy — garantiert portabel über alle cp-Varianten
    find "$SRC/assets" -type f | while read -r src_file; do
        rel_path="${src_file#$SRC/assets/}"
        dst_file="$ASSETS_DIR/$rel_path"
        if [ ! -e "$dst_file" ]; then
            dst_dir=$(dirname "$dst_file")
            mkdir -p "$dst_dir" 2>/dev/null || true
            if ! cp "$src_file" "$dst_file" 2>&1; then
                log "WARN: Copy fehlgeschlagen: $rel_path"
                COPY_ERROR_COUNT=$((COPY_ERROR_COUNT + 1))
            fi
        fi
    done
    AFTER=$(find "$ASSETS_DIR" -type f 2>/dev/null | wc -l | tr -d ' ')
    NEW_ASSET_COUNT=$((AFTER - BEFORE))
    log "Assets vorher: $BEFORE / nachher: $AFTER (neue Files: $NEW_ASSET_COUNT)"
    # Sanity check: wenn Staging-Dir Files hat aber NICHTS neu ist und
    # Ziel leer war, ist was fundamental kaputt (Mount-Problem o.ä.).
    STAGING_COUNT=$(find "$SRC/assets" -type f 2>/dev/null | wc -l | tr -d ' ')
    if [ "$BEFORE" -eq 0 ] && [ "$AFTER" -eq 0 ] && [ "$STAGING_COUNT" -gt 0 ]; then
        log "FATAL: Staging hat $STAGING_COUNT Files aber keiner wurde kopiert — Volume-Mount defekt?"
        exit 1
    fi
fi

# 4) Cleanup: Asset-Files älter als RETENTION_DAYS löschen.
#    Schützt das Volume vor unbegrenztem Wachstum. -mtime ist relativ
#    zur Datei-Modification-Time — bei cp behält das Ziel die
#    Original-mtime, somit altert ein Chunk ab dem Zeitpunkt seines
#    erstmaligen Build-Erscheinens.
DELETED_COUNT=0
if [ -d "$ASSETS_DIR" ]; then
    DELETED_COUNT=$(find "$ASSETS_DIR" -type f -mtime "+$RETENTION_DAYS" -print 2>/dev/null | wc -l | tr -d ' ')
    find "$ASSETS_DIR" -type f -mtime "+$RETENTION_DAYS" -delete 2>/dev/null || true
fi
log "Cleanup: $DELETED_COUNT Files älter als ${RETENTION_DAYS}d gelöscht"

# 5) Permissions für nginx-User (nicht-fatal wenn fehlschlägt z.B. wegen
#    read-only mount — nginx kann auch root-owned files lesen).
chown -R nginx:nginx "$DST" 2>/dev/null || true

# 6) Stamp-File für externe Verifikation (z.B. via /verify-deploy).
date -u +"%Y-%m-%dT%H:%M:%SZ" > "$DST/.last-deploy" 2>/dev/null || true

log "Sync abgeschlossen ($(date -u +%Y-%m-%dT%H:%M:%SZ))"
