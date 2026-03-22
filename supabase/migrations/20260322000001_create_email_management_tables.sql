-- ============================================================
-- E-Mail Management System – Datenbank-Migration
-- Erstellt: 2026-03-22
-- ============================================================

-- 1. admin_emails – Alle vom Admin gesendeten und empfangenen E-Mails
CREATE TABLE IF NOT EXISTS admin_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Absender/Empfänger
  sender_email text NOT NULL DEFAULT 'info@caravanwert.de',
  sender_name text NOT NULL DEFAULT 'CaravanWert',
  recipient_email text NOT NULL,
  recipient_name text,
  recipient_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- CC/BCC
  cc text[] DEFAULT '{}',
  bcc text[] DEFAULT '{}',
  
  -- Inhalt
  subject text NOT NULL,
  body_html text NOT NULL DEFAULT '',
  body_text text NOT NULL DEFAULT '',
  
  -- Typ und Klassifizierung
  email_type text NOT NULL DEFAULT 'single' 
    CHECK (email_type IN ('single', 'broadcast', 'reply', 'inbound', 'auto')),
  direction text NOT NULL DEFAULT 'outbound'
    CHECK (direction IN ('inbound', 'outbound')),
  
  -- Rundmail-Felder
  broadcast_group text
    CHECK (broadcast_group IN ('all', 'customers', 'dealers', 'verified_dealers', 'newsletter', 'active_bidders', 'custom', NULL)),
  broadcast_id uuid,
  
  -- Status
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed', 'read', 'unread')),
  
  -- Resend Integration
  resend_id text,
  
  -- Verknüpfung zu bestehenden Nachrichten
  related_message_id uuid,
  related_message_type text
    CHECK (related_message_type IN ('support', 'contact', NULL)),
  
  -- Thread/Konversation
  thread_id uuid,
  in_reply_to uuid REFERENCES admin_emails(id) ON DELETE SET NULL,
  
  -- Inbound-spezifische Felder
  raw_headers jsonb,
  attachments jsonb DEFAULT '[]',
  
  -- Admin der die E-Mail gesendet hat
  sent_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- Gelesen-Status
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  read_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- Markierungen
  is_starred boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  
  -- Zeitstempel
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indizes für admin_emails
CREATE INDEX idx_admin_emails_direction ON admin_emails(direction);
CREATE INDEX idx_admin_emails_email_type ON admin_emails(email_type);
CREATE INDEX idx_admin_emails_status ON admin_emails(status);
CREATE INDEX idx_admin_emails_recipient_email ON admin_emails(recipient_email);
CREATE INDEX idx_admin_emails_sender_email ON admin_emails(sender_email);
CREATE INDEX idx_admin_emails_thread_id ON admin_emails(thread_id);
CREATE INDEX idx_admin_emails_broadcast_id ON admin_emails(broadcast_id);
CREATE INDEX idx_admin_emails_created_at ON admin_emails(created_at DESC);
CREATE INDEX idx_admin_emails_is_read ON admin_emails(is_read) WHERE direction = 'inbound';
CREATE INDEX idx_admin_emails_is_archived ON admin_emails(is_archived);

-- Updated_at Trigger
CREATE OR REPLACE FUNCTION update_admin_emails_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_admin_emails_updated_at
  BEFORE UPDATE ON admin_emails
  FOR EACH ROW
  EXECUTE FUNCTION update_admin_emails_updated_at();

-- 2. email_templates – Gespeicherte Vorlagen
CREATE TABLE IF NOT EXISTS email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subject text NOT NULL,
  body_html text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'general'
    CHECK (category IN ('general', 'dealer', 'customer', 'system', 'marketing')),
  description text,
  variables jsonb DEFAULT '[]',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Updated_at Trigger für email_templates
CREATE TRIGGER trigger_email_templates_updated_at
  BEFORE UPDATE ON email_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_admin_emails_updated_at();

-- Indizes für email_templates
CREATE INDEX idx_email_templates_category ON email_templates(category);
CREATE INDEX idx_email_templates_is_active ON email_templates(is_active);

-- 3. RLS Policies

-- admin_emails: Nur Admins dürfen lesen und schreiben
ALTER TABLE admin_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all admin emails"
  ON admin_emails FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert admin emails"
  ON admin_emails FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update admin emails"
  ON admin_emails FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role = 'admin'
    )
  );

CREATE POLICY "Service role can manage admin emails"
  ON admin_emails FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- email_templates: Nur Admins dürfen lesen und schreiben
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all email templates"
  ON email_templates FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert email templates"
  ON email_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update email templates"
  ON email_templates FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete email templates"
  ON email_templates FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role = 'admin'
    )
  );

CREATE POLICY "Service role can manage email templates"
  ON email_templates FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 4. Standard-Vorlagen einfügen
