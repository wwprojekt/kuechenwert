-- Create legal_pages table for editable AGB, Datenschutz, and Impressum content
-- Admins can edit these pages through the admin panel

CREATE TABLE legal_pages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL, -- 'agb', 'datenschutz', 'impressum'
  title TEXT NOT NULL,
  content TEXT NOT NULL, -- HTML content
  version INTEGER DEFAULT 1,
  is_published BOOLEAN DEFAULT true,
  published_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comments for documentation
COMMENT ON TABLE legal_pages IS 'Editable legal pages (AGB, Datenschutz, Impressum)';
COMMENT ON COLUMN legal_pages.slug IS 'URL-friendly identifier: agb, datenschutz, impressum';
COMMENT ON COLUMN legal_pages.content IS 'HTML content of the legal page';
COMMENT ON COLUMN legal_pages.version IS 'Version number, incremented on each save';

-- Enable Row Level Security
ALTER TABLE legal_pages ENABLE ROW LEVEL SECURITY;

-- Public can read published pages
CREATE POLICY "Public can read published" ON legal_pages
  FOR SELECT USING (is_published = true);

-- Admins can manage all pages
CREATE POLICY "Admins can manage" ON legal_pages
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Insert default AGB content with new clause for undisclosed damages
INSERT INTO legal_pages (slug, title, content) VALUES
('agb', 'Allgemeine Geschäftsbedingungen', '
<h2>§ 1 Geltungsbereich</h2>
<p>Diese Allgemeinen Geschäftsbedingungen (AGB) gelten für alle Verträge zwischen CamperAnker24 GmbH (nachfolgend „Anbieter") und seinen Kunden über die Nutzung der Online-Plattform zum Kauf und Verkauf von Wohnmobilen.</p>

<h2>§ 2 Vertragsschluss</h2>
<p>Die Darstellung der Wohnmobile auf unserer Website stellt kein rechtlich bindendes Angebot dar, sondern eine Aufforderung zur Abgabe eines Angebots. Durch die Registrierung und das Einstellen eines Wohnmobils geben Sie ein verbindliches Angebot zum Verkauf ab.</p>

<h2>§ 3 Verkauf von Wohnmobilen</h2>
<h3>3.1 Verkaufsoptionen</h3>
<p>Der Verkäufer kann zwischen folgenden Verkaufsoptionen wählen:</p>
<ul>
<li>Auktion mit Mindestpreis</li>
<li>Sofortverkauf zum Festpreis</li>
<li>Kombination aus Auktion und Sofortverkauf</li>
</ul>

<h3>3.2 Verkäuferpflichten</h3>
<p>Der Verkäufer verpflichtet sich:</p>
<ul>
<li>Wahrheitsgemäße und vollständige Angaben zum Fahrzeug zu machen</li>
<li>Mindestens 12 aussagekräftige Fotos bereitzustellen</li>
<li>Alle bekannten Mängel anzugeben</li>
<li>Das Fahrzeug in dem beschriebenen Zustand zu übergeben</li>
</ul>

<h2>§ 4 Kauf von Wohnmobilen</h2>
<h3>4.1 Gebote bei Auktionen</h3>
<p>Gebote sind verbindlich. Der Höchstbietende erwirbt nach Ablauf der Auktion das Fahrzeug, sofern der Mindestpreis erreicht wurde.</p>

<h3>4.2 Käuferpflichten</h3>
<p>Der Käufer verpflichtet sich:</p>
<ul>
<li>Das Fahrzeug innerhalb von 14 Tagen nach Vertragsschluss abzuholen</li>
<li>Den Kaufpreis vollständig vor Übergabe zu zahlen</li>
<li>Das Fahrzeug vor Abholung zu besichtigen oder auf eigenes Risiko zu verzichten</li>
</ul>

<h2>§ 5 Provision und Gebühren</h2>
<p>Der Anbieter erhebt eine erfolgsbasierte Provision in Höhe von 5% des Verkaufspreises. Die Provision wird beim Verkäufer nach erfolgreicher Transaktion fällig. Die Einstellung von Fahrzeugen ist kostenlos.</p>

<h2>§ 6 Provision bei nicht angegebenen Mängeln</h2>
<p>Verweigert der Händler den Kauf des Wohnmobils aufgrund von:</p>
<ul>
<li>nicht angegebenen Schäden oder Mängeln, oder</li>
<li>erheblichen Abweichungen zwischen Beschreibung und tatsächlichem Zustand,</li>
</ul>
<p>so ist der Verkäufer verpflichtet, die vereinbarte Provision an CamperAnker24 zu entrichten. Dies gilt auch wenn kein Kaufvertrag zustande kommt.</p>

<h2>§ 7 Gewährleistung und Haftung</h2>
<h3>7.1 Gewährleistung zwischen Käufer und Verkäufer</h3>
<p>Die Gewährleistung richtet sich nach den gesetzlichen Bestimmungen. Bei Privatverkäufen kann die Gewährleistung ausgeschlossen werden.</p>

<h3>7.2 Haftung des Anbieters</h3>
<p>Der Anbieter haftet nicht für die Richtigkeit der Angaben der Verkäufer. Die Plattform dient lediglich als Vermittler zwischen Käufer und Verkäufer.</p>

<h2>§ 8 Widerrufsrecht</h2>
<p>Verbrauchern steht ein gesetzliches Widerrufsrecht zu. Die Widerrufsfrist beträgt 14 Tage ab dem Tag des Vertragsschlusses. Das Widerrufsrecht erlischt bei vollständiger Vertragserfüllung.</p>

<h2>§ 9 Datenschutz</h2>
<p>Die Verarbeitung personenbezogener Daten erfolgt gemäß der Datenschutz-Grundverordnung (DSGVO) und dem Bundesdatenschutzgesetz (BDSG). Weitere Informationen finden Sie in unserer Datenschutzerklärung.</p>

<h2>§ 10 Schlussbestimmungen</h2>
<p>Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts. Sollten einzelne Bestimmungen dieser AGB unwirksam sein, bleibt die Wirksamkeit der übrigen Bestimmungen davon unberührt.</p>
');

-- Insert default Datenschutz content
INSERT INTO legal_pages (slug, title, content) VALUES
('datenschutz', 'Datenschutzerklärung', '
<h2>1. Datenschutz auf einen Blick</h2>
<h3>Allgemeine Hinweise</h3>
<p>Die folgenden Hinweise geben einen einfachen Überblick darüber, was mit Ihren personenbezogenen Daten passiert, wenn Sie diese Website besuchen. Personenbezogene Daten sind alle Daten, mit denen Sie persönlich identifiziert werden können.</p>

<h2>2. Datenerfassung auf dieser Website</h2>
<h3>Wer ist verantwortlich für die Datenerfassung auf dieser Website?</h3>
<p>Die Datenverarbeitung auf dieser Website erfolgt durch den Websitebetreiber. Dessen Kontaktdaten können Sie dem Impressum dieser Website entnehmen.</p>

<h3>Wie erfassen wir Ihre Daten?</h3>
<p>Ihre Daten werden zum einen dadurch erhoben, dass Sie uns diese mitteilen. Hierbei kann es sich z.B. um Daten handeln, die Sie in ein Kontaktformular eingeben.</p>
<p>Andere Daten werden automatisch oder nach Ihrer Einwilligung beim Besuch der Website durch unsere IT-Systeme erfasst. Das sind vor allem technische Daten (z.B. Internetbrowser, Betriebssystem oder Uhrzeit des Seitenaufrufs).</p>

<h2>3. Allgemeine Hinweise und Pflichtinformationen</h2>
<h3>Datenschutz</h3>
<p>Die Betreiber dieser Seiten nehmen den Schutz Ihrer persönlichen Daten sehr ernst. Wir behandeln Ihre personenbezogenen Daten vertraulich und entsprechend der gesetzlichen Datenschutzvorschriften sowie dieser Datenschutzerklärung.</p>
<p>Wenn Sie diese Website benutzen, werden verschiedene personenbezogene Daten erhoben. Personenbezogene Daten sind Daten, mit denen Sie persönlich identifiziert werden können.</p>

<h2>4. Datenerfassung auf dieser Website</h2>
<h3>Cookies</h3>
<p>Unsere Internetseiten verwenden so genannte „Cookies". Cookies sind kleine Textdateien und richten auf Ihrem Endgerät keinen Schaden an. Sie werden entweder vorübergehend für die Dauer einer Sitzung (Session-Cookies) oder dauerhaft (permanente Cookies) auf Ihrem Endgerät gespeichert.</p>

<h3>Server-Log-Dateien</h3>
<p>Der Provider der Seiten erhebt und speichert automatisch Informationen in so genannten Server-Log-Dateien, die Ihr Browser automatisch an uns übermittelt. Dies sind:</p>
<ul>
<li>Browsertyp und Browserversion</li>
<li>verwendetes Betriebssystem</li>
<li>Referrer URL</li>
<li>Hostname des zugreifenden Rechners</li>
<li>Uhrzeit der Serveranfrage</li>
<li>IP-Adresse</li>
</ul>

<h2>5. Kontaktformular</h2>
<p>Wenn Sie uns per Kontaktformular Anfragen zukommen lassen, werden Ihre Angaben aus dem Anfrageformular inklusive der von Ihnen dort angegebenen Kontaktdaten zwecks Bearbeitung der Anfrage und für den Fall von Anschlussfragen bei uns gespeichert.</p>

<h2>6. Ihre Rechte</h2>
<p>Sie haben jederzeit das Recht:</p>
<ul>
<li>Auskunft über Ihre bei uns gespeicherten personenbezogenen Daten zu erhalten</li>
<li>Berichtigung unrichtiger personenbezogener Daten zu verlangen</li>
<li>Löschung Ihrer bei uns gespeicherten personenbezogenen Daten zu verlangen</li>
<li>Einschränkung der Datenverarbeitung zu verlangen</li>
<li>Widerspruch gegen die Verarbeitung Ihrer Daten einzulegen</li>
<li>Datenübertragbarkeit zu verlangen</li>
</ul>

<h2>7. Änderung dieser Datenschutzerklärung</h2>
<p>Wir behalten uns vor, diese Datenschutzerklärung gelegentlich anzupassen, damit sie stets den aktuellen rechtlichen Anforderungen entspricht oder um Änderungen unserer Leistungen in der Datenschutzerklärung umzusetzen.</p>
');

-- Insert default Impressum content
INSERT INTO legal_pages (slug, title, content) VALUES
('impressum', 'Impressum', '
<h2>Angaben gemäß § 5 TMG</h2>
<p>CamperAnker24 GmbH<br>Musterstraße 123<br>80331 München<br>Deutschland</p>

<h2>Vertreten durch</h2>
<p>Geschäftsführer: Max Mustermann</p>

<h2>Kontakt</h2>
<p>Telefon: +49 800 123 4567<br>E-Mail: info@camperanker24.de</p>

<h2>Registereintrag</h2>
<p>Eintragung im Handelsregister<br>Registergericht: Amtsgericht München<br>Registernummer: HRB 123456</p>

<h2>Umsatzsteuer-ID</h2>
<p>Umsatzsteuer-Identifikationsnummer gemäß §27a Umsatzsteuergesetz:<br>DE123456789</p>

<h2>Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV</h2>
<p>Max Mustermann<br>Musterstraße 123<br>80331 München</p>

<h2>Streitschlichtung</h2>
<p>Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit: <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer">https://ec.europa.eu/consumers/odr</a>.</p>
<p>Unsere E-Mail-Adresse finden Sie oben im Impressum. Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p>

<h2>Haftung für Inhalte</h2>
<p>Als Diensteanbieter sind wir gemäß § 7 Abs.1 TMG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 TMG sind wir als Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen.</p>

<h2>Haftung für Links</h2>
<p>Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen Einfluss haben. Deshalb können wir für diese fremden Inhalte auch keine Gewähr übernehmen. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten verantwortlich.</p>

<h2>Urheberrecht</h2>
<p>Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen dem deutschen Urheberrecht. Die Vervielfältigung, Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der Grenzen des Urheberrechtes bedürfen der schriftlichen Zustimmung des jeweiligen Autors bzw. Erstellers.</p>
');
