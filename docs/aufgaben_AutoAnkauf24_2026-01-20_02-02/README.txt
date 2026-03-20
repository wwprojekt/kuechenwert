Aufgaben Export
================

Exportiert am: 20.01.2026 02:02
Projekt: AutoAnkauf24
Anzahl Aufgaben: 41
Anzahl Dateien: 7

Struktur:
---------
- tasks.json: Vollständige Aufgabendaten im JSON-Format
  * Jede Aufgabe enthält ein "attachments" Array mit:
    - attachment_id: Eindeutige ID des Anhangs
    - file_name: Name der Datei
    - file_type: MIME-Typ der Datei
    - zip_path: Vollständiger Pfad zur Datei im ZIP (z.B. "attachments/task-abc12345-Task_Title/screenshot.png")
    - created_at: Erstellungsdatum

- attachment-manifest.json: Explizite Zuordnung von Dateien zu Aufgaben
  * Enthält für jeden Anhang:
    - task_id: ID der zugehörigen Aufgabe
    - task_title: Titel der Aufgabe
    - attachment_id: ID des Anhangs
    - file_name: Name der Datei
    - zip_path: Vollständiger Pfad im ZIP

- tasks.csv: Aufgabendaten im CSV-Format (für Excel)

- attachments/: Ordner mit allen Dateianhängen
  * Struktur: attachments/task-{task_id}-{task_title}/{file_name}
  * Jeder Ordner enthält alle Dateien einer Aufgabe

Wichtig für AI-Verarbeitung:
----------------------------
1. Jede Aufgabe in tasks.json hat ein "attachments" Array mit zip_path
2. attachment-manifest.json bietet eine flache Liste aller Zuordnungen
3. Der Ordnername enthält die ersten 8 Zeichen der task_id für eindeutige Zuordnung
4. Alle Dateien sind direkt über den zip_path in tasks.json auffindbar

Hinweis: Interne Notizen sind aus Datenschutzgründen nicht enthalten.
