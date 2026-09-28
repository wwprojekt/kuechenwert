-- ============================================================================
-- Rechtstexte an das tatsächliche Geschäftsmodell angepasst (28.09.2026)
--
-- Die AGB beschrieben noch einen Marktplatz für gebrauchte Küchen (Verkäufer,
-- Exposee, Wertermittlung). Neu:
--   * agb: Nutzungsbedingungen für Kund:innen der Vermittlungsplattform für
--     neue Küchen (Anfrage, Unterbieten, Traumküchen-Planer), ohne
--     Zustimmungsfiktion bei Änderungen.
--   * konditionen: Bedingungen für Küchenstudios (Projekt-Börse, Angebote,
--     Kontaktfreischaltung, Provisionsstaffel wie lead_commission_tiers,
--     Reklamation, Zahlung/Mahnstufen, Transparenz nach VO (EU) 2019/1150).
--     Verlinkt aus der Zuschlags-Mail.
--   * datenschutz: Speicherfristen wie kw-maintenance, Studios als eigene
--     Verantwortliche, Abmeldung per Link.
-- Anwaltliche Prüfung vor weiterer Werbung empfohlen; Texte bleiben im Admin
-- unter Rechtliches bearbeitbar.
-- ============================================================================

update public.legal_pages
set title = 'Allgemeine Geschäftsbedingungen (AGB)',
    is_published = true,
    updated_at = now(),
    published_at = now(),
    version = version + 1,
    content = $agb$
<p>Diese Bedingungen gelten für Kundinnen und Kunden, die über KüchenWert eine neue Küche suchen. Für Küchenstudios gelten die <a href="/konditionen">Konditionen für Küchenstudios</a>.</p>

<h2>§ 1 Geltungsbereich und Anbieterin</h2>
<p>(1) Diese Allgemeinen Geschäftsbedingungen gelten für die Nutzung der Plattform kuechenwert24.de („KüchenWert“) durch Personen, die eine neue Küche planen oder kaufen möchten („Kund:innen“).</p>
<p>(2) Anbieterin ist die WohnWert GmbH, Hannoversche Str. 106, 30627 Hannover („wir“). KüchenWert ist eine Marke der WohnWert GmbH.</p>

<h2>§ 2 Unsere Leistungen</h2>
<p>(1) KüchenWert ist eine kostenlose Vermittlungsplattform für neue Küchen. Sie können Angebote für Ihre geplante Küche anfragen, ein vorhandenes Angebot eines Küchenstudios vergleichen und unterbieten lassen oder Ihre Traumküche im Planer mit Kostenschätzung und KI-Visualisierung entwerfen und daraus eine Anfrage erstellen.</p>
<p>(2) Wir schreiben Ihr Projekt – gegebenenfalls nach unserer Prüfung – ohne Namen und Kontaktdaten an geprüfte Küchenstudios in Ihrer Region aus. Die Studios können innerhalb der angezeigten Frist Angebote abgeben. Höchstens drei Studios können Ihre Kontaktdaten vorab für Rückfragen erhalten. Ihre Telefonnummer erhalten Studios vor einem Zuschlag nur, wenn Sie Anrufe von Studios erlaubt haben.</p>
<p>(3) Kostenschätzungen, Preisrahmen und KI-Visualisierungen sind unverbindliche Orientierungshilfen. Verbindlich sind nur Angebote und Verträge der Küchenstudios.</p>
<p>(4) Wir verkaufen keine Küchen. Verträge über Planung, Lieferung und Montage schließen Sie ausschließlich mit dem Küchenstudio; für deren Inhalt und Erfüllung ist das Studio verantwortlich.</p>
<p>(5) Ein Anspruch darauf, dass Studios Angebote abgeben, besteht nicht. Gibt es in Ihrer Region noch keine freigeschalteten Studios, informieren wir Sie darüber.</p>

<h2>§ 3 Kosten, Vergütung und Reihenfolge der Angebote</h2>
<p>(1) Die Nutzung ist für Kund:innen kostenlos und verpflichtet nicht zur Annahme eines Angebots.</p>
<p>(2) Wir erhalten eine Vergütung von den Küchenstudios: für die Freischaltung von Kontaktdaten sowie eine Vermittlungsprovision, wenn Sie ein Angebot annehmen.</p>
<p>(3) Angebote werden Ihnen nach Preis sortiert angezeigt. Studios können keine bessere Platzierung erwerben; die Vergütung an uns hat keinen Einfluss auf die Reihenfolge.</p>

