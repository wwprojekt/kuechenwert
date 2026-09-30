# Dokploy: Persistentes Asset-Volume für alte Chunks

## Wozu

Bei jedem Deploy ersetzt Dokploy den nginx-Container der KüchenWert-App. Ohne
Volume sind danach die Vite-Chunks des vorherigen Builds weg (z. B.
`FunnelC-DYIFweTI.js`). Wer die Seite noch mit der alten `index.html` offen hat,
bekommt beim nächsten Seitenwechsel für den nachgeladenen Chunk einen 404.

Das Frontend fängt das ab (`lazyRetry` in `src/lib/lazyRetry.ts`, Neuladen bei
`vite:preloadError` in `src/main.tsx`). Das Neuladen ist aber sichtbar und
unterbricht den Besuch, in einem Funnel mitten im Schritt. Mit einem
persistenten Volume unter `/usr/share/nginx/html/assets` bleiben die alten
Chunks einfach erreichbar.

So funktioniert es: Das Image enthält den Build unter `/tmp/dist-stage`. Bei
jedem Container-Start kopiert `docker/sync-assets.sh` (Entrypoint-Hook
`40-sync-assets.sh`) ihn nach `/usr/share/nginx/html`. Dateien im Wurzelordner
und Unterordner wie die vorgerenderten Seiten werden überschrieben, `assets/`
bekommt nur neue Dateien dazu. Dateien, die seit `ASSET_RETENTION_DAYS` Tagen
(Standard 30) in keinem gestarteten Build mehr vorkamen, werden gelöscht.

## Einrichtung in Dokploy (einmalig)

### Schritt 1: Volume anlegen

1. Dokploy-Panel öffnen: https://deploy.kuechenwert24.de
2. Die KüchenWert-App öffnen, also die Anwendung, deren `applicationId` im
   GitHub-Secret `DOKPLOY_APP_ID` steht. Keine andere App anfassen.
3. Reiter **Advanced** → **Volumes** (je nach Dokploy-Version auch **Mounts**
   oder **Storage**) → **Add Volume** bzw. **Add Mount**.
4. Diese Werte eintragen:

| Feld | Wert |
|------|------|
| **Mount-Typ** | `Volume Mount` |
| **Volume-Name** | `kuechenwert-assets` |
| **Mount-Pfad** | `/usr/share/nginx/html/assets` |

> Gibt es schon ein Volume mit diesem Mount-Pfad, bleibt es, wie es ist, auch
> wenn es anders heißt. Der Name ist nur ein Etikett, entscheidend ist der
> Mount-Pfad. Umbenennen legt ein neues, leeres Volume an; die alten Chunks
> wären dann einmal weg.

Statt eines Docker-Volumes geht auch ein **Bind Mount** auf ein dauerhaftes
Verzeichnis des Servers (z. B. `/srv/kuechenwert-assets`, nicht unter `/tmp`).

### Schritt 2: Neu deployen

Den aktuellen Stand erneut ausrollen: **Deploy** in Dokploy oder
`gh workflow run deploy.yml --repo wwprojekt/kuechenwert` (prüft `main` und
stößt danach den Dokploy-Deploy an). Build und Prerendering dauern einige
Minuten.

### Schritt 3: Kontrolle in den Container-Logs

Beim Start schreibt das Sync-Skript in die Container-Logs (Zahlen beispielhaft):

```
[sync-assets] Starte Sync von /tmp/dist-stage → /usr/share/nginx/html (Retention: 30d)
[sync-assets] Root-Files überschrieben: 28
[sync-assets] Sub-Dirs überschrieben (außer assets/): 19
[sync-assets] Assets vorher: 0 / nachher: 303 (neue Files: 303)
[sync-assets] Cleanup: 0 Files älter als 30d gelöscht
[sync-assets] Sync abgeschlossen (2026-09-30T10:15:00Z)
```

Ab dem nächsten Deploy mit Code-Änderung steht bei „vorher“ der Bestand des
Volumes, z. B. `Assets vorher: 303 / nachher: 318 (neue Files: 15)`: Die alten
Chunks sind noch da. Steht „vorher“ bei jedem Deploy auf 0, ist das Volume
nicht gemountet.

### Schritt 4: Gegenprobe von außen

Nur mit einem Deploy, der Code ändert. Ein erneuter Deploy desselben Stands
erzeugt dieselben Dateinamen und beweist nichts.

```bash
# Vor dem Deploy: Einstiegs-Chunk der Startseite merken
curl -s https://kuechenwert24.de/ | grep -oE 'assets/[^" ]+\.js' | head -1
# z. B. assets/index-C9bOCwWt.js

# Nach dem Deploy: Die Startseite nennt einen neuen Chunk, der alte muss
# trotzdem ausgeliefert werden. Der Query-Parameter umgeht den
# Cloudflare-Cache, sonst antwortet womöglich die Edge statt nginx.
curl -sI "https://kuechenwert24.de/assets/index-C9bOCwWt.js?probe=$(date +%s)"
# Erwartung: 200 (ohne Volume: 404)
```

## Ohne Volume

Nichts geht kaputt: Der Container verhält sich dann, als gäbe es den Sync
nicht, und alte Chunks verschwinden mit jedem Deploy. Es greifen die übrigen
Schutzschichten: `lazyRetry`, das Neuladen bei `vite:preloadError` und der
nginx-Block `@asset_404` in `docker/default.conf`, der 404-Antworten auf
Asset-Pfade mit `no-store` ausliefert, damit Cloudflare sie nicht cacht.

## Speicherbedarf

- Ein Build hat rund 300 Dateien und 8 MB unter `assets/`.
- Pro Deploy kommen meist nur 1–3 MB neue Dateien dazu, die Vendor-Chunks
  ändern sich selten.
- Bei 30 Tagen Aufbewahrung pendelt sich das Volume je nach Deploy-Häufigkeit
  bei etwa 100–300 MB ein.

## Aufbewahrung anpassen

In Dokploy unter **Environment** der App setzen, wirkt ab dem nächsten
Container-Start:

```
ASSET_RETENTION_DAYS=60
```

Standard ist 30. Werte unter 7 lohnen nicht, ein offener Browser-Tab lebt
typischerweise 1–7 Tage. Gezählt wird ab dem letzten Container-Start, dessen
Build die Datei noch enthielt; Dateien des laufenden Builds löscht der Cleanup
nie.

## Bei Problemen

1. Container-Logs nach Zeilen mit `[sync-assets]` durchsuchen.
2. `ERROR: Source dir /tmp/dist-stage nicht gefunden`: Das Image ist kaputt,
   Build-Logs prüfen.
3. `FATAL: Staging hat … Files aber keiner wurde kopiert`: Das Volume ist
   gemountet, aber nicht beschreibbar. Der Container startet in diesem Fall
   nicht.
4. `permission denied`: Das Volume gehört dem falschen Nutzer. Auf dem Server
   zeigt `docker volume ls` den genauen Namen und `docker volume inspect <name>`
   den `Mountpoint`; dort `chown -R 101:101 <Mountpoint>` ausführen (101 ist der
   nginx-Nutzer im Alpine-Image).
5. Der Container startet, aber Assets fehlen: Der Mount-Pfad muss exakt
   `/usr/share/nginx/html/assets` lauten.
