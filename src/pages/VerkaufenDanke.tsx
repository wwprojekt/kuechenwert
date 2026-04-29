import { Navigate } from "react-router-dom";

/**
 * /verkaufen/danke (DEPRECATED → /funnel/danke)
 *
 * Gehoerte zum alten Caravan-Wizard ("Fahrzeug eingereicht — wir melden uns").
 * Im KuechenWert-Modell gibt es keinen "Verkauf" — der Wizard ist ersetzt
 * durch Funnel A/B. Die generische Danke-Seite lebt unter /funnel/danke und
 * zeigt dort funnel-spezifische Copy via ?funnel=a/b/c.
 */
const VerkaufenDanke = () => <Navigate to="/funnel/danke" replace />;

export default VerkaufenDanke;
