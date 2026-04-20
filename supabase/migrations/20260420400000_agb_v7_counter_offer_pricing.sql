-- ============================================================================
-- AGB v7: Marktsignal-basierte Preisanpassung (Counter-Offer-Klausel)
-- ============================================================================
--
-- Hintergrund:
--   Seit Commit 8c3a905 wendet das System in der Kaufchance-Auto-Relist-Phase
--   eine erweiterte Preis-Reduktions-Logik an: Wenn der Verkäufer in der
--   vorangegangenen Kaufchance ein eigenes Gegenangebot abgegeben hat, wird
--   der neue Mindestpreis auf 98 % des niedrigsten eigenen Gegenangebots
--   herabgesetzt (statt der klassischen -2 % vom letzten Reserve).
--
--   Diese Logik kann in einer einzelnen Runde mehr als 2 % Reduktion bewirken
--   und steht damit im Spannungsverhältnis zur AGB v6 §6.4, die wörtlich
--   "maximal 2 % vom zuletzt gültigen Preis" zusicherte.
--
-- Maßnahme:
--   1. AGB §6.4 wird in v7 explizit um Buchstabe b) "Marktsignal-basierte
--      Anpassung" erweitert. Der Reduktionsboden (-6 % Auktion / -10 %
--      Festpreis) bleibt unverändert.
--   2. legal_pages.version wird auf 7 gehoben → get_current_agb_version()
--      liefert ab sofort "v7 (2026-04-20)".
--   3. Geschäftsentscheidung: AGB v7 gilt rückwirkend für ALLE 98 aktiven
--      und Kaufchance-Auktionen. Die agb_version_at_start-Spalte wird
--      entsprechend backfilled. Die Original-Versionen werden für juristische
--      Nachverfolgung in audit_logs.details festgehalten.
--
-- Risiko:
--   §305b BGB Vorrang Individualabrede — Verkäufer von Bestands-Inseraten
--   könnten sich auf den Vertrauensschutz der ursprünglich akzeptierten
--   v6-Klausel berufen. Dieses Risiko wurde bewusst in Kauf genommen, weil
--   die neue Klausel den Verkäufer wirtschaftlich besser stellt
--   (schnellere Marktwert-Findung) und sich aus seiner eigenen
--   Preis-Erklärung ableitet (Gegenangebot).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Update §6.4 in legal_pages.content
-- ----------------------------------------------------------------------------

