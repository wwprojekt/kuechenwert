# Küchen-Stammdaten Backup

Dieser Ordner enthält Stammdaten-Dumps aus dem **alten** Next.js-basierten
Küchenwert-Projekt (Supabase-Projekt `gzqayoalwtmypndrmqes`, gedumpt am
2026-04-27 vor dem Schema-Nuke).

## Warum ein JSON-Backup und kein SQL-Seed?

Das neue v2 basiert auf dem Caravanwert-Stack (Vite + React + Supabase) und
übernimmt dessen Schema 1:1 — d. h. zunächst gibt es dort gar keine
`catalog_kitchen_brands` / `catalog_front_materials` / `kitchen_price_brackets`
etc. Die hier gesicherten Küchen-Tabellen sind also **Rohdaten für später**,
wenn wir im v2 die Domäne auf Küchen umgeschrieben haben und entsprechende
Kitchen-Catalog-Tabellen angelegt haben.

## Inhalt

| Datei                       | Inhalt                                                        |
| --------------------------- | ------------------------------------------------------------- |
| `001_catalogs_backup.json`  | 12 Tabellen als JSON-Array, jedes Row als Objekt (`to_jsonb`) |

### Enthaltene Tabellen

| Tabelle                          | Rows | Zweck |
| -------------------------------- | ---- | ----- |
| `catalog_kitchen_brands`         |   26 | Küchenhersteller (Nobilia, Häcker, etc.) |
| `catalog_appliance_brands`       |   20 | Gerätemarken (Miele, Bosch, Siemens, etc.) |
| `catalog_appliance_categories`   |   12 | Gerätekategorien (Backofen, Kühlschrank, etc.) |
| `catalog_front_materials`        |   18 | Front-Materialien (Matt-Lack, Hochglanz, etc.) |
| `catalog_handle_types`           |    7 | Griff-Typen (Bügel, Stangen, grifflos, etc.) |
| `catalog_sink_brands`            |   11 | Spülen-Marken |
| `catalog_sink_materials`         |    7 | Spülen-Materialien (Granit, Edelstahl, etc.) |
| `catalog_worktop_designs`        |   25 | Arbeitsplatten-Designs |
| `catalog_worktop_materials`      |   12 | Arbeitsplatten-Materialien |
| `kitchen_price_brackets`         |  288 | B2C-Preismatrix (Range pro Konfiguration) |
| `lead_pricing_rules`             |   16 | CPA-Preis-Staffel (Lead-Marketplace) |
| `commission_tiers`               |    5 | Provisions-Staffel (Funnel-B-Auktion) |

## Spätere Wiederverwendung

Nachdem im v2 die küchen-spezifischen Catalog-Tabellen angelegt sind, lässt
sich das JSON-Backup als Seed einspielen. Beispiel-Pattern:

```ts
// scripts/import-catalog-backup.ts
import { createClient } from '@supabase/supabase-js';
import backup from '../supabase/seed-kuechen/001_catalogs_backup.json';

const supabase = createClient(url, serviceRoleKey);

for (const [table, rows] of Object.entries(backup.tables)) {
  if (rows.length === 0) continue;
  const { error } = await supabase.from(table).insert(rows);
  if (error) throw error;
}
```

## Nicht im Backup

Bewusst nicht gesichert wurden:

- `profiles`, `dealers` — Test-Accounts, werden neu angelegt
- `leads`, `auctions`, `auction_spec_items`, `bids` — Test-Daten ohne Wert
- `planner_sessions`, `planner_renders` — Traumküche-Testbilder (Fal.ai)
- `consent_records`, `audit_log`, `rate_limit_buckets` — ephemer / GDPR-ok zu löschen
- `auth.users` — 3 Test-Accounts ohne Produktions-Bedeutung
- `storage.objects` — Test-Uploads von Funnel-B
