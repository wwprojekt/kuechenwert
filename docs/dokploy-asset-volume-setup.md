# Dokploy Setup: Persistent Asset-Volume für Old-Chunk-Preservation

## Was dieser Schritt löst

Bei jedem Deploy ersetzt Dokploy den nginx-Container komplett. Damit
gehen die alten Vite-Chunk-Dateien (z.B. `AuctionDetail-COoJo3aK.js`)
verloren. User die zur falschen Zeit klicken — also genau im Moment des
Container-Swaps oder mit einer alten `index.html` im Tab — bekommen
einen 404 für ihre Chunks und sehen einen White-Screen-Crash.

Mit dem Code-Fix (Commit nach `6fec3c8`) erkennt das Frontend solche
Fehler bereits korrekt und reloaded automatisch. Aber: ein Reload ist
sichtbarer Flicker, beim Wizard-mid-flow geht der Form-State verloren.

**Mit dem persistenten Volume wird der Reload überflüssig** — die
alten Chunks bleiben einfach verfügbar.

## Was du in Dokploy genau tun musst

### Schritt 1: Volume hinzufügen

1. Öffne https://app.dokploy.com (oder deine Dokploy-Instanz)
2. Navigiere zum Service **caravanwert** (oder wie auch immer dein
   Production-Deployment heißt)
3. Klick auf den Tab **Volumes** (oder **Storage** je nach Version)
4. Klick **+ Add Volume**
5. Trage exakt diese Werte ein:

| Feld | Wert |
|------|------|
| **Volume Type** | `Volume Mount` |
| **Volume Name** | `caravanwert-assets` |
| **Mount Path** | `/usr/share/nginx/html/assets` |

> Falls Dokploy stattdessen **Bind Mount** anbietet: das geht auch.
> Pfad auf dem Host frei wählbar (z.B. `/var/lib/dokploy/caravanwert-assets`).
> Wichtig ist nur dass es ein PERSISTENTES Verzeichnis ist (nicht `/tmp/...`).

### Schritt 2: Service neu deployen

1. Klick **Deploy** (oder **Redeploy**)
2. Warte ~60 Sekunden
3. Wenn Dokploy einen Healthcheck-Fehler meldet: nicht panisch werden,
   start-period ist auf 10s konfiguriert — manchmal braucht der erste
   Sync länger. Schaue in die Logs (siehe Schritt 3).

### Schritt 3: Verifikation in den Container-Logs

In den Dokploy-Container-Logs sollten beim Container-Start zwei
sehr kurze Log-Zeilen vom Sync-Script erscheinen:

```
[sync-assets] Starte Sync von /tmp/dist-stage → /usr/share/nginx/html (Retention: 30d)
[sync-assets] Root-Files überschrieben: 22
[sync-assets] Sub-Dirs überschrieben (außer assets/): 1
[sync-assets] Assets vorher: 0 / nachher: 330 (neue Files: 330)
[sync-assets] Cleanup: 0 Files älter als 30d gelöscht
[sync-assets] Sync abgeschlossen (2026-04-22T15:30:00Z)
```

Ab dem ZWEITEN Deploy:
- `Assets vorher: 330` (oder mehr — das sind die alten Chunks)
- `nachher: 345` (z.B. 15 neue durch geänderten Code)
- `neue Files: 15`

Das zeigt dass die Old-Chunk-Preservation greift.

### Schritt 4: Live-Test gegen Production

```bash
# Speicher dir einen aktuellen Chunk-Filename
curl -s https://caravanwert.de/ | grep -oE 'assets/[^"]+\.js' | head -1
# z.B. assets/index-BuxxizG9.js

# Mache einen Deploy (z.B. trivial commit + push)
git commit --allow-empty -m "test: trigger deploy"
git push origin main

# Warte ~90 Sek bis Deploy durch ist
# Frage den ALTEN Chunk erneut an — muss jetzt 200 statt 404 zurückgeben:
curl -sI "https://caravanwert.de/assets/index-BuxxizG9.js"
# Erwartung: HTTP/1.1 200 OK
# (Vor dem Volume: HTTP/1.1 404 Not Found)
```

## Was passiert wenn ich das Volume NICHT konfiguriere?

Nichts kaputtes — der Code ist fail-safe. Ohne Volume verhält sich der
Container exakt wie vorher (assets gehen beim Container-Replace
verloren). Die anderen Schutzschichten (`lazyRetry`, nginx 404
no-store, Vite preload-error reload) greifen weiter und fangen die
Fehler clientseitig auf. Es entsteht **kein Regress**.

Du verlierst nur den zusätzlichen Komfort dass User mit alten Tabs
*ohne* sichtbaren Reload weiter funktionieren.

## Disk-Space-Erwartung

- Pro Build: ~9 MB Assets (330 Files)
- Bei 5 Deploys/Tag: ~45 MB neue Files/Tag
- Realität: vendor-Chunks ändern sich selten → meist nur 1-3 MB
  neue Files pro Deploy
- Nach 30 Tagen Retention (siehe `ASSET_RETENTION_DAYS`): ~150-300 MB
  steady state

## Retention anpassen

Falls du längere/kürzere Retention willst, setze in Dokploy unter
**Environment** die Variable:

```
ASSET_RETENTION_DAYS=60
```

(Default: `30`. Werte unter `7` machen wenig Sinn — der Browser-Tab
einer User-Session lebt typisch 1-7 Tage.)

## Bei Problemen

Falls der Container-Start fehlschlägt:

1. Check Container-Logs auf `[sync-assets]` Zeilen
2. Wenn `ERROR: Source dir /tmp/dist-stage nicht gefunden` → Build
   ist broken, prüfe Build-Logs
3. Wenn `permission denied` → Volume hat falsche Ownership.
   Im Dokploy-Host: `chown -R 101:101 /var/lib/dokploy/volumes/<volume-name>`
   (101:101 = nginx-user in Alpine-Image)
4. Wenn Container startet aber Assets fehlen → Volume ist nicht korrekt
   gemountet. Prüfe Mount-Path = exakt `/usr/share/nginx/html/assets`
