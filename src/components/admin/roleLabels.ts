import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];

export type RoleInfo = {
  label: string;
  description: string;
  variant: "default" | "secondary" | "outline";
};

// Jedes Konto hat genau eine Rolle (eindeutiger Index auf user_roles.user_id).
export const ROLE_INFO: Record<AppRole, RoleInfo> = {
  admin: {
    label: "Admin",
    description: "Vollzugriff auf das Admin-Backend",
    variant: "default",
  },
  dealer: {
    label: "Küchenstudio",
    description: "Studio-Portal: Projekte im Einzugsgebiet sehen und Angebote abgeben",
    variant: "secondary",
  },
  seller: {
    label: "Kunde",
    description: "Standardrolle bei der Registrierung: Küchenprojekte anlegen und Angebote vergleichen",
    variant: "outline",
  },
  consumer: {
    label: "Kunde",
    description: "Alternative Kundenrolle mit denselben Rechten, wird bei der Registrierung nicht vergeben",
    variant: "outline",
  },
};

export const ROLE_ORDER: readonly AppRole[] = ["admin", "dealer", "seller", "consumer"];

export const CUSTOMER_ROLES: readonly AppRole[] = ["seller", "consumer"];

export function isAppRole(value: string): value is AppRole {
  return value in ROLE_INFO;
}

export function roleInfo(role: string): RoleInfo {
  return isAppRole(role) ? ROLE_INFO[role] : { label: role, description: "", variant: "outline" };
}