<h2>§ 4 Projektseite und Entscheidung</h2>
<p>(1) Nach dem Absenden erhalten Sie per E-Mail einen persönlichen Link zu Ihrer Projektseite. Er ermöglicht den Zugriff ohne Passwort; bitte geben Sie ihn nicht weiter. Links sind 180 Tage gültig; einen neuen Link können Sie jederzeit anfordern.</p>
<p>(2) Nehmen Sie ein Angebot an, übermitteln wir Ihre Kontaktdaten an das Studio, damit es Aufmaß und Beratung mit Ihnen vereinbart. Die Annahme ist noch kein Kaufvertrag über die Küche.</p>
<p>(3) Sie können Ihr Projekt jederzeit auf der Projektseite beenden; eine laufende Ausschreibung wird dann geschlossen.</p>

<h2>§ 5 Ihre Angaben und Inhalte</h2>
<p>(1) Bitte machen Sie wahrheitsgemäße Angaben und laden Sie nur Fotos und Dokumente hoch, an denen Sie die erforderlichen Rechte haben. Fotos sollen keine Personen zeigen.</p>
<p>(2) Sie räumen uns das einfache, auf die Durchführung Ihres Projekts beschränkte Recht ein, Ihre Angaben und Uploads zu speichern, für die Ausschreibung aufzubereiten, an Küchenstudios zu übermitteln und für die KI-Visualisierung zu verarbeiten.</p>
<p>(3) Scheinanfragen, Anfragen mit fremden Kontaktdaten und automatisierte Eingaben sind unzulässig; solche Anfragen dürfen wir löschen.</p>

<h2>§ 6 Verfügbarkeit</h2>
<p>Wir bemühen uns um eine möglichst unterbrechungsfreie Nutzbarkeit, schulden aber keine bestimmte Verfügbarkeit. Wartung und Störungen können die Nutzung vorübergehend einschränken.</p>

<h2>§ 7 Haftung</h2>
<p>(1) Wir haften unbeschränkt bei Vorsatz und grober Fahrlässigkeit, bei Verletzung von Leben, Körper oder Gesundheit sowie nach dem Produkthaftungsgesetz.</p>
<p>(2) Bei leichter Fahrlässigkeit haften wir nur für die Verletzung wesentlicher Vertragspflichten, deren Erfüllung die Nutzung der Plattform erst ermöglicht und auf die Sie vertrauen dürfen, begrenzt auf den vorhersehbaren, vertragstypischen Schaden.</p>
<p>(3) Für Angebote, Leistungen und Verträge der Küchenstudios haften wir nicht.</p>

<h2>§ 8 Datenschutz und Einwilligungen</h2>
<p>Wie wir Ihre Daten verarbeiten, lesen Sie in der <a href="/datenschutz">Datenschutzerklärung</a>. Einwilligungen, etwa in Anrufe durch Studios oder Werbung, können Sie jederzeit widerrufen. Eine Auskunft über Ihre Daten und deren Löschung können Sie direkt auf Ihrer Projektseite anfordern.</p>

<h2>§ 9 Laufzeit und Beendigung</h2>
<p>Die Nutzung endet, wenn Sie Ihr Projekt beenden oder Ihre Daten löschen lassen, spätestens mit Ablauf der in der Datenschutzerklärung genannten Speicherfristen.</p>

<h2>§ 10 Änderungen</h2>
<p>Wir können diese Bedingungen für die Zukunft ändern, etwa wenn sich unsere Leistungen oder die Rechtslage ändern. Geänderte Bedingungen gelten für Anfragen, die nach ihrer Veröffentlichung abgesendet werden.</p>

<h2>§ 11 Verbraucherstreitbeilegung</h2>
<p>Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p>

<h2>§ 12 Schlussbestimmungen</h2>
<p>(1) Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts. Gegenüber Verbraucher:innen gilt diese Rechtswahl nur, soweit ihnen dadurch nicht der Schutz zwingender Bestimmungen des Staates ihres gewöhnlichen Aufenthalts entzogen wird.</p>
<p>(2) Ist die Kundin oder der Kunde Kaufmann, juristische Person des öffentlichen Rechts oder öffentlich-rechtliches Sondervermögen, ist Gerichtsstand Hannover.</p>
<p>(3) Sollten einzelne Bestimmungen unwirksam sein, bleibt die Wirksamkeit der übrigen unberührt.</p>

<p><em>Stand: 28. September 2026</em></p>
$agb$
where slug = 'agb';

