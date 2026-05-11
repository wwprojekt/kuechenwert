-- Bug #2 (Production): Die Function public.handle_new_user() existierte,
-- aber der Trigger auf auth.users wurde irgendwo verloren. Bei JEDEM
-- Signup wurde KEIN Profile erstellt. Folge: Funnel A/B Lead-Insert mit
-- user_id verletzt FK leads_user_id_fkey -> profiles.id, und der frisch
-- registrierte Customer kann gar nichts im Dashboard sehen.
--
-- Die Function selbst (handle_new_user) ist unveraendert -- nur der
-- Trigger fehlte. Wir stellen ihn idempotent wieder her.

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

COMMENT ON TRIGGER on_auth_user_created ON auth.users IS
  'Erstellt automatisch ein public.profiles + public.user_roles fuer jeden neuen auth.users-Eintrag. Wenn raw_user_meta_data.user_type = ''dealer'' gesetzt ist, wird zusaetzlich ein dealer_applications-Eintrag mit status=pending angelegt.';
