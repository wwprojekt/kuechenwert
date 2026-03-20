import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface DealerRouteProps {
  children: React.ReactNode;
}

export const DealerRoute = ({ children }: DealerRouteProps) => {
  const { user, loading: authLoading } = useAuth();

  const { data: isDealer, isLoading: roleLoading } = useQuery({
    queryKey: ["dealerRole", user?.id],
    queryFn: async () => {
      if (!user) return false;
      
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "dealer")
        .maybeSingle();

      if (error) throw error;
      return !!data;
    },
    enabled: !!user,
  });

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

  if (!isDealer) {
    return <Navigate to="/dealer-register" replace />;
  }

  return <>{children}</>;
};
