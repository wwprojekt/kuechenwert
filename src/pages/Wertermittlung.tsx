import { Navigate } from "react-router-dom";

/**
 * Wertermittlung (DEPRECATED → KuechenRechner)
 *
 * Altes CaravanWert-Konzept "Experten-Wertermittlung" fuer gebrauchte
 * Fahrzeuge. Im Kuechen-Kontext nicht mehr passend — siehe Kommentar in
 * Wertrechner.tsx.
 *
 * Leitet auf den neuen /kuechenrechner weiter. Wer eine echte Experten-
 * Schaetzung fuer eine neue Kueche haben moechte, geht ueber den
 * KuechenRechner → Funnel A (Angebote einholen) — da ist der Experten-Check
 * im Prozess enthalten.
 */
const Wertermittlung = () => <Navigate to="/kuechenrechner" replace />;

export default Wertermittlung;
