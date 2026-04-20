-- =====================================================================
-- Phase 4 / Hardening: AGB § 6 auf Phase-4-Logik aktualisieren
-- =====================================================================
-- Behebt Bug #13 aus Audit Round 3:
--   * legal_pages.agb (version=5) beschreibt noch:
--       - 72h Kaufchance      → tatsächlich 24h
--       - 7-Tage-Runden       → tatsächlich 3 Tage
--       - unbegrenzte Runden  → tatsächlich max 4
--       - Mindestpreis = niedrigstes Gegenangebot → tatsächlich -2 % / Runde
--   * Keine Erwähnung von dynamic_pricing, 5min Soft-Close, 60-Tage Bestand-Cap
--
-- Folge: Verkäufer akzeptieren AGB die NICHT zur Systemlogik passen
--   → §6 wäre nach § 305c/§ 307 BGB unwirksam (überraschende Klausel)
--   → Verkäufer könnte 16-Tage-Bindung jederzeit anfechten
--
-- Diese Migration:
--   1) Ersetzt §6 in legal_pages atomar durch Phase-4-konformen Text
--   2) Bumpt legal_pages.version von 5 → 6
--   3) Refactort get_current_agb_version() so dass es die Version aus
--      legal_pages.version liest (Single Source of Truth) statt hardcoded
-- =====================================================================

-- ─── 1) §6 Replace + Version-Bump ──────────────────────────────────────
DO $$
DECLARE
  v_old_content text;
  v_section_start int;
  v_section_end int;
  v_new_section text;
  v_before text;
  v_after text;
  v_new_content text;
