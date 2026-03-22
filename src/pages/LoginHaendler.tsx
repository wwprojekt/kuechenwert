import { Navigate, useSearchParams } from "react-router-dom";

/**
 * Legacy Händler-Login page — redirects to the unified /login page.
 * Kept as a redirect to avoid breaking existing bookmarks or links.
 */
const LoginHaendler = () => {
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect');
  const target = redirect ? `/login?redirect=${encodeURIComponent(redirect)}` : "/login";
  return <Navigate to={target} replace />;
};

export default LoginHaendler;