UPDATE public.legal_pages
SET
  content = REPLACE(
    content,
    -- OLD §6.4 (v6, exact bytes from current production)
    $OLD64$<li style="margin-bottom:12px;font-size:16px;line-height:1.7;"><strong>Automatische Preisanpassung (optional, voreingestellt:</strong> bei Auktion aktiv, bei Festpreis deaktiviert<strong>):</strong> Ist die automatische Preisanpassung aktiviert, sinkt der Mindestpreis (bei Auktion) bzw. der Festpreis mit jeder neuen Runde um <strong>maximal 2 %</strong> vom zuletzt gültigen Preis. Die Gesamtreduktion ist nach unten gedeckelt:
<ul style="list-style-type:disc;padding-left:24px;margin-top:8px;">
<li style="margin-bottom:8px;font-size:16px;line-height:1.7;"><strong>Auktion:</strong> maximal <strong>6 %</strong> unter dem vom Verkäufer eingegebenen Wunsch-Mindestpreis (Reduktionsboden).</li>
<li style="margin-bottom:8px;font-size:16px;line-height:1.7;"><strong>Festpreis:</strong> maximal <strong>10 %</strong> unter dem vom Verkäufer eingegebenen Wunsch-Festpreis (Reduktionsboden).</li>
</ul>
Unter den Reduktionsboden wird das Fahrzeug niemals automatisch verkauft. Der Verkäufer kann die automatische Preisanpassung jederzeit über sein Dashboard ein- oder ausschalten („Automatische Preisanpassung"-Toggle). Bei manueller Änderung des Mindest- bzw. Festpreises durch den Verkäufer wird die automatische Preisanpassung systembedingt deaktiviert; der Verkäufer kann sie anschließend bewusst wieder aktivieren.</li>$OLD64$,
    -- NEW §6.4 (v7) — adds Buchstabe b) Marktsignal-basierte Anpassung
    $NEW64$<li style="margin-bottom:12px;font-size:16px;line-height:1.7;"><strong>Automatische Preisanpassung (optional, voreingestellt:</strong> bei Auktion aktiv, bei Festpreis deaktiviert<strong>):</strong> Ist die automatische Preisanpassung aktiviert, wird der Mindestpreis (bei Auktion) bzw. der Festpreis vor jeder neuen Runde nach folgenden Regeln angepasst:
<ul style="list-style-type:disc;padding-left:24px;margin-top:8px;">
<li style="margin-bottom:8px;font-size:16px;line-height:1.7;"><strong>a) Standardfall:</strong> Der Mindest- bzw. Festpreis sinkt um <strong>maximal 2 %</strong> vom zuletzt gültigen Preis.</li>
<li style="margin-bottom:8px;font-size:16px;line-height:1.7;"><strong>b) Marktsignal-basierte Anpassung (nur Auktion, nur in der Kaufchance-Phase):</strong> Hat der Verkäufer in der vorangegangenen Kaufchance-Phase ein eigenes Gegenangebot abgegeben, das niedriger als der aktuelle Mindestpreis ist, kann der neue Mindestpreis stattdessen auf <strong>98 % des niedrigsten eigenen Gegenangebots</strong> des Verkäufers in dieser Runde herabgesetzt werden. Da diese Anpassung unmittelbar aus einer eigenen Preis-Erklärung des Verkäufers (Gegenangebot) abgeleitet wird, darf sie in einer einzelnen Runde mehr als 2 % betragen. Sie greift nur, wenn der so berechnete Wert unter dem zuletzt gültigen Mindestpreis liegt; andernfalls gilt die Standard-Reduktion gemäß Buchstabe a).</li>
<li style="margin-bottom:8px;font-size:16px;line-height:1.7;"><strong>c) Reduktionsboden (gilt für a und b):</strong>
<ul style="list-style-type:circle;padding-left:24px;margin-top:8px;">
<li style="margin-bottom:8px;font-size:16px;line-height:1.7;"><strong>Auktion:</strong> maximal <strong>6 %</strong> unter dem vom Verkäufer eingegebenen Wunsch-Mindestpreis.</li>
<li style="margin-bottom:8px;font-size:16px;line-height:1.7;"><strong>Festpreis:</strong> maximal <strong>10 %</strong> unter dem vom Verkäufer eingegebenen Wunsch-Festpreis.</li>
</ul>
Unter den Reduktionsboden wird das Fahrzeug niemals automatisch verkauft.</li>
</ul>
Der Verkäufer kann die automatische Preisanpassung jederzeit über sein Dashboard ein- oder ausschalten („Automatische Preisanpassung"-Toggle). Bei manueller Änderung des Mindest- bzw. Festpreises durch den Verkäufer wird die automatische Preisanpassung systembedingt deaktiviert; der Verkäufer kann sie anschließend bewusst wieder aktivieren.</li>$NEW64$
  ),
  version = 7,
  updated_at = NOW(),
  published_at = NOW()
WHERE slug = 'agb';

-- Hard fail if the REPLACE didn't change anything (= old marker not found)
DO $verify_replace$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
    FROM public.legal_pages
   WHERE slug = 'agb'
     AND content LIKE '%Marktsignal-basierte Anpassung%';

  IF v_count != 1 THEN
    RAISE EXCEPTION 'AGB v7 §6.4 replacement failed: marker "Marktsignal-basierte Anpassung" not found after UPDATE (got % rows)', v_count;
  END IF;
END;
$verify_replace$;

-- ----------------------------------------------------------------------------
-- 2. Snapshot original AGB versions BEFORE backfill (for audit trail)
-- ----------------------------------------------------------------------------

DO $audit$
DECLARE
  v_new_version TEXT;
  v_original_versions JSONB;
  v_affected_count INTEGER;
