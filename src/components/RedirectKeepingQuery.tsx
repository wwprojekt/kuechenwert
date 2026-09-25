import { Navigate, useLocation } from "react-router-dom";

/** Weiterleitung, die Query (utm_*, gclid …) und Hash der alten URL behält. */
export function RedirectKeepingQuery({ to }: { to: string }) {
  const { search, hash } = useLocation();
  return <Navigate to={{ pathname: to, search, hash }} replace />;
}
