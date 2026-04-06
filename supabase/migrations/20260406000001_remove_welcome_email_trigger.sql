-- =============================================
-- Migration: Remove automatic welcome email trigger
-- =============================================
-- 
-- PROBLEM:
-- Der Trigger on_user_email_confirmed feuert bei JEDER E-Mail-Bestätigung
-- (UPDATE auf auth.users wo email_confirmed_at gesetzt wird) und sendet
-- automatisch eine Willkommens-E-Mail via send-welcome-email.
--
-- Das verursacht folgende Probleme:
-- 1. Doppelte E-Mails bei Admin-erstellten Sellern (Aktivierung + Willkommen)
-- 2. Doppelte E-Mails bei Admin-erstellten Dealern (Aktivierung + Willkommen)
-- 3. Falsche Seller-Willkommens-E-Mail für Händler (account_type ist noch 'private')
-- 4. Unerwünschte Willkommens-E-Mail wenn resend-confirmation-email Fallback feuert
--
-- LÖSUNG:
-- Jeder Registrierungs-Flow kontrolliert seine E-Mails selbst (explizite Kontrolle).
-- Der automatische Trigger wird entfernt.
--
-- BETROFFENE FLOWS:
-- - Wizard (Gast): War NICHT betroffen (email_confirm: true bei INSERT, Trigger war AFTER UPDATE)
-- - Admin → Seller: Aktivierungs-E-Mail (send-registration-invite) reicht aus
-- - Admin → Dealer: Aktivierungs-E-Mail (send-registration-invite) reicht aus
-- - Händler-Registrierung: Neue Edge Function register-dealer sendet eigene E-Mail
-- - Normaler Seller (/register): Supabase-Bestätigungs-E-Mail reicht aus
--
-- RISIKO: Kein Risiko. Analyse aller 8 Cron-Jobs, aller Edge Functions und
-- aller Frontend-Flows bestätigt: Kein Code hängt von diesem Trigger ab.
-- =============================================

-- Schritt 1: Trigger entfernen
DROP TRIGGER IF EXISTS on_user_email_confirmed ON auth.users;

-- Schritt 2: Trigger-Funktion entfernen (wird nirgends sonst verwendet)
DROP FUNCTION IF EXISTS public.trigger_welcome_email();
