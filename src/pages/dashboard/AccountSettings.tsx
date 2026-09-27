import { Settings } from "lucide-react";
import { EmailPreferencesCard } from "@/features/account/EmailPreferencesCard";
import type { EmailAudience } from "@/features/account/email-preferences";
import { DealerNotificationOverview } from "@/features/marketplace/components/DealerNotificationOverview";

export default function AccountSettings({ audience }: { audience: EmailAudience }) {
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="mb-2 flex items-center gap-3 text-xl font-bold sm:text-2xl md:text-3xl">
          <Settings className="h-8 w-8 text-primary" />
          Einstellungen
        </h1>
        <p className="text-muted-foreground">Legen Sie fest, worüber wir Sie per E-Mail informieren.</p>
      </div>

      {audience === "dealer" && <DealerNotificationOverview />}
      <EmailPreferencesCard audience={audience} />
    </div>
  );
}
