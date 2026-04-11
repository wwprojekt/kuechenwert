# Dropdown Bug Analyse

## Problem
Das Dropdown ist `absolute` positioniert mit `top-full`, was korrekt ist.
ABER: Das Modell-Feld darunter (Zeile 694) liegt im normalen Document Flow und wird NICHT nach unten verschoben.
Das Dropdown überlappt das Modell-Label und den Modell-Input.

## Root Cause
`position: absolute` nimmt das Element aus dem Flow - das Modell-Feld weiß nicht, dass das Dropdown da ist.

## Lösung
Statt absolute Positionierung: Das Dropdown im normalen Flow belassen (kein absolute).
Oder: Das Modell-Feld ausblenden wenn das Dropdown offen ist.
Oder: Genug margin-bottom hinzufügen wenn Dropdown offen ist.

Beste Lösung: Das Dropdown NICHT absolute positionieren, sondern im normalen Flow lassen.
Das schiebt das Modell-Feld automatisch nach unten.