insert into public.legal_pages (slug, title, is_published, content)
values ('konditionen', 'Konditionen für Küchenstudios', true, $konditionen$
<p>Diese Bedingungen gelten für Küchenstudios, die das Studio-Portal von KüchenWert nutzen. Für Kund:innen gelten die <a href="/agb">AGB</a>.</p>

<h2>§ 1 Geltungsbereich und Vertragsschluss</h2>
<p>(1) Diese Konditionen gelten für die Nutzung des Studio-Portals durch Küchenstudios und andere Unternehmer im Sinne von § 14 BGB („Studios“). Anbieterin ist die WohnWert GmbH, Hannoversche Str. 106, 30627 Hannover („wir“); KüchenWert ist eine Marke der WohnWert GmbH.</p>
<p>(2) Mit der Registrierung bietet das Studio den Abschluss eines Nutzungsvertrags an. Der Vertrag kommt mit der Freischaltung durch uns zustande. Vorher prüfen wir die Unternehmensangaben und Nachweise (zum Beispiel Gewerbeanmeldung oder Handelsregisterauszug).</p>
<p>(3) Abweichende Geschäftsbedingungen des Studios gelten nicht.</p>

<h2>§ 2 Leistungen</h2>
<p>(1) <strong>Projekt-Börse:</strong> Studios sehen ausgeschriebene Küchenprojekte aus ihrem Einzugsgebiet (Postleitzahl und Umkreis, im Portal einstellbar) mit Projektbeschreibung, Maßen, Wünschen und gegebenenfalls Fotos und Visualisierungen, jedoch ohne Namen und Kontaktdaten der Kund:innen.</p>
<p>(2) <strong>Angebote:</strong> Während der Angebotsphase kann das Studio ein Angebot abgeben und bis zu deren Ende ändern oder zurückziehen. Das Angebot nennt den Gesamtpreis einschließlich Umsatzsteuer für den beschriebenen Leistungsumfang. Angebote unterhalb des angezeigten Mindestangebots sind nicht möglich.</p>
<p>(3) <strong>Kontaktfreischaltung:</strong> Solange Plätze frei sind, kann das Studio die Kontaktdaten gegen Entgelt freischalten. Die Telefonnummer wird nur übermittelt, wenn die Kund:in Anrufe von Studios erlaubt hat.</p>
<p>(4) <strong>Zuschlag:</strong> Nimmt die Kund:in ein Angebot an, erhält das Studio die Kontaktdaten und verwaltet den Auftrag im Portal.</p>
<p>(5) Ein Anspruch auf eine bestimmte Zahl von Projekten oder Aufträgen besteht nicht.</p>

<h2>§ 3 Pflichten des Studios</h2>
<p>(1) Das Studio macht wahrheitsgemäße Angaben zu seinem Unternehmen und seinen Angeboten und gibt keine Lockangebote ab.</p>
<p>(2) Das Studio nimmt nur zum jeweiligen Küchenprojekt Kontakt auf. Anrufe sind nur zulässig, wenn die Kund:in sie erlaubt hat; Werbung nur mit eigener Einwilligung der Kund:in.</p>
<p>(3) Das Studio verarbeitet die übermittelten Kundendaten als eigener Verantwortlicher im Sinne von Art. 4 Nr. 7 DSGVO, vertraulich und nur für das Projekt, und löscht sie, sobald sie dafür nicht mehr benötigt werden und keine Aufbewahrungspflichten bestehen.</p>
<p>(4) Nach einem Zuschlag meldet das Studio den Fortschritt (Kontaktaufnahme, Aufmaß, Vertragsschluss, Montage oder Nichtzustandekommen) wahrheitsgemäß und zeitnah im Portal.</p>
<p>(5) Nimmt die Kund:in ein über KüchenWert abgegebenes Angebot außerhalb der Plattform an, gilt dies als Zuschlag im Sinne von § 4 Abs. 2.</p>

<h2>§ 4 Vergütung</h2>
<p>(1) <strong>Kontaktfreischaltung:</strong> Der Preis wird vor der Freischaltung angezeigt. Er richtet sich nach dem geschätzten Projektwert und der Qualität der Anfrage; ohne passende Preisregel gilt der angezeigte Standardpreis. Der Anspruch entsteht mit der Freischaltung.</p>
<p>(2) <strong>Vermittlungsprovision:</strong> Nimmt die Kund:in das Angebot des Studios an, entsteht eine Provision auf den angenommenen Angebotspreis (brutto):</p>
<ul>
<li>bis 10.000 €: 2,0 %, mindestens 200 €</li>
<li>10.000 € bis unter 15.000 €: 1,8 %, mindestens 250 €</li>
<li>15.000 € bis unter 25.000 €: 1,6 %, mindestens 300 €</li>
<li>25.000 € bis unter 40.000 €: 1,4 %, mindestens 400 €</li>
<li>ab 40.000 €: 1,2 %, mindestens 600 €</li>
</ul>
<p>(3) Kommt der Küchenvertrag aus Gründen nicht zustande, die das Studio nicht zu vertreten hat, und meldet das Studio dies unverzüglich mit Begründung im Portal, stornieren wir die Provision nach Prüfung.</p>
<p>(4) Alle Beträge verstehen sich zuzüglich der gesetzlichen Umsatzsteuer. Für Studios mit Sitz in einem anderen EU-Mitgliedstaat und gültiger USt-IdNr. gilt das Reverse-Charge-Verfahren.</p>
<p>(5) Preise und Provisionssätze für künftige Freischaltungen und Zuschläge können wir ändern; Änderungen kündigen wir mindestens 15 Tage vorher per E-Mail an.</p>

<h2>§ 5 Reklamation gekaufter Kontakte</h2>
<p>(1) Ist ein gekaufter Kontakt fehlerhaft – etwa weil die Kund:in trotz mehrerer Versuche nicht erreichbar ist, die Kontaktdaten falsch sind, kein echtes Küchenprojekt besteht oder der Kontakt doppelt gekauft wurde –, kann das Studio ihn innerhalb von 14 Tagen nach der Freischaltung im Portal reklamieren.</p>
<p>(2) Wir entscheiden in der Regel innerhalb von fünf Werktagen. Erkennen wir die Reklamation an, stornieren wir die Rechnung oder erstatten bereits gezahlte Beträge.</p>
<p>(3) Nach einem Zuschlag an das Studio ist eine Reklamation ausgeschlossen.</p>

<h2>§ 6 Rechnungen, Zahlung und Verzug</h2>
<p>(1) Rechnungen erhält das Studio per E-Mail als PDF; sie sind im Portal abrufbar und innerhalb von 14 Tagen ohne Abzug zahlbar.</p>
<p>(2) Bei Zahlungsverzug erinnern und mahnen wir. Für Mahnungen können wir angemessene Mahngebühren berechnen, die in der Mahnung ausgewiesen sind; die gesetzlichen Verzugsfolgen (§ 288 BGB) bleiben unberührt.</p>
<p>(3) Ab einer fortgeschrittenen Mahnstufe können wir neue Angebote und Kontaktfreischaltungen bis zum Zahlungseingang sperren. Bestehende Projekte und Aufträge bleiben zugänglich.</p>

<h2>§ 7 Reihenfolge und Darstellung</h2>
<p>Angaben nach Art. 5 der Verordnung (EU) 2019/1150:</p>
<p>(1) Die Projekt-Börse zeigt Projekte aus dem Einzugsgebiet des Studios, auf Wunsch gefiltert nach seinem Mindestauftragswert, sortiert nach dem Ende der Angebotsphase (bald endende zuerst).</p>
<p>(2) Kund:innen sehen Angebote nach Preis sortiert. Die Vergütung an uns hat keinen Einfluss auf die Reihenfolge; eine bevorzugte Platzierung kann nicht erworben werden.</p>
<p>(3) Ob Studios das aktuell beste Angebot sehen oder Angebote verdeckt sind, legen wir je Ausschreibung fest; das Portal zeigt es an.</p>

<h2>§ 8 Laufzeit, Kündigung und Sperrung</h2>
<p>(1) Der Vertrag läuft auf unbestimmte Zeit. Das Studio kann jederzeit kündigen, eine E-Mail genügt. Wir können mit einer Frist von 30 Tagen kündigen.</p>
<p>(2) Bei schwerwiegenden Verstößen, insbesondere Missbrauch von Kundendaten, Umgehung der Provision oder Täuschung, können wir das Konto sperren oder fristlos kündigen. Die Gründe teilen wir mit; das Studio kann dazu Stellung nehmen.</p>
<p>(3) Bereits entstandene Vergütungsansprüche bleiben bestehen.</p>

<h2>§ 9 Haftung</h2>
<p>(1) Wir haften unbeschränkt bei Vorsatz und grober Fahrlässigkeit sowie bei Verletzung von Leben, Körper oder Gesundheit.</p>
<p>(2) Bei leichter Fahrlässigkeit haften wir nur für die Verletzung wesentlicher Vertragspflichten, begrenzt auf den vorhersehbaren, vertragstypischen Schaden.</p>
<p>(3) Für die Richtigkeit der Angaben der Kund:innen, das Zustandekommen von Aufträgen und die Zahlungsfähigkeit der Kund:innen haften wir nicht; das Reklamationsrecht nach § 5 bleibt unberührt.</p>

<h2>§ 10 Änderungen dieser Konditionen</h2>
<p>Änderungen teilen wir mindestens 15 Tage vor ihrem Inkrafttreten per E-Mail mit. Das Studio kann den Vertrag bis dahin kündigen.</p>

<h2>§ 11 Beschwerden und Schlussbestimmungen</h2>
<p>(1) Beschwerden richten Studios an <a href="mailto:info@kuechenwert24.de">info@kuechenwert24.de</a>; wir bearbeiten sie zeitnah.</p>
<p>(2) Es gilt das Recht der Bundesrepublik Deutschland. Gerichtsstand ist Hannover.</p>
<p>(3) Sollten einzelne Bestimmungen unwirksam sein, bleibt die Wirksamkeit der übrigen unberührt.</p>

<p><em>Stand: 28. September 2026</em></p>
$konditionen$)
on conflict (slug) do update
set title = excluded.title, is_published = true, content = excluded.content,
    updated_at = now(), published_at = now(), version = public.legal_pages.version + 1;

