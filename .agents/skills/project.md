# BikeWert – Projekt-Kontext & Aufgaben-Management

## Projektübersicht

**BikeWert** ist eine deutschsprachige Online-Plattform zum Verkauf und Ankauf von Motorrädern, Quads und Rollern über ein Auktionssystem. Fork von CaravanWert, rebranded für den Motorrad-/Zweirad-Markt.

- **URL:** bikewert.de
- **Supabase-Projekt:** `iaotiligvhlhzlrpgdyk` (Region: eu-west-1)
- **Stack:** React 18 + TypeScript + Vite 5 + Tailwind + shadcn/ui + Supabase
- **Architektur-Details:** Siehe `AGENTS.md` im Root

---

## WICHTIG: Aufgaben-Management

### Regeln für den Agent
1. **Vor jeder Aufgabe**: Lies diese TODO-Liste und prüfe ob die Aufgabe bereits erledigt ist
2. **Nach jeder erledigten Aufgabe**: Aktualisiere diese Liste (markiere als erledigt mit `[x]` und Datum)
3. **Bei neuen Aufgaben**: Füge sie unter "Offen" hinzu
4. **NIEMALS** eine bereits erledigte Aufgabe erneut bearbeiten

### Erledigte Aufgaben (nicht erneut bearbeiten!)
- [x] Core config rebranding: index.html, AGENTS.md, robots.txt, wrangler.toml, project.md, linked-project.json (12.04.2026)

### Offene Aufgaben
- [ ] Rebrand source files: Rename all "motorhome"/"Wohnmobil" references in src/ to "vehicle"/"Motorrad"
- [ ] Update vehicle-data.ts with motorcycle/quad/roller manufacturers and models
- [ ] Update email templates in _shared/email-builder.ts with BikeWert branding
- [ ] Configure new Cloudflare Turnstile site key for bikewert.de
- [ ] Set up new analytics (GA4, etc.) for bikewert.de if needed
- [ ] Blog-System: Tabelle + Seiten existieren, 0 Artikel (Content fehlt)
- [ ] Baujahr-Ranges per Model implementieren
- [ ] Fuzzy-Search für Tippfehler
