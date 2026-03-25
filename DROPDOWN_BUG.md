# Dropdown Bug Analyse

## Probleme im Screenshot:

1. **Dropdown überlappt das Modell-Feld**: Das Dropdown öffnet sich nach unten und das "Modell"-Label und der Modell-Input sind HINTER dem Dropdown sichtbar. Man sieht "Modell" und "Adria" übereinander verschmelzen. Das Dropdown hat zwar z-50, aber das Modell-Feld darunter scheint trotzdem durchzuscheinen.

2. **Adria fehlt scheinbar**: Im Screenshot sieht man "Modell" und dann direkt "Adria" übereinander. Das bedeutet "Adria" IST da, aber es überlappt mit dem "Modell"-Label. Der erste sichtbare Eintrag im Dropdown-Bereich zeigt den Modell-Input-Placeholder "z.B. B-Klasse MC..." und dann "Bavaria", "Benimar", "Bürstner". Adria und Ahorn Camp sind oben im Dropdown aber werden vom Modell-Label verdeckt.

## Root Cause:
- Das Dropdown hat `absolute z-50` und `mt-1`, aber der Parent-Container `relative` ist das `space-y-2` div
- Das Dropdown positioniert sich relativ zum Hersteller-Feld-Container
- ABER: Das Modell-Feld darunter hat keinen z-index und liegt im normalen Flow
- Das Dropdown überlappt das Modell-Feld visuell, aber die Modell-Elemente scheinen durch

## Fix:
1. Das Dropdown muss ÜBER dem Modell-Feld liegen - z-50 sollte reichen, aber der Modell-Container braucht evtl. einen niedrigeren z-index
2. Besser: Das Dropdown-Container-div (relative) sollte auf der gesamten Hersteller-Zeile sein, nicht auf space-y-2
3. Am besten: Dropdown mit `left-0 top-full` positionieren und dem Parent eine höhere Stacking-Priorität geben
