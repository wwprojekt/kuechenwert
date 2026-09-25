import { RedirectKeepingQuery } from "@/components/RedirectKeepingQuery";

/**
 * /verkaufen (DEPRECATED → Funnel A)
 *
 * Die Route stammt aus CaravanWert-Zeiten. In KuechenWert geht es nicht um
 * das "Verkaufen" einer gebrauchten Kueche, sondern um das PLANEN einer NEUEN
 * Kueche (Angebote von Studios einholen).
 *
 * Diese Komponente leitet deshalb auf den Einstieg von Funnel A (/formular)
 * um. Die Datei bleibt im Repo, damit alte Backlinks (/verkaufen) nicht 404en.
 */
const Verkaufen = () => <RedirectKeepingQuery to="/formular" />;

export default Verkaufen;
