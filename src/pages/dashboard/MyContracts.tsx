import { useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useLiveData } from "@/hooks/useLiveData";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileCheck, Download, Car, Euro, Calendar, Loader2, FolderOpen, Hash, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { ensureValidRLSSession } from "@/lib/sessionGuard";
import { useToast } from "@/hooks/use-toast";

interface PurchaseContract {
  id: string;
  contract_number: string;
  sale_price: number;
  status: string;
  contract_url: string | null;
  buyer_contract_url: string | null;
  storage_path: string | null;
  buyer_storage_path: string | null;
  seller_name: string | null;
  vehicle_description: string | null;
  created_at: string | null;
  motorhome_id: string | null;
}

export default function MyContracts() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [contracts, setContracts] = useState<PurchaseContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const loadContracts = useCallback(async () => {
    if (!user) return;

    const sessionValid = await ensureValidRLSSession();
    if (!sessionValid) return;

    try {
      const { data, error } = await supabase
        .from("purchase_contracts")
        .select("id, contract_number, sale_price, status, contract_url, buyer_contract_url, storage_path, buyer_storage_path, seller_name, vehicle_description, created_at, motorhome_id")
        .eq("buyer_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setContracts((data as PurchaseContract[]) || []);
    } catch (error) {
      console.error("Error loading contracts:", error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useLiveData(loadContracts, { enabled: !!user, pollingInterval: 0 });

  const handleDownload = async (contract: PurchaseContract) => {
    setDownloadingId(contract.id);
    try {
      // Prefer buyer-specific paths/URLs (stored in buyer's storage folder)
      const storagePath = contract.buyer_storage_path || contract.storage_path;

      if (storagePath) {
        const { data, error } = await supabase.storage
          .from("purchase-contracts")
          .createSignedUrl(storagePath, 3600);

        if (!error && data?.signedUrl) {
          window.open(data.signedUrl, "_blank");
          return;
        }
      }

      // Fallback: try buyer_contract_url (pre-signed, may be expired)
      if (contract.buyer_contract_url) {
        window.open(contract.buyer_contract_url, "_blank");
        return;
      }

      // Last fallback: seller-side contract_url
      if (contract.contract_url) {
        window.open(contract.contract_url, "_blank");
        return;
      }

      toast({
        title: "Dokument nicht verfügbar",
        description: "Der Kaufvertrag ist derzeit nicht zum Download verfügbar. Bitte kontaktieren Sie den Support.",
        variant: "destructive",
      });
    } catch (error) {
      console.error("Error downloading contract:", error);
      toast({
        title: "Fehler beim Download",
        description: "Der Kaufvertrag konnte nicht heruntergeladen werden.",
        variant: "destructive",
      });
    } finally {
      setDownloadingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge variant="outline" className="text-green-600 border-green-600 gap-1">
            <FileCheck className="w-3 h-3" />
            Aktiv
          </Badge>
        );
      case "cancelled":
        return (
          <Badge variant="outline" className="text-red-600 border-red-600 gap-1">
            Storniert
          </Badge>
        );
      case "amended":
        return (
          <Badge variant="outline" className="text-amber-600 border-amber-600 gap-1">
            Geändert
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Meine Kaufverträge</h1>
        <p className="text-muted-foreground mt-1">
          Übersicht Ihrer Kaufverträge für ersteigerte Fahrzeuge
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Kaufverträge</p>
                <p className="text-2xl font-bold">{contracts.length}</p>
              </div>
              <FileCheck className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Aktiv</p>
                <p className="text-2xl font-bold text-green-600">
                  {contracts.filter(c => c.status === "active").length}
                </p>
              </div>
              <FileCheck className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Gesamtvolumen</p>
                <p className="text-2xl font-bold text-primary">
                  {contracts
                    .filter(c => c.status === "active")
                    .reduce((sum, c) => sum + Number(c.sale_price || 0), 0)
                    .toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
                </p>
              </div>
              <Euro className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Contract List */}
      {contracts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <FolderOpen className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Noch keine Kaufverträge</h3>
            <p className="text-muted-foreground max-w-md">
              Wenn Sie ein Fahrzeug über eine Auktion, Kaufchance oder Sofortkauf erwerben,
              wird Ihr Kaufvertrag hier automatisch hinterlegt.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {contracts.map((contract) => (
            <Card key={contract.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  {/* Contract Info */}
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <FileCheck className="w-6 h-6 text-primary" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold">Kaufvertrag {contract.contract_number}</h3>
                        {getStatusBadge(contract.status)}
                      </div>

                      {contract.vehicle_description && (
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Car className="w-3.5 h-3.5" />
                          <span>{contract.vehicle_description}</span>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                        {contract.sale_price && (
                          <div className="flex items-center gap-1">
                            <Euro className="w-3.5 h-3.5" />
                            <span>{Number(contract.sale_price).toLocaleString("de-DE")} €</span>
                          </div>
                        )}
                        {contract.created_at && (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>{format(new Date(contract.created_at), "dd. MMMM yyyy", { locale: de })}</span>
                          </div>
                        )}
                        {contract.seller_name && (
                          <span>Verkäufer: {contract.seller_name}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Download Button */}
                  <Button
                    variant="outline"
                    className="flex-shrink-0 w-full sm:w-auto"
                    onClick={() => handleDownload(contract)}
                    disabled={downloadingId === contract.id || (!contract.buyer_contract_url && !contract.buyer_storage_path && !contract.contract_url && !contract.storage_path)}
                  >
                    {downloadingId === contract.id ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4 mr-2" />
                    )}
                    PDF herunterladen
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Info Box */}
      <Card className="bg-muted/30 border-dashed">
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">
            <strong>Hinweis:</strong> Kaufverträge werden automatisch nach Zuschlag erstellt und Ihnen per E-Mail zugesandt.
            Hier können Sie Ihre Verträge jederzeit erneut herunterladen.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
