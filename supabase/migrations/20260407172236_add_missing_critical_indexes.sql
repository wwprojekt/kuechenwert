
-- Performance: Fehlende Indizes auf häufig genutzte FK- und WHERE-Spalten.
-- Nur die kritischsten Tabellen (die mit echten Daten und häufigen Queries).

-- profiles.email: Wird in vielen Lookups verwendet (AdminLeads, EmailCenter, etc.)
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- dealer_applications.status: Wird bei jeder Bid/Instant-Buy Prüfung gelesen
CREATE INDEX IF NOT EXISTS idx_dealer_applications_status ON public.dealer_applications(status);

-- dealer_notifications.auction_id: Wird bei Notification-Lookups benötigt
CREATE INDEX IF NOT EXISTS idx_dealer_notifications_auction_id ON public.dealer_notifications(auction_id);

-- bids.created_at: Wird bei Gebotsverlauf-Sortierung benötigt
CREATE INDEX IF NOT EXISTS idx_bids_created_at ON public.bids(created_at DESC);

-- auctions.created_at: Wird bei Admin-Auktionsliste benötigt
CREATE INDEX IF NOT EXISTS idx_auctions_created_at ON public.auctions(created_at DESC);

-- motorhomes.created_at: Wird bei Seller-Dashboard/Admin-Motorhomes benötigt
CREATE INDEX IF NOT EXISTS idx_motorhomes_created_at ON public.motorhomes(created_at DESC);

-- wizard_sessions.created_at: Wird bei AdminLeads-Sortierung benötigt
CREATE INDEX IF NOT EXISTS idx_wizard_sessions_created_at ON public.wizard_sessions(created_at DESC);

-- value_assessment_leads.email: Für Duplikat-Checks
CREATE INDEX IF NOT EXISTS idx_value_assessment_leads_email ON public.value_assessment_leads(email);

-- appointments.status + seller_id: Häufig gefiltert
CREATE INDEX IF NOT EXISTS idx_appointments_status ON public.appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_seller_id ON public.appointments(seller_id);

-- contact_messages.status: Für Admin-Dashboard Badge-Counter
CREATE INDEX IF NOT EXISTS idx_contact_messages_status ON public.contact_messages(status);

-- quick_leads.status: Für AdminLeads Filterung  
CREATE INDEX IF NOT EXISTS idx_quick_leads_status ON public.quick_leads(status);

-- analytics_sessions.created_at: Für Analytics-Queries
CREATE INDEX IF NOT EXISTS idx_analytics_sessions_created_at ON public.analytics_sessions(created_at DESC);