BEGIN
  SELECT content INTO v_old_content
    FROM public.legal_pages
   WHERE slug = 'agb'
   FOR UPDATE;

  IF v_old_content IS NULL THEN
    RAISE EXCEPTION 'AGB legal_page nicht gefunden – Migration abgebrochen';
  END IF;

  -- §6 anhand des h2-Headers lokalisieren. Wir suchen den exakten Header
  -- der aktuellen Version 5; wenn der nicht da ist (z.B. weil schon
  -- migriert), brechen wir idempotent ab.
  v_section_start := position(
    '<h2 style="font-size:24px;font-weight:700;margin-top:40px;margin-bottom:16px;">§ 6 Nachverhandlung'
    IN v_old_content
  );

  IF v_section_start = 0 THEN
    -- Idempotent: bereits aktualisiert oder Format geändert
    RAISE NOTICE 'AGB §6 nicht im Format der Version 5 gefunden – Migration übersprungen (idempotent).';
    RETURN;
  END IF;

  v_section_end := position(
    '<h2 style="font-size:24px;font-weight:700;margin-top:40px;margin-bottom:16px;">§ 7'
    IN v_old_content
  );

  IF v_section_end = 0 OR v_section_end <= v_section_start THEN
    RAISE EXCEPTION 'AGB §7 Header nicht gefunden – Format kaputt, Migration abgebrochen';
  END IF;

  v_before := substring(v_old_content FROM 1 FOR v_section_start - 1);
  v_after  := substring(v_old_content FROM v_section_end);

  -- Neuer §6 — Phase-4-konform, juristisch sauber.
  -- Wichtig: identisches HTML-Markup wie die anderen Sektionen, damit das
  -- Frontend (LegalPage.tsx) das stilkonsistent rendert.
  v_new_section :=
    '<h2 style="font-size:24px;font-weight:700;margin-top:40px;margin-bottom:16px;">§ 6 Marketingphase, automatische Wiedereinstellung und Preisanpassung</h2>' || E'\n' ||
    '<ol style="list-style-type:decimal;padding-left:24px;margin-bottom:32px;">' || E'\n' ||
    '<li style="margin-bottom:12px;font-size:16px;line-height:1.7;"><strong>Marketingphase und Pflichtzustimmung:</strong> Beim Einstellen eines Fahrzeugs in den Verkaufsweg „Auktion" oder „Festpreis" wird das Inserat in eine zeitlich befristete Marketingphase aufgenommen. Der Verkäufer stimmt dieser Marketingphase einschließlich der automatischen Wiedereinstellung (Absatz 2/3), der automatischen Preisanpassung (Absatz 4) und der konkreten Höchstdauer (Absatz 2/3) ausdrücklich beim Einstellen des Inserats über eine Pflicht-Checkbox im Wizard zu. Diese Zustimmung ist Voraussetzung für die Nutzung dieser Verkaufswege und gilt als ausdrückliche Einwilligung gemäß §§ 305b, 305c BGB. Ohne Zustimmung können nur Verkaufsweg „Ankaufstation" oder klassischer Privatverkauf gewählt werden.</li>' || E'\n' ||
    '<li style="margin-bottom:12px;font-size:16px;line-height:1.7;"><strong>Auktion – Ablauf und Dauer:</strong> Eine Auktionsrunde dauert <strong>3 Tage</strong>. Endet sie ohne Erreichen des Mindestpreises, schließt sich eine Kaufchance-Phase von <strong>24 Stunden</strong> an, in der der Höchstbietende das Fahrzeug zum aktuell höchsten Gebot übernehmen oder ein Gegenangebot abgeben kann. Endet die Kaufchance-Phase ohne Einigung, wird das Inserat automatisch in eine Folgerunde überführt. <strong>Maximal 4 Auktionsrunden</strong> werden automatisch ausgeführt; die gesamte Marketingphase ist auf <strong>höchstens 16 Tage</strong> ab Aktivierung begrenzt. Wird das Fahrzeug innerhalb dieser Frist nicht verkauft, kontaktieren wir den Verkäufer per E-Mail mit drei Optionen (erneut einstellen / Preis manuell anpassen / archivieren) – ohne aktive Bestätigung des Verkäufers erfolgt keine weitere Wiedereinstellung.</li>' || E'\n' ||
    '<li style="margin-bottom:12px;font-size:16px;line-height:1.7;"><strong>Festpreis-Inserat – Ablauf und Dauer:</strong> Ein Festpreis-Inserat wird für <strong>3 Tage</strong> geschaltet und automatisch um jeweils weitere 3 Tage verlängert, sofern der Verkäufer die Verlängerung nicht im Dashboard deaktiviert hat. Die gesamte Marketingphase ist auf <strong>höchstens 30 Tage</strong> ab Aktivierung begrenzt. Nach Ablauf gilt die gleiche Drei-Optionen-Regelung wie in Absatz 2.</li>' || E'\n' ||
    '<li style="margin-bottom:12px;font-size:16px;line-height:1.7;"><strong>Automatische Preisanpassung (optional, voreingestellt:</strong> bei Auktion aktiv, bei Festpreis deaktiviert<strong>):</strong> Ist die automatische Preisanpassung aktiviert, sinkt der Mindestpreis (bei Auktion) bzw. der Festpreis mit jeder neuen Runde um <strong>maximal 2 %</strong> vom zuletzt gültigen Preis. Die Gesamtreduktion ist nach unten gedeckelt:' || E'\n' ||
    '<ul style="list-style-type:disc;padding-left:24px;margin-top:8px;">' || E'\n' ||
    '<li style="margin-bottom:8px;font-size:16px;line-height:1.7;"><strong>Auktion:</strong> maximal <strong>6 %</strong> unter dem vom Verkäufer eingegebenen Wunsch-Mindestpreis (Reduktionsboden).</li>' || E'\n' ||
    '<li style="margin-bottom:8px;font-size:16px;line-height:1.7;"><strong>Festpreis:</strong> maximal <strong>10 %</strong> unter dem vom Verkäufer eingegebenen Wunsch-Festpreis (Reduktionsboden).</li>' || E'\n' ||
    '</ul>' || E'\n' ||
    'Unter den Reduktionsboden wird das Fahrzeug niemals automatisch verkauft. Der Verkäufer kann die automatische Preisanpassung jederzeit über sein Dashboard ein- oder ausschalten („Automatische Preisanpassung"-Toggle). Bei manueller Änderung des Mindest- bzw. Festpreises durch den Verkäufer wird die automatische Preisanpassung systembedingt deaktiviert; der Verkäufer kann sie anschließend bewusst wieder aktivieren.</li>' || E'\n' ||
    '<li style="margin-bottom:12px;font-size:16px;line-height:1.7;"><strong>Verlängerung der Schlussphase (Soft-Close):</strong> Wird in den letzten <strong>5 Minuten</strong> einer Auktionsrunde ein neues Gebot abgegeben, verlängert sich das Auktionsende automatisch um weitere <strong>5 Minuten</strong> – und zwar so oft, bis ein voller 5-Minuten-Block ohne weiteres Gebot vergangen ist. Diese Regelung dient der Wahrung fairer Wettbewerbsbedingungen für alle Bieter (kein „Last-Second-Sniping").</li>' || E'\n' ||
    '<li style="margin-bottom:12px;font-size:16px;line-height:1.7;"><strong>Steuerung durch den Verkäufer:</strong> Der Verkäufer kann jederzeit über sein Dashboard die automatische Wiedereinstellung deaktivieren („Auto-Relist"-Toggle) und/oder die automatische Preisanpassung deaktivieren („Dynamic Pricing"-Toggle). Beide Toggles wirken ab der nächsten Runde; eine bereits laufende Auktion oder Kaufchance läuft regulär bis zum Ende.</li>' || E'\n' ||
    '<li style="margin-bottom:12px;font-size:16px;line-height:1.7;"><strong>Außerordentliches Kündigungsrecht:</strong> Bei Vorliegen eines wichtigen Grundes (insbesondere Verkauf an Privat, technischer Defekt, persönliche oder familiäre Umstände) hat der Verkäufer ein außerordentliches Kündigungsrecht der Marketingphase vor Ablauf der Höchstdauer. Die Kündigung kann über das Dashboard, per E-Mail an info@caravanwert.de oder per Brief erfolgen und wird unmittelbar wirksam. Eine zum Zeitpunkt der Kündigung bereits laufende Kaufchance bleibt davon unberührt; ein bereits zustande gekommener Kaufvertrag (vgl. § 5 Abs. 4) ist auch nach Kündigung verbindlich.</li>' || E'\n' ||
    '<li style="margin-bottom:12px;font-size:16px;line-height:1.7;"><strong>Bestandsinserate (Übergangsregelung):</strong> Inserate, die vor dem <strong>19.04.2026</strong> eingestellt wurden („Bestand"), laufen für eine Übergangsfrist von <strong>60 Tagen</strong> ab Inkrafttreten dieses § 6 unter der bisherigen Regelung weiter. Innerhalb dieser Frist erhalten betroffene Verkäufer eine Opt-in-E-Mail mit der Möglichkeit, das Inserat in die neue Marketingphase zu überführen oder ein anderes Vorgehen zu wählen. Nach Ablauf der 60 Tage wird das Inserat ohne weitere automatische Verlängerung beendet, sofern der Verkäufer nicht aktiv interveniert. Die Übergangsregelung dient ausschließlich dem Vertrauensschutz und ist nicht auf neue Inserate anwendbar.</li>' || E'\n' ||
    '<li style="margin-bottom:12px;font-size:16px;line-height:1.7;"><strong>Verbot des anderweitigen Verkaufs:</strong> Während einer laufenden Auktion oder Kaufchance-Phase ist es dem Verkäufer untersagt, das Fahrzeug anderweitig zu verkaufen oder anzubieten (vgl. § 4 Abs. 4). Bei Zuwiderhandlung wird die Vertragsstrafe gemäß § 8 fällig.</li>' || E'\n' ||
    '</ol>' || E'\n' || E'\n';

  v_new_content := v_before || v_new_section || v_after;

  UPDATE public.legal_pages
     SET content = v_new_content,
         version = version + 1,
         updated_at = now()
   WHERE slug = 'agb';

  RAISE NOTICE 'AGB §6 erfolgreich aktualisiert (Version % → %).',
    5, (SELECT version FROM public.legal_pages WHERE slug='agb');
