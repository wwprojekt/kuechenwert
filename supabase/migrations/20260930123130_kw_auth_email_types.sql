-- Mail-Typen des Send-Email-Hooks kw-auth-email: Supabase-Auth-Mails
-- (Registrierung, Einladung, Anmeldelink, Passwort, E-Mail-Änderung, Code,
-- Sicherheitshinweise) laufen über das KüchenWert-Layout und werden ohne
-- Token in admin_emails protokolliert. Ohne diese Werte scheitert die
-- Protokollzeile (der Versand selbst läuft trotzdem).

alter table public.admin_emails drop constraint admin_emails_email_type_check;

alter table public.admin_emails add constraint admin_emails_email_type_check check (email_type = any (array[
  'single', 'reply', 'broadcast', 'inbound', 'auto', 'auto_response', 'welcome', 'scheduled',
  'registration_invite', 'dealer_registration_invite', 'email_confirmation_resend',
  'account_suspended', 'account_unsuspended', 'account_deleted', 'inactivity',
  'dealer_application_received', 'dealer_application_admin', 'dealer_approved', 'dealer_rejected',
  'dealer_role_upgrade', 'dealer_documents_request', 'dealer_application_deleted', 'dealer_welcome',
  'dealer_suspended', 'dealer_reactivated', 'dealer_outreach', 'dealer_first_nudge',
  'invoice', 'invoice_cancellation', 'invoice_issue_blocked', 'payment_confirmation', 'payment_reminder',
  'dunning_level_1', 'dunning_level_2', 'dunning_level_3', 'dunning_level_4', 'dunning_level_5',
  'project_link', 'project_admin_new', 'project_new_dealer', 'project_new_offer', 'project_contact_unlocked',
  'project_tender_ended', 'project_awarded_consumer', 'project_awarded_dealer', 'project_not_awarded_dealer',
  'project_updated_dealer', 'complaint_admin', 'complaint_decided', 'lead_files_admin',
  'order_update_consumer', 'order_update_dealer', 'order_admin', 'order_reminder',
  'contact_admin', 'contact_confirmation', 'ops_health_alert', 'gads_search_terms_report',
  'auth_signup', 'auth_invite', 'auth_magiclink', 'auth_email', 'auth_recovery',
  'auth_email_change', 'auth_reauthentication', 'auth_notification'
]::text[]));
