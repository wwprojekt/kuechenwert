import { Navigate } from "react-router-dom";

/**
 * Wertrechner (DEPRECATED → KuechenRechner)
 *
 * Diese Route existierte aus CaravanWert-Zeiten ("Wertrechner" fuer gebrauchte
 * Fahrzeuge). Im Kuechen-Kontext ist "Wertrechner" irrefuehrend — es suggeriert,
 * man koenne eine GEBRAUCHTE Kueche "bewerten". Das ist nicht das
 * Geschaeftsmodell: KuechenWert vermittelt NEUE Kuechen bzw. unterbietet
 * existierende Studio-Angebote.
 *
 * Der neue Budget-Estimator lebt unter /kuechenrechner (Phase 3 Rebrand).
 *
 * Diese Komponente bleibt als 301-aequivalenter SPA-Redirect bestehen, damit
 * alte Backlinks + Google-Indexierung nicht kaputt gehen.
 */
const Wertrechner = () => <Navigate to="/kuechenrechner" replace />;

export default Wertrechner;
