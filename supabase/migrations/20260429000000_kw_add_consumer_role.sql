-- ============================================================================
-- KuechenWert Phase 2.1 (Vorstufe): app_role um 'consumer' erweitern.
--
-- Caravanwert kennt: admin, dealer, seller.
-- KuechenWert braucht zusaetzlich 'consumer' fuer Funnel-Nutzer (Privatpersonen
-- die eine Kueche kaufen wollen). 'seller' passt semantisch nicht, weil der
-- Endkunde im KW-Kontext KAEUFER ist, nicht Verkaeufer.
--
-- Muss in einer separaten Migration laufen, weil `alter type ... add value`
-- nicht in derselben Transaktion wie die Verwendung des neuen Werts
-- stehen darf. Die Hauptmigration 20260429000100 nutzt 'consumer' nicht
-- direkt (alle RLS-Policies spielen mit admin/dealer), daher theoretisch
-- auch zusammen moeglich - aber sauberer so.
-- ============================================================================

alter type public.app_role add value if not exists 'consumer';
