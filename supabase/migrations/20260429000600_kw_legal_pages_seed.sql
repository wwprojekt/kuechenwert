-- ---------------------------------------------------------------------
-- KuechenWert — Legal Pages Seed (Phase 3.4)
-- ---------------------------------------------------------------------
-- Fuellt die Tabelle `legal_pages` mit Impressum, Datenschutz und AGB
-- fuer die KuechenWert-Marke. Rechtstraeger ist die WohnWert GmbH
-- (Hannoversche Str. 106, 30627 Hannover, HRB 230114) — dieselbe Firma
-- betreibt auch CaravanWert.
--
-- Die Inhalte basieren auf den etablierten CaravanWert-Texten und wurden
-- auf die KuechenWert-Mechanik (Funnel A: Lead-Gen, Funnel B: Angebots-
-- vergleich/Reverse-Auction, Funnel C: Traumkueche AI) angepasst.
--
-- Idempotent via ON CONFLICT: kann bedenkenlos mehrfach ausgefuehrt werden.
-- ---------------------------------------------------------------------

-- Impressum ------------------------------------------------------------
INSERT INTO public.legal_pages (slug, title, content, meta_description, is_published, version, published_at)
VALUES (
  'impressum',
  'Impressum',
  $kwhtml$<h1><strong>Impressum</strong></h1><p><strong>Angaben gemäß § 5 TMG</strong></p><p>WohnWert GmbH<br>Hannoversche Str. 106<br>30627 Hannover<br>Deutschland</p><p>KüchenWert ist eine Marke der WohnWert GmbH.</p><p><strong>Handelsregister:</strong> HRB 230114</p><p><strong>Registergericht:</strong> Amtsgericht Hannover</p><p><strong>Vertreten durch die Geschäftsführerin:</strong> Mona Kareem-Ameen</p><p><strong>Kontakt</strong></p><p>Telefon: 0511 / 51532476<br>E-Mail: <a target="_blank" rel="noopener noreferrer nofollow" class="text-primary underline" href="mailto:info@kuechenwert.de"><u>info@kuechenwert.de</u></a></p><p><strong>Umsatzsteuer-ID</strong></p><p>Umsatzsteuer-Identifikationsnummer gemäß § 27 a Umsatzsteuergesetz: <em>Beantragt!</em></p><p><strong>Redaktionell verantwortlich</strong></p><p>Mona Kareem-Ameen<br>Hannoversche Str. 106<br>30627 Hannover</p><p><strong>EU-Streitschlichtung</strong></p><p>Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit: <a target="_blank" rel="noopener noreferrer nofollow" class="text-primary underline" href="https://ec.europa.eu/consumers/odr/"><u>https://ec.europa.eu/consumers/odr/</u></a>.<br>Unsere E-Mail-Adresse finden Sie oben im Impressum.</p><p><strong>Verbraucher­streit­beilegung/Universal­schlichtungs­stelle</strong></p><p>Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p><p><strong>Haftung für Inhalte</strong></p><p>Als Diensteanbieter sind wir gemäß § 7 Abs. 1 TMG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 TMG sind wir als Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen.</p><p>Verpflichtungen zur Entfernung oder Sperrung der Nutzung von Informationen nach den allgemeinen Gesetzen bleiben hiervon unberührt. Eine diesbezügliche Haftung ist jedoch erst ab dem Zeitpunkt der Kenntnis einer konkreten Rechtsverletzung möglich. Bei Bekanntwerden von entsprechenden Rechtsverletzungen werden wir diese Inhalte umgehend entfernen.</p><p><strong>Haftung für Links</strong></p><p>Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen Einfluss haben. Deshalb können wir für diese fremden Inhalte auch keine Gewähr übernehmen. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten verantwortlich. Die verlinkten Seiten wurden zum Zeitpunkt der Verlinkung auf mögliche Rechtsverstöße überprüft. Rechtswidrige Inhalte waren zum Zeitpunkt der Verlinkung nicht erkennbar.</p><p>Eine permanente inhaltliche Kontrolle der verlinkten Seiten ist jedoch ohne konkrete Anhaltspunkte einer Rechtsverletzung nicht zumutbar. Bei Bekanntwerden von Rechtsverletzungen werden wir derartige Links umgehend entfernen.</p><p><strong>Urheberrecht</strong></p><p>Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen dem deutschen Urheberrecht. Die Vervielfältigung, Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der Grenzen des Urheberrechtes bedürfen der schriftlichen Zustimmung des jeweiligen Autors bzw. Erstellers. Downloads und Kopien dieser Seite sind nur für den privaten, nicht kommerziellen Gebrauch gestattet.</p><p>Soweit die Inhalte auf dieser Seite nicht vom Betreiber erstellt wurden, werden die Urheberrechte Dritter beachtet. Insbesondere werden Inhalte Dritter als solche gekennzeichnet. Sollten Sie trotzdem auf eine Urheberrechtsverletzung aufmerksam werden, bitten wir um einen entsprechenden Hinweis. Bei Bekanntwerden von Rechtsverletzungen werden wir derartige Inhalte umgehend entfernen.</p>$kwhtml$,
  'Impressum und Anbieterkennzeichnung von KüchenWert — einer Marke der WohnWert GmbH, Hannover.',
  true,
  1,
  now()
)
ON CONFLICT (slug) DO UPDATE
SET
  title = EXCLUDED.title,
  content = EXCLUDED.content,
  meta_description = EXCLUDED.meta_description,
  is_published = EXCLUDED.is_published,
  version = legal_pages.version + 1,
  published_at = now(),
  updated_at = now();
