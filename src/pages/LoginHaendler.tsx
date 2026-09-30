import { Navigate, useSearchParams } from "react-router-dom";

/**
 * Studio-Login unter /login/haendler: leitet auf das gemeinsame /login weiter
 * und behält das Ziel aus `redirect`.
 */
const LoginHaendler = () => {
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect');
  const target = redirect ? `/login?redirect=${encodeURIComponent(redirect)}` : "/login";
  return <Navigate to={target} replace />;
};

export default LoginHaendler;