END $$;


-- ─── 2) get_current_agb_version() refactor: SOT = legal_pages.version ──
-- Vorher: hardcoded '2026-04-20'. Bei jeder AGB-Änderung musste die RPC
-- separat angepasst werden. Jetzt: liest direkt aus legal_pages.version.
-- Format: 'v<version> (<updated_at-Datum>)' — eindeutig + traceable.
CREATE OR REPLACE FUNCTION public.get_current_agb_version()
RETURNS TEXT
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
STABLE
AS $$
  SELECT 'v' || version::text || ' (' || updated_at::date::text || ')'
    FROM public.legal_pages
   WHERE slug = 'agb'
   LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_current_agb_version() IS
'Liest die aktuelle AGB-Version aus legal_pages.version (Single Source of Truth). Format: "v<version> (<datum>)" – z.B. "v6 (2026-04-20)". Wird beim Erstellen einer Auktion in auctions.agb_version_at_start als juristischer Snapshot gespeichert.';

REVOKE ALL ON FUNCTION public.get_current_agb_version() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_current_agb_version() TO anon, authenticated, service_role;


-- ─── 3) Smoke-Test ────────────────────────────────────────────────────
DO $$
DECLARE
  v_version int;
  v_content text;
  v_rpc_result text;
BEGIN
  SELECT version, content INTO v_version, v_content
    FROM public.legal_pages WHERE slug='agb';

  IF v_version < 6 THEN
    RAISE EXCEPTION 'AGB version war nicht gebumpt (% < 6)', v_version;
  END IF;

  -- §6 enthält jetzt die neuen Phase-4-Begriffe (ILIKE: case-insensitive)
  IF v_content NOT ILIKE '%Marketingphase%'
     OR v_content NOT ILIKE '%automatische Preisanpassung%'
     OR v_content NOT ILIKE '%24 Stunden%'
     OR v_content NOT ILIKE '%Maximal 4 Auktionsrunden%'
     OR v_content NOT ILIKE '%höchstens 16 Tage%'
     OR v_content NOT ILIKE '%höchstens 30 Tage%' THEN
    RAISE EXCEPTION 'AGB §6 enthält nicht alle Phase-4-Pflichtbegriffe';
  END IF;

  -- Alte (jetzt falsche) Begriffe sind weg
  IF v_content LIKE '%Kaufchance-Phase dauert <strong>72 Stunden%' THEN
    RAISE EXCEPTION 'AGB enthält noch alte 72h-Kaufchance-Klausel';
  END IF;
  IF v_content LIKE '%Auktionsrunde dauert jeweils 7 Tage%' THEN
    RAISE EXCEPTION 'AGB enthält noch alte 7-Tage-Runden-Klausel';
  END IF;

  -- RPC liefert jetzt v6-Format
  SELECT public.get_current_agb_version() INTO v_rpc_result;
  IF v_rpc_result NOT LIKE 'v6 (%' THEN
    RAISE EXCEPTION 'get_current_agb_version() liefert falsches Format: %', v_rpc_result;
  END IF;

  RAISE NOTICE 'OK: AGB §6 ist jetzt Version %, RPC liefert "%"', v_version, v_rpc_result;
END $$;
