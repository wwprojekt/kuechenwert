-- Rechtstexte an den tatsächlichen Betrieb angepasst (Stand September 2026):
--  * Datenschutzerklärung: alle eingesetzten Dienste (IONOS, Cloudflare,
--    Supabase, Resend, fal.ai, Google, Meta), Ablauf der Vermittlung an
--    Küchenstudios, KI-Visualisierung, Einwilligungs-Logik (Dienste laden erst
--    nach Einwilligung), Enhanced Conversions, Klick-IDs, TDDDG statt TTDSG.
--  * Impressum: DDG statt TMG, Hinweis auf die zum 20.07.2025 eingestellte
--    EU-Plattform zur Online-Streitbeilegung entfernt.
-- Die Texte bleiben im Admin unter „Rechtstexte“ editierbar.

update public.legal_pages
set content = $html$
<p><em>Stand: September 2026</em></p>

<h2>1. Verantwortliche Stelle</h2>
<p>CaravanWert GmbH (Betreiberin der Marke KüchenWert)<br />Hannoversche Str. 106<br />30627 Hannover<br />Telefon: +49 511 51532476<br />E-Mail: <a href="mailto:info@kuechenwert24.de">info@kuechenwert24.de</a></p>
<p>Diese Erklärung gilt für <strong>kuechenwert24.de</strong> und <strong>küchenwert.de</strong>.</p>

<h2>2. Hosting und Infrastruktur</h2>
<p>Damit die Website schnell, sicher und zuverlässig läuft, setzen wir folgende Dienstleister ein:</p>
<ul>
  <li><strong>IONOS SE</strong> (Montabaur, Deutschland): Server in Deutschland, auf dem die Website läuft.</li>
  <li><strong>Cloudflare, Inc.</strong> (USA): DNS, Auslieferung der Inhalte und Schutz vor Angriffen. Alle Aufrufe laufen über Cloudflare; dabei wird Ihre IP-Adresse verarbeitet.</li>
  <li><strong>Supabase, Inc.</strong> (USA): Datenbank, Dateispeicher und serverseitige Funktionen, betrieben in der EU-Region Frankfurt.</li>
</ul>
<p>Rechtsgrundlage ist unser berechtigtes Interesse an einem sicheren und stabilen Betrieb (Art. 6 Abs. 1 lit. f DSGVO). Mit den Anbietern bestehen Verträge zur Auftragsverarbeitung nach Art. 28 DSGVO. Soweit Daten in die USA gelangen können, stützt sich die Übermittlung auf das EU-US Data Privacy Framework bzw. auf EU-Standardvertragsklauseln.</p>
<p>Beim Aufruf der Website werden technische Daten verarbeitet (IP-Adresse, Datum und Uhrzeit, aufgerufene Seite, Browser und Betriebssystem). Wir nutzen sie nur für Betrieb, Sicherheit und Fehleranalyse und führen sie nicht mit anderen Daten zusammen.</p>

<h2>3. Anfragen über unsere Formulare</h2>
<p>Wenn Sie Küchenangebote anfragen, ein vorhandenes Angebot unterbieten lassen oder Ihre Traumküche planen, verarbeiten wir Ihre Angaben zur Küche, Postleitzahl und Ort, Name, E-Mail-Adresse, Telefonnummer sowie Dateien, die Sie hochladen.</p>
<p><strong>So geht es mit Ihrer Anfrage weiter:</strong> Geprüfte Küchenstudios aus Ihrer Region sehen eine Beschreibung Ihres Projekts ohne Namen und Kontaktdaten. Ihre Kontaktdaten erhalten höchstens drei Studios für Rückfragen sowie das Studio, dessen Angebot Sie annehmen. Bei einem Angebotsvergleich (vorhandenes Studio-Angebot) besprechen wir Ihr Angebot vorher telefonisch mit Ihnen.</p>
<p><strong>Rechtsgrundlagen:</strong> Die Vermittlung erfolgt auf Ihre Anfrage hin (Art. 6 Abs. 1 lit. b DSGVO). Anrufe und Werbe-E-Mails erfolgen nur mit Ihrer Einwilligung (Art. 6 Abs. 1 lit. a DSGVO), die Sie jederzeit mit Wirkung für die Zukunft widerrufen können. Zum Nachweis speichern wir, welchem Text Sie wann zugestimmt haben, zusammen mit IP-Adresse und Browserangaben.</p>
<p><strong>Speicherdauer:</strong> Wir speichern Ihre Anfrage, bis sie erledigt ist, und löschen sie danach, soweit keine gesetzlichen Aufbewahrungspflichten (z. B. aus Handels- und Steuerrecht) entgegenstehen.</p>
<p>Ihren Fortschritt im Formular speichert Ihr Browser nur für die aktuelle Sitzung (sessionStorage), damit beim Zurückgehen oder Neuladen nichts verloren geht.</p>

