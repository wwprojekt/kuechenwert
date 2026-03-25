# Logo Update Plan

## Altes Logo (public/logo.png)
Ein Wohnmobil-Icon (Caravan-Grafik) + "CaravanWert" in teal/cyan + Tagline darunter.
Das ist das alte Logo das aktuell in den E-Mail-Templates verwendet wird.

## Neues Logo (vom User bereitgestellt - Screenshot_313.png)
Tealfarbenes abgerundetes Quadrat mit weißem "C" + "CaravanWert" in dunkelgrau + Tagline.
Das ist das neue Logo das bereits auf der Website angezeigt wird.

## Wo muss aktualisiert werden
1. public/logo.png - die Datei selbst ersetzen (wird von SiteLogo.tsx als Fallback genutzt)
2. Supabase Auth E-Mail-Templates (8 Templates) - referenzieren https://caravanwert.de/logo.png
3. AdminEmailCenter.tsx (3 Stellen) - referenzieren https://caravanwert.de/logo.png

## Frage
Die Website zeigt schon das neue Logo - das kommt vermutlich aus settings.logo_url.
Aber public/logo.png ist noch das alte. Das muss ersetzt werden.
Und die E-Mail-Templates laden logo.png - also das ALTE Logo.
