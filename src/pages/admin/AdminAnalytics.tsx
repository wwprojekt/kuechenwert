import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FunnelTab } from "@/components/admin/analytics/FunnelTab";
import { PlatformTab } from "@/components/admin/analytics/PlatformTab";
import { VisitorTab } from "@/components/admin/analytics/VisitorTab";
import { usePlatformStats } from "@/components/admin/analytics/usePlatformStats";
import { useVisitorStats } from "@/components/admin/analytics/useVisitorStats";

export default function AdminAnalytics() {
  const platform = usePlatformStats();
  const visitors = useVisitorStats();

  if (platform.isLoading || visitors.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="mb-2 text-xl font-bold sm:text-2xl md:text-3xl">Analytics</h1>
        <p className="text-muted-foreground">Anfragen, Studio-Angebote, Besucher und Funnel-Abbrüche</p>
      </div>

      <Tabs defaultValue="platform" className="space-y-6">
        <TabsList className="grid w-full max-w-lg grid-cols-3">
          <TabsTrigger value="platform">Marktplatz</TabsTrigger>
          <TabsTrigger value="visitors">Besucher</TabsTrigger>
          <TabsTrigger value="funnels">Funnels</TabsTrigger>
        </TabsList>
        <TabsContent value="platform">
          <PlatformTab stats={platform.data} />
        </TabsContent>
        <TabsContent value="visitors">
          <VisitorTab stats={visitors.data} />
        </TabsContent>
        <TabsContent value="funnels">
          <FunnelTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