<h2 id="ki-visualisierung">4. Traumküchen-Planer und KI-Visualisierung</h2>
<p>Im Planer können Sie ein Foto Ihres Raums hochladen. Das Foto und Ihre Planungsangaben speichern wir und übermitteln sie an <strong>fal.ai</strong> (Features &amp; Labels, Inc., USA), das daraus die Visualisierung Ihrer neuen Küche erzeugt. Rechtsgrundlage ist die von Ihnen angeforderte Leistung (Art. 6 Abs. 1 lit. b DSGVO). Bitte laden Sie keine Fotos hoch, auf denen Personen zu sehen sind. Wir löschen Fotos und Visualisierungen, sobald sie für Ihr Projekt nicht mehr benötigt werden.</p>

<h2>5. E-Mails</h2>
<p>Bestätigungen, den Link zu Ihrem Projekt und Nachrichten zu Angeboten verschicken wir über <strong>Resend, Inc.</strong> (USA). Dabei werden Ihre E-Mail-Adresse und der Inhalt der Nachricht verarbeitet (Art. 6 Abs. 1 lit. b und f DSGVO).</p>
<p>Wenn Sie uns per E-Mail, Telefon oder Kontaktformular schreiben, verarbeiten wir Ihre Angaben, um Ihr Anliegen zu bearbeiten (Art. 6 Abs. 1 lit. b bzw. f DSGVO).</p>

<h2>6. Schutz vor Missbrauch</h2>
<p>Unsere Formulare schützen wir mit <strong>Cloudflare Turnstile</strong> vor automatisierten Anfragen. Dabei werden IP-Adresse und Browsermerkmale geprüft. Das ist für einen sicheren Betrieb der Formulare erforderlich (§ 25 Abs. 2 Nr. 2 TDDDG, Art. 6 Abs. 1 lit. f DSGVO). Zusätzlich begrenzen wir die Zahl der Anfragen pro IP-Adresse.</p>

<h2>7. Cookies und Einwilligung</h2>
<p>Technisch notwendige Speicherungen – etwa Ihre Cookie-Auswahl oder den Formularfortschritt – nutzen wir ohne Einwilligung (§ 25 Abs. 2 Nr. 2 TDDDG). Statistik- und Marketingdienste laden wir erst, <strong>nachdem</strong> Sie im Cookie-Banner eingewilligt haben (§ 25 Abs. 1 TDDDG, Art. 6 Abs. 1 lit. a DSGVO); vorher werden keine Daten an diese Anbieter gesendet. Ihre Auswahl können Sie jederzeit über „Cookie-Einstellungen“ im Footer ändern oder widerrufen.</p>

<h3>Statistik (nur mit Einwilligung)</h3>
<p><strong>Google Analytics 4</strong> (Google Ireland Limited) zeigt uns, wie unsere Website genutzt wird, zum Beispiel an welchem Schritt eines Formulars Besucher abbrechen. Zusätzlich speichern wir Seitenaufrufe und diese Schritte pseudonymisiert in unserer eigenen Datenbank.</p>

<h3>Werbung und Erfolgsmessung (nur mit Einwilligung)</h3>
<p><strong>Google Ads</strong> (Google Ireland Limited) messen wir mit Conversion-Tracking. Senden Sie eine Anfrage ab, übermitteln wir dafür E-Mail-Adresse, Telefonnummer, Name und Postleitzahl in verschlüsselter (gehashter) Form an Google („erweiterte Conversions“). Außerdem speichern wir die Klick-Kennung der Anzeige (z. B. gclid) zu Ihrer Anfrage, um zu erkennen, welche Anzeige zu welcher Anfrage geführt hat.</p>
<p>Den <strong>Meta-Pixel</strong> (Meta Platforms Ireland Limited) nutzen wir, um den Erfolg von Anzeigen auf Facebook und Instagram zu messen. Sofern aktiviert, gilt dasselbe für <strong>Microsoft Advertising</strong> (Microsoft Ireland Operations Limited).</p>
<p>Diese Anbieter können Daten auch in die USA übermitteln; sie sind nach dem EU-US Data Privacy Framework zertifiziert.</p>

<h2>8. Ihre Rechte</h2>
<p>Sie haben das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch gegen Verarbeitungen auf Grundlage berechtigter Interessen (Art. 21 DSGVO). Eine Einwilligung können Sie jederzeit mit Wirkung für die Zukunft widerrufen (Art. 7 Abs. 3 DSGVO).</p>
<p>Sie können sich außerdem bei einer Datenschutz-Aufsichtsbehörde beschweren, zum Beispiel bei der für uns zuständigen Aufsichtsbehörde, der LfD Niedersachsen.</p>

<h2>9. Kontakt</h2>
<p>Fragen zum Datenschutz beantworten wir unter <a href="mailto:info@kuechenwert24.de">info@kuechenwert24.de</a>.</p>
$html$,
    updated_at = now()
where slug = 'datenschutz';

-- Nur den Absatz bis zum ersten </p> entfernen: In PostgreSQL macht der erste
-- Quantor die ganze RE gierig, ein „.*?“ würde bis zum letzten </p> reichen.
update public.legal_pages
set content = replace(
      regexp_replace(content, '<h2>EU-Streitschlichtung</h2>[[:space:]]*<p>((?!</p>).)*</p>[[:space:]]*', ''),
      ' TMG',
      ' DDG'
    ),
    updated_at = now()
where slug = 'impressum';
