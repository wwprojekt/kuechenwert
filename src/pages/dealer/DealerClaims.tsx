/**
 * Dealer Claims Management
 * Interface for dealers to submit and manage claims
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AUCTION_PUBLIC_COLUMNS } from '@/lib/auction-columns';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  AlertTriangle, 
  Plus, 
  FileText, 
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  Camera
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface Claim {
  id: string;
  auction_id: string;
  claim_type: string;
  title: string;
  description: string;
  claim_amount?: number;
  status: string;
  priority: string;
  submitted_at: string;
  resolved_at?: string;
  approved_amount?: number;
  commission_charged_to_seller: boolean;
  motorhome: {
    manufacturer: string;
    model: string;
    listing_number: string;
  };
  photos: any[];
}

const claimTypes = [
  { value: 'condition_mismatch', label: 'Zustand weicht ab', description: 'Fahrzeugzustand entspricht nicht der Beschreibung' },
  { value: 'damage_not_disclosed', label: 'Schäden nicht angegeben', description: 'Nicht dokumentierte Schäden entdeckt' },
  { value: 'technical_issue', label: 'Technische Mängel', description: 'Technische Probleme oder Defekte' },
  { value: 'documentation_error', label: 'Dokumentationsfehler', description: 'Fehlerhafte oder fehlende Dokumente' },
  { value: 'other', label: 'Sonstiges', description: 'Andere Probleme oder Unstimmigkeiten' },
];

export default function DealerClaims() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedAuction, setSelectedAuction] = useState('');
  const [claimForm, setClaimForm] = useState({
    claim_type: '',
    title: '',
    description: '',
    claim_amount: '',
  });

  // Fetch dealer's won auctions (for claim submission)
  const { data: wonAuctions } = useQuery({
    queryKey: ['won-auctions', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      // P4-Hardening: explizite Spalten statt '*' (Tabellen-SELECT auf
      // public.auctions ist für authenticated revoked).
      const { data, error } = await supabase
        .from('auctions')
        .select(`
          ${AUCTION_PUBLIC_COLUMNS},
          motorhome:motorhomes(manufacturer, model, listing_number)
        `)
        .eq('status', 'sold')
        .in('motorhome.sold_to', [user.id])
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch dealer's claims
  const { data: claims, isLoading } = useQuery({
    queryKey: ['dealer-claims', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('claims')
        .select(`
          *,
          motorhome:motorhomes(manufacturer, model, listing_number),
          photos:claim_photos(*)
        `)
        .eq('dealer_id', user.id)
        .order('submitted_at', { ascending: false });
      
      if (error) throw error;
      return data as Claim[];
    },
    enabled: !!user,
  });

  // Submit claim mutation
  const submitClaimMutation = useMutation({
    mutationFn: async (claimData: typeof claimForm) => {
      if (!user || !selectedAuction) throw new Error('Missing required data');
      
      // Get auction and motorhome details
      const { data: auction, error: auctionError } = await supabase
        .from('auctions')
        .select('motorhome_id')
        .eq('id', selectedAuction)
        .single();
      
      if (auctionError || !auction) throw new Error('Auction not found');

      const { error } = await supabase
        .from('claims')
        .insert({
          auction_id: selectedAuction,
          dealer_id: user.id,
          motorhome_id: auction.motorhome_id,
          claim_type: claimData.claim_type,
          title: claimData.title,
          description: claimData.description,
          claim_amount: claimData.claim_amount ? parseFloat(claimData.claim_amount) : null,
          status: 'submitted',
          priority: 'medium',
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dealer-claims', user?.id] });
      setIsDialogOpen(false);
      setSelectedAuction('');
      setClaimForm({
        claim_type: '',
        title: '',
        description: '',
        claim_amount: '',
      });
      toast({
        title: 'Reklamation eingereicht',
        description: 'Ihre Reklamation wird geprüft und Sie erhalten eine Rückmeldung',
      });
    },
  });

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      submitted: { color: 'bg-blue-100 text-blue-800', icon: Clock, label: 'Eingereicht' },
      under_review: { color: 'bg-yellow-100 text-yellow-800', icon: Eye, label: 'In Prüfung' },
      approved: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Genehmigt' },
      rejected: { color: 'bg-red-100 text-red-800', icon: XCircle, label: 'Abgelehnt' },
      resolved: { color: 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200', icon: CheckCircle, label: 'Abgeschlossen' },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig];
    return (
      <Badge className={config?.color || 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200'}>
        <config.icon className="h-3 w-3 mr-1" />
        {config?.label || status}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const colors = {
      low: 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200',
      medium: 'bg-blue-100 text-blue-800',
      high: 'bg-orange-100 text-orange-800',
      urgent: 'bg-red-100 text-red-800',
    };
    
    return (
      <Badge className={colors[priority as keyof typeof colors]}>
        {priority === 'low' ? 'Niedrig' : 
         priority === 'medium' ? 'Mittel' :
         priority === 'high' ? 'Hoch' : 'Dringend'}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Reklamationen</h1>
          <p className="text-muted-foreground">
            Verwalten Sie Ihre Reklamationen und Beschwerden
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Neue Reklamation
            </Button>
          </DialogTrigger>
          
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Neue Reklamation einreichen</DialogTitle>
              <DialogDescription>
                Reklamieren Sie Probleme mit gekauften Fahrzeugen
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Auction Selection */}
              <div className="space-y-2">
                <Label>Betroffene Auktion *</Label>
                <Select value={selectedAuction} onValueChange={setSelectedAuction}>
                  <SelectTrigger>
                    <SelectValue placeholder="Auktion auswählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {(Array.isArray(wonAuctions) ? wonAuctions : []).map((auction: any) => (
                      <SelectItem key={auction.id} value={auction.id}>
                        {auction.motorhome && typeof auction.motorhome === 'object' && !Array.isArray(auction.motorhome)
                          ? `${auction.motorhome.manufacturer} ${auction.motorhome.model} (${auction.motorhome.listing_number})`
                          : 'Unbekanntes Fahrzeug'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Claim Type */}
              <div className="space-y-2">
                <Label>Art der Reklamation *</Label>
                <Select
                  value={claimForm.claim_type}
                  onValueChange={(value) => setClaimForm({ ...claimForm, claim_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Reklamationsgrund auswählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {claimTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {claimForm.claim_type && (
                  <p className="text-xs text-muted-foreground">
                    {claimTypes.find(t => t.value === claimForm.claim_type)?.description}
                  </p>
                )}
              </div>

              {/* Claim Details */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="claim_title">Titel der Reklamation *</Label>
                  <Input
                    id="claim_title"
                    value={claimForm.title}
                    onChange={(e) => setClaimForm({ ...claimForm, title: e.target.value })}
                    placeholder="Kurze Beschreibung des Problems"
                    maxLength={100}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="claim_description">Detaillierte Beschreibung *</Label>
                  <Textarea
                    id="claim_description"
                    value={claimForm.description}
                    onChange={(e) => setClaimForm({ ...claimForm, description: e.target.value })}
                    placeholder="Beschreiben Sie das Problem detailliert..."
                    rows={5}
                    maxLength={2000}
                  />
                  <p className="text-xs text-muted-foreground">
                    {claimForm.description.length}/2000 Zeichen
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="claim_amount">Schadenshöhe (€, optional)</Label>
                  <Input
                    id="claim_amount"
                    type="text"
                    inputMode="numeric"
                    value={claimForm.claim_amount}
                    onChange={(e) => setClaimForm({ ...claimForm, claim_amount: e.target.value.replace(/\D/g, '') })}
                    placeholder="Geschätzter Schaden in Euro"
                  />
                </div>
              </div>

              <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
                  <div className="text-sm text-orange-800">
                    <h4 className="font-medium mb-1">Wichtige Hinweise</h4>
                    <ul className="space-y-1">
                      <li>• Reklamationen werden von unserem Team geprüft</li>
                      <li>• Bei genehmigten Reklamationen trägt der Verkäufer die Provision</li>
                      <li>• Fügen Sie Beweisfotos hinzu, um Ihre Reklamation zu unterstützen</li>
                      <li>• Falsche Reklamationen können zu Sanktionen führen</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Abbrechen
                </Button>
                <Button 
                  onClick={() => submitClaimMutation.mutate(claimForm)}
                  disabled={submitClaimMutation.isPending || !selectedAuction || !claimForm.claim_type || !claimForm.title.trim() || !claimForm.description.trim()}
                >
                  {submitClaimMutation.isPending ? 'Sendet...' : 'Reklamation einreichen'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Claims List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          </div>
        ) : claims && claims.length > 0 ? (
          claims.map((claim) => (
            <Card key={claim.id}>
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-start justify-between mb-3 sm:mb-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm sm:text-base mb-1.5 line-clamp-2">{claim.title}</h3>
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      {getStatusBadge(claim.status)}
                      {getPriorityBadge(claim.priority)}
                    </div>
                    
                    <p className="text-xs sm:text-sm text-muted-foreground mb-2 sm:mb-3 truncate">
                      {claim.motorhome && typeof claim.motorhome === 'object' && !Array.isArray(claim.motorhome)
                        ? `${claim.motorhome.manufacturer} ${claim.motorhome.model} (${claim.motorhome.listing_number})`
                        : 'Fahrzeug unbekannt'}
                    </p>
                    
                    <p className="text-xs sm:text-sm mb-2 sm:mb-3 line-clamp-3">{claim.description}</p>
                    
                    <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs text-muted-foreground">
                      <span>{format(new Date(claim.submitted_at), 'dd.MM.yyyy', { locale: de })}</span>
                      {claim.claim_amount && (
                        <span>€{claim.claim_amount.toLocaleString('de-DE')}</span>
                      )}
                      {(Array.isArray(claim.photos) ? claim.photos : claim.photos ? [claim.photos] : []).length > 0 && (
                        <span className="flex items-center gap-1">
                          <Camera className="h-3 w-3" />
                          {(Array.isArray(claim.photos) ? claim.photos : [claim.photos]).length} Foto{(Array.isArray(claim.photos) ? claim.photos : [claim.photos]).length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Claim Resolution */}
                {claim.status === 'approved' && (
                  <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="font-medium text-green-800">Reklamation genehmigt</span>
                    </div>
                    <div className="text-sm text-green-700">
                      <p>Genehmigte Summe: €{claim.approved_amount?.toLocaleString('de-DE') || '0'}</p>
                      {claim.commission_charged_to_seller && (
                        <p>Die Provision wurde dem Verkäufer in Rechnung gestellt.</p>
                      )}
                    </div>
                  </div>
                )}
                
                {claim.status === 'rejected' && (
                  <div className="mt-4 p-4 bg-red-50 rounded-lg border border-red-200">
                    <div className="flex items-center gap-2 mb-2">
                      <XCircle className="h-5 w-5 text-red-600" />
                      <span className="font-medium text-red-800">Reklamation abgelehnt</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="font-semibold mb-2">Keine Reklamationen</h3>
              <p className="text-muted-foreground mb-4">
                Sie haben noch keine Reklamationen eingereicht
              </p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Erste Reklamation einreichen
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Information */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <FileText className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-800">
              <h4 className="font-medium mb-1">Reklamationsprozess</h4>
              <ol className="list-decimal list-inside space-y-1">
                <li>Reklamation mit Beweisfotos einreichen</li>
                <li>Prüfung durch unser Expertenteam (1-3 Werktage)</li>
                <li>Entscheidung und Benachrichtigung</li>
                <li>Bei Genehmigung: Provision wird dem Verkäufer berechnet</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
