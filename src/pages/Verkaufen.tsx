import { Navigate } from "react-router-dom";

/**
 * /verkaufen (DEPRECATED → Funnel A)
 *
 * Die Route stammt aus CaravanWert-Zeiten. In KuechenWert geht es nicht um
 * das "Verkaufen" einer gebrauchten Kueche, sondern um das PLANEN einer NEUEN
 * Kueche (Angebote von Studios einholen).
 *
 * Diese Komponente leitet deshalb auf den primaeren Funnel A um. Die Datei
 * bleibt im Repo, damit alte Backlinks (/verkaufen) nicht 404en.
 */
const Verkaufen = () => <Navigate to="/funnel/a" replace />;

export default Verkaufen;