INSERT INTO email_templates (name, subject, body_html, category, description, variables) VALUES
(
  'Willkommen als Händler',
  'Willkommen bei CaravanWert – Ihr Händlerkonto ist bereit',
  '<p>Sehr geehrte/r {{anrede}} {{nachname}},</p><p>herzlich willkommen bei CaravanWert! Ihr Händlerkonto wurde erfolgreich eingerichtet und Sie können ab sofort auf unsere Auktionsplattform zugreifen.</p><p>Ihre Vorteile als registrierter Händler:</p><ul><li>Zugang zu exklusiven Wohnmobil-Auktionen</li><li>Sofortkauf-Option für ausgewählte Fahrzeuge</li><li>Persönlicher Ansprechpartner</li></ul><p>Bei Fragen stehen wir Ihnen jederzeit zur Verfügung.</p>',
  'dealer',
  'Willkommens-E-Mail für neu registrierte Händler',
  '[{"key": "anrede", "label": "Anrede"}, {"key": "nachname", "label": "Nachname"}, {"key": "firma", "label": "Firmenname"}]'
),
(
  'Händler-Verifizierung bestätigt',
  'Ihr Händlerkonto wurde verifiziert – CaravanWert',
  '<p>Sehr geehrte/r {{anrede}} {{nachname}},</p><p>wir freuen uns Ihnen mitteilen zu können, dass Ihr Händlerkonto bei CaravanWert erfolgreich verifiziert wurde.</p><p>Sie haben nun Zugang zu allen Funktionen unserer Plattform, einschließlich der Teilnahme an Auktionen und der Sofortkauf-Option.</p><p>Wir wünschen Ihnen viel Erfolg!</p>',
  'dealer',
  'Bestätigung nach erfolgreicher Händler-Verifizierung',
  '[{"key": "anrede", "label": "Anrede"}, {"key": "nachname", "label": "Nachname"}]'
),
(
  'Allgemeine Ankündigung',
  '{{betreff}}',
  '<p>Sehr geehrte Damen und Herren,</p><p>{{nachricht}}</p><p>Bei Fragen stehen wir Ihnen gerne zur Verfügung.</p>',
  'general',
  'Allgemeine Ankündigung oder Neuigkeit',
  '[{"key": "betreff", "label": "Betreff"}, {"key": "nachricht", "label": "Nachricht"}]'
),
(
  'Wartungshinweis',
  'Geplante Wartungsarbeiten – CaravanWert',
  '<p>Sehr geehrte Damen und Herren,</p><p>wir möchten Sie darüber informieren, dass am <strong>{{datum}}</strong> von <strong>{{uhrzeit_von}}</strong> bis <strong>{{uhrzeit_bis}}</strong> geplante Wartungsarbeiten an unserer Plattform durchgeführt werden.</p><p>Während dieser Zeit kann es zu kurzzeitigen Einschränkungen kommen. Laufende Auktionen werden nicht beeinträchtigt.</p><p>Wir bitten um Ihr Verständnis.</p>',
  'system',
  'Information über geplante Wartungsarbeiten',
  '[{"key": "datum", "label": "Datum"}, {"key": "uhrzeit_von", "label": "Von"}, {"key": "uhrzeit_bis", "label": "Bis"}]'
),
(
  'Zahlungserinnerung',
  'Erinnerung: Offene Zahlung – CaravanWert',
  '<p>Sehr geehrte/r {{anrede}} {{nachname}},</p><p>wir möchten Sie freundlich daran erinnern, dass für die Auktion <strong>{{auktion}}</strong> noch eine offene Zahlung in Höhe von <strong>{{betrag}}</strong> besteht.</p><p>Bitte überweisen Sie den Betrag bis zum <strong>{{frist}}</strong> auf das in der Rechnung angegebene Konto.</p><p>Falls Sie die Zahlung bereits veranlasst haben, betrachten Sie diese Nachricht bitte als gegenstandslos.</p>',
  'customer',
  'Freundliche Zahlungserinnerung',
  '[{"key": "anrede", "label": "Anrede"}, {"key": "nachname", "label": "Nachname"}, {"key": "auktion", "label": "Auktionsbezeichnung"}, {"key": "betrag", "label": "Betrag"}, {"key": "frist", "label": "Zahlungsfrist"}]'
),
(
  'Sonderaktion / Promotion',
  '{{betreff}} – CaravanWert',
  '<p>Sehr geehrte Damen und Herren,</p><p>{{nachricht}}</p><p>Nutzen Sie diese Gelegenheit und besuchen Sie unsere Plattform.</p>',
  'marketing',
  'Sonderaktion oder Promotion-E-Mail',
  '[{"key": "betreff", "label": "Betreff"}, {"key": "nachricht", "label": "Nachricht"}]'
);
