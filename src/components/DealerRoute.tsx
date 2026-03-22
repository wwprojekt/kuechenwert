import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Loader2 } from "lucide-react";

interface DealerRouteProps {
  children: React.ReactNode;
}

/**
 * Route guard that only allows dealer (or admin) users.
 * Uses the shared useUserRole() hook for consistent cache behavior.
 */
export const DealerRoute = ({ children }: DealerRouteProps) => {
  const { user, loading: authLoading } = useAuth();
  const { isDealer, isAdmin, isLoading: roleLoading } = useUserRole();

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Allow both dealers and admins
  if (!isDealer && !isAdmin) {
    return <Navigate to="/haendler" replace />;
  }

  return <>{children}</>;
};
