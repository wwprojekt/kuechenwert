-- Phase 2: Server-side Bing Ads Conversion API (offline conversions)
--
-- Wir spiegeln serverseitig den Sale-Upload zu Microsoft Advertising
-- (`ApplyOfflineConversions` REST v13). Damit wird auch ohne Click-on-Sale-Day
-- der Verkauf der ursprünglichen Bing-Klick-Quelle zugerechnet — Voraussetzung
-- für sinnvolles Smart Bidding bei 500 €/Tag Spend.
--
-- Diese Tabelle dient ausschließlich der **Idempotenz**:
-- Bing dedupliziert serverseitig zwar via (msclkid, conversionTime), aber wir
-- könnten denselben (motorhome_id, conversion_name) durch z. B. einen Retry
-- des Edge-Function-Aufrufs versehentlich mehrfach hochladen — mit einer
-- jeweils minimal anderen `Date.now()` und damit anderem Tuple. Dadurch würde
-- Bing Smart-Bidding-Statistik verschmutzt. Die UNIQUE-Constraint hier
-- verhindert das deterministisch.
--
-- Strikt additiv: keine bestehende Tabelle berührt, keine RLS-Policy auf
-- bestehender Tabelle geändert. Reine Infrastruktur für Phase 2.

CREATE TABLE IF NOT EXISTS public.bing_offline_conversions_log (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Der Verkauf, den wir gemeldet haben.
  motorhome_id        UUID         NOT NULL REFERENCES public.motorhomes(id) ON DELETE CASCADE,
  auction_id          UUID         NULL,
  source              TEXT         NOT NULL CHECK (source IN (
    'close-auction',
    'instant-buy',
    'accept-kaufchance-offer',
    'admin-sell-to-dealer'
  )),

  -- Der Bing-Goal-Name (entspricht `OfflineConversionGoal.Name` im
  -- Microsoft-Advertising-UI). Heute geplant: 'Sale_Sold_Vehicle'. In Zukunft
  -- könnten weitere Goals dazukommen (z. B. 'Sale_Kaufchance'), darum ist der
  -- Wert pro Zeile gespeichert und Teil des UNIQUE-Schlüssels.
  conversion_name     TEXT         NOT NULL,

  -- Daten, die wir an Bing geschickt haben (zur Nachvollziehbarkeit).
  msclkid             TEXT         NULL,
  conversion_time     TIMESTAMPTZ  NOT NULL,
  conversion_value    NUMERIC(12,2) NOT NULL,
  conversion_currency TEXT         NOT NULL DEFAULT 'EUR',

  -- Ergebnis vom Bing-API-Call.
  status              TEXT         NOT NULL CHECK (status IN ('success','partial_failure','http_error','exception','skipped')),
  http_status         INTEGER      NULL,
  error_message       TEXT         NULL,

  uploaded_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),

  -- Wenn dieselbe Auktion zweimal closed wird, oder ein Admin „aus Versehen"
  -- einen Sofortverkauf wiederholt, wollen wir Bing nicht doppelt belasten.
  CONSTRAINT bing_offline_conversions_log_unique
    UNIQUE (motorhome_id, conversion_name)
);

-- Monitoring-Indexe (gezielte Lookups, NICHT für Hot-Path).
CREATE INDEX IF NOT EXISTS idx_bing_offline_conv_log_uploaded_at
  ON public.bing_offline_conversions_log (uploaded_at DESC);

CREATE INDEX IF NOT EXISTS idx_bing_offline_conv_log_status
  ON public.bing_offline_conversions_log (status, uploaded_at DESC);

-- RLS: nur service_role darf rein/raus. Frontend hat hier nichts zu suchen.
ALTER TABLE public.bing_offline_conversions_log ENABLE ROW LEVEL SECURITY;

-- Default-Verhalten ohne Policy = niemand darf was. Service-Role bypasst RLS
-- ohnehin. Wir fügen eine explizite "deny all" für authenticated/anon hinzu,
-- damit auch ein versehentliches GRANT die Tabelle nicht öffnet.
REVOKE ALL ON public.bing_offline_conversions_log FROM authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bing_offline_conversions_log TO service_role;

COMMENT ON TABLE public.bing_offline_conversions_log IS
  'Idempotency-log für serverseitige Bing-Ads-Offline-Conversion-Uploads (Phase 2). '
  'UNIQUE(motorhome_id, conversion_name) verhindert Doppel-Uploads bei Retries. '
  'Nur service_role darf lesen/schreiben.';

COMMENT ON COLUMN public.bing_offline_conversions_log.conversion_name IS
  'Name des OfflineConversionGoal in Microsoft Advertising (z. B. Sale_Sold_Vehicle). '
  'Muss exakt mit dem im MS-Ads-UI angelegten Goal übereinstimmen, sonst ignoriert Bing den Upload.';
