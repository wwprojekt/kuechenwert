# Live-Test Ergebnisse

## Registrierungsseite /register/haendler

### FUNKTIONIERT:
- Seite lädt korrekt
- 28 EU-Länder + CH im Dropdown mit Flaggen
- Sprachwechsel bei Länderwahl funktioniert (getestet: FR → alles auf Französisch)
- Rechtsformen wechseln je nach Land
- Dokument-Label passt sich an (DE: "Gewerbenachweis", FR: "Extrait Kbis")
- Telefon-Placeholder passt sich an (+49 → +33)
- Formular-Layout ist sauber und professionell

### PROBLEME GEFUNDEN:

1. **AGB/Datenschutz-Links bleiben deutsch** - "J'accepte les **AGB** & **Datenschutz**" statt "CGV" und "Politique de confidentialité"
   - Die Wörter "AGB" und "Datenschutz" sind hardcoded in JSX, nicht in den Übersetzungen
   
2. **PageLayout title/description bleibt deutsch** - "Händler-Registrierung" im Browser-Tab auch bei FR

3. **Header/Footer bleiben deutsch** - Kein Sprachwechsel der Navigation

4. **Erfolgsseite-Titel bleibt deutsch** - "Registrierung erfolgreich" ist hardcoded

5. **Benefit-Karten bleiben deutsch** bei Länderwechsel - Die 3 Karten oben ("Exklusiver Zugang", "B2B Netzwerk", "Direkte Registrierung") wechseln NICHT die Sprache → FALSCH, sie WECHSELN die Sprache (verifiziert)

KORREKTUR: Die Benefit-Karten verwenden `tr.benefitExclusiveTitle` etc. und wechseln korrekt.

### VERIFIZIERT KORREKT:
- Formular-Labels wechseln Sprache ✓
- Placeholders wechseln ✓  
- Passwort-Anforderungen wechseln ✓
- Info-Box wechselt ✓
- Submit-Button wechselt ✓
- Footer-Links ("Bereits registriert?") wechseln ✓