do $$
declare
  v_old_storage text := '<p><strong>Speicherdauer:</strong> Wir speichern Ihre Anfrage, bis sie erledigt ist, und löschen sie danach, soweit keine gesetzlichen Aufbewahrungspflichten (z. B. aus Handels- und Steuerrecht) entgegenstehen.</p>';
  v_new_storage text := '<p><strong>Speicherdauer:</strong> Endet die Ausschreibung ohne Zuschlag, anonymisieren wir Ihre Anfrage 90 Tage danach; Anfragen ohne Ausschreibung nach 180 Tagen. Nach einem Zuschlag speichern wir die Angaben bis zu 36 Monate, um die Vermittlungsprovision gegenüber dem Küchenstudio abrechnen und belegen zu können (Art. 6 Abs. 1 lit. f DSGVO). Rechnungen an Küchenstudios bewahren wir 10 Jahre auf; sie enthalten keine Kontaktdaten von Ihnen. Den Nachweis Ihrer Einwilligungen behalten wir ohne IP-Adresse und Browserangaben. Löschen können Sie Ihre Daten jederzeit auf Ihrer Projektseite.</p>'
    || '<p>Küchenstudios, die Ihre Kontaktdaten erhalten, verarbeiten sie in eigener Verantwortung für Ihr Küchenprojekt.</p>';
  v_old_photos text := 'Wir löschen Fotos und Visualisierungen, sobald sie für Ihr Projekt nicht mehr benötigt werden.</p>';
  v_new_photos text := 'Wir löschen Fotos und Visualisierungen mit der Anonymisierung Ihrer Anfrage; Planungen, aus denen keine Anfrage wird, 30 Tage nach der letzten Änderung.</p>';
  v_old_mail text := 'Dabei werden Ihre E-Mail-Adresse und der Inhalt der Nachricht verarbeitet (Art. 6 Abs. 1 lit. b und f DSGVO).</p>';
  v_new_mail text := 'Dabei werden Ihre E-Mail-Adresse und der Inhalt der Nachricht verarbeitet (Art. 6 Abs. 1 lit. b und f DSGVO).</p>'
    || '<p>Newsletter und Werbung senden wir nur mit Ihrer Einwilligung. Jede solche E-Mail enthält einen Link, mit dem Sie sich ohne Anmeldung abmelden können; Erteilung und Widerruf protokollieren wir zum Nachweis.</p>';
  v_content text;
begin
  select content into v_content from public.legal_pages where slug = 'datenschutz';
  if v_content is null then
    raise exception 'Datenschutzerklärung fehlt';
  end if;
  if strpos(v_content, v_old_storage) = 0 or strpos(v_content, v_old_photos) = 0 or strpos(v_content, v_old_mail) = 0 then
    raise exception 'Datenschutzerklärung wurde zwischenzeitlich geändert – Ersetzung abgebrochen';
  end if;
  update public.legal_pages
     set content = replace(replace(replace(v_content, v_old_storage, v_new_storage), v_old_photos, v_new_photos), v_old_mail, v_new_mail),
         updated_at = now(),
         published_at = now(),
         version = version + 1
   where slug = 'datenschutz';
end $$;

do $$
begin
  if exists (select 1 from public.legal_pages where slug = 'agb' and (content ilike '%gebraucht%' or content ilike '%Exposee%')) then
    raise exception 'AGB enthalten noch Texte des Gebrauchtküchen-Modells';
  end if;
end $$;