BEGIN
  -- Capture the new version string (will be 'v7 (YYYY-MM-DD)')
  v_new_version := public.get_current_agb_version();

  -- Snapshot the original (pre-backfill) version distribution for audit
  SELECT
    COUNT(*),
    jsonb_object_agg(
      COALESCE(agb_version_at_start, '<NULL>'),
      cnt
    )
  INTO v_affected_count, v_original_versions
  FROM (
    SELECT agb_version_at_start, COUNT(*) AS cnt
      FROM public.auctions
     WHERE status IN ('active','kaufchance')
     GROUP BY agb_version_at_start
  ) t;

  -- Single summary audit log entry (system-level, no user_id)
  INSERT INTO public.audit_logs (action, entity_type, entity_id, details)
  VALUES (
    'agb_v7_retroactive_apply',
    'legal_pages',
    'agb',
    jsonb_build_object(
      'new_version', v_new_version,
      'previous_published_version', 'v6 (2026-04-20)',
      'affected_auction_count', v_affected_count,
      'original_version_distribution', v_original_versions,
      'business_decision_rationale', 'AGB §6.4 b) Marktsignal-basierte Anpassung wird rückwirkend auf alle aktiven und Kaufchance-Auktionen angewendet, da sie den Verkäufer wirtschaftlich besser stellt (schnellere Marktwert-Findung) und sich aus seiner eigenen Preis-Erklärung (Gegenangebot) ableitet.',
      'legal_risk_acknowledged', '§305b BGB Vorrang Individualabrede — Verkäufer von Bestands-Inseraten könnten sich auf den Vertrauensschutz der ursprünglich akzeptierten v6-Klausel berufen.',
      'helper_function', 'computeKaufchanceRelistReserve in supabase/functions/_shared/marketing-config.ts',
      'helper_deployed_in_commit', '8c3a905',
      'agb_v7_published_at', NOW()
    )
  );

  RAISE NOTICE 'AGB v7 audit log written: new_version=%, affected=%', v_new_version, v_affected_count;
END;
$audit$;

-- ----------------------------------------------------------------------------
-- 3. Backfill agb_version_at_start for active + kaufchance auctions
-- ----------------------------------------------------------------------------
--
-- Per business decision (see audit_logs above), AGB v7 applies retroactively
-- to all currently running marketing phases. The backfill aligns the snapshot
-- column with the operational reality (helper applies v7 logic regardless of
-- snapshot anyway, since check-expired-auctions / end-kaufchance do not gate
-- on agb_version_at_start).
--
-- Historical records (sold/cancelled/ended auctions) keep their original
-- snapshot for archival accuracy.
-- ----------------------------------------------------------------------------

UPDATE public.auctions
SET agb_version_at_start = public.get_current_agb_version()
WHERE status IN ('active','kaufchance');

-- ----------------------------------------------------------------------------
-- 4. Final verification
-- ----------------------------------------------------------------------------

DO $verify_final$
DECLARE
  v_current_version TEXT;
  v_v7_active_count INTEGER;
  v_non_v7_active_count INTEGER;
BEGIN
  v_current_version := public.get_current_agb_version();

  IF v_current_version NOT LIKE 'v7 %' THEN
    RAISE EXCEPTION 'get_current_agb_version() returned unexpected value: %', v_current_version;
  END IF;

  SELECT COUNT(*) INTO v_v7_active_count
    FROM public.auctions
   WHERE status IN ('active','kaufchance')
     AND agb_version_at_start = v_current_version;

  SELECT COUNT(*) INTO v_non_v7_active_count
    FROM public.auctions
   WHERE status IN ('active','kaufchance')
     AND (agb_version_at_start IS NULL OR agb_version_at_start != v_current_version);

  IF v_non_v7_active_count > 0 THEN
    RAISE EXCEPTION 'Backfill incomplete: % active/kaufchance auctions still on non-v7 version', v_non_v7_active_count;
  END IF;

  RAISE NOTICE 'AGB v7 migration complete: current_version=%, active_on_v7=%', v_current_version, v_v7_active_count;
END;
$verify_final$;

COMMIT;
