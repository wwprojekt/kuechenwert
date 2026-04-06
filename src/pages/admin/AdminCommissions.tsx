/**
 * Admin Commission Management
 * Interface for managing tiered commission rates and volume discounts
 */

import { useState } from 'react';
import { logger } from '@/lib/logger';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Calculator,
  Gift
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { type CommissionTier } from '@/lib/commissionCalculator';

export default function AdminCommissions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [editingTier, setEditingTier] = useState<CommissionTier | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const [tierForm, setTierForm] = useState({
    min_amount: '',
    max_amount: '',
    rate_type: 'percentage' as 'percentage' | 'fixed',
    rate_value: '',
    min_commission: '',
  });

  // Fetch commission tiers
  const { data: tiers, isLoading: tiersLoading } = useQuery({
    queryKey: ['commission-tiers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('commission_tiers')
        .select('*')
        .order('min_amount');
      
      if (error) throw error;
      return data as CommissionTier[];
    },
  });

  // Fetch volume discounts
  const { data: volumeDiscounts, isLoading: discountsLoading } = useQuery({
    queryKey: ['volume-discounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dealer_volume_discounts')
        .select(`
          *,
          dealer:profiles(first_name, last_name, company_name, email)
        `)
        .eq('is_active', true)
        .order('discount_rate', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  // Create/Update tier mutation
  const tierMutation = useMutation({
    mutationFn: async (tierData: typeof tierForm & { id?: string }) => {
      const payload = {
        min_amount: parseFloat(tierData.min_amount),
        max_amount: parseFloat(tierData.max_amount),
        rate_type: tierData.rate_type,
        rate_value: parseFloat(tierData.rate_value),
        min_commission: parseFloat(tierData.min_commission || '0'),
        is_active: true,
      };

      if (tierData.id) {
        // Update existing tier
        const { error } = await supabase
          .from('commission_tiers')
          .update(payload)
          .eq('id', tierData.id);
        if (error) throw error;
      } else {
        // Create new tier
        const { error } = await supabase
          .from('commission_tiers')
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commission-tiers'] });
      setIsDialogOpen(false);
      setEditingTier(null);
      setTierForm({
        min_amount: '',
        max_amount: '',
        rate_type: 'percentage',
        rate_value: '',
        min_commission: '',
      });
      toast({
        title: 'Erfolg',
        description: 'Provisionsstufe wurde gespeichert',
      });
    },
    onError: (error) => {
      toast({
        title: 'Fehler',
        description: error instanceof Error ? error.message : 'Fehler beim Speichern',
        variant: 'destructive',
      });
    },
  });

  // Delete tier mutation
  const deleteTierMutation = useMutation({
    mutationFn: async (tierId: string) => {
      const { error } = await supabase
        .from('commission_tiers')
        .update({ is_active: false })
        .eq('id', tierId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commission-tiers'] });
      toast({
        title: 'Erfolg',
        description: 'Provisionsstufe wurde deaktiviert',
      });
    },
  });

  const handleEditTier = (tier: CommissionTier) => {
    setEditingTier(tier);
    setTierForm({
      min_amount: tier.min_amount.toString(),
      max_amount: tier.max_amount.toString(),
      rate_type: tier.rate_type,
      rate_value: tier.rate_value.toString(),
      min_commission: tier.min_commission.toString(),
    });
    setIsDialogOpen(true);
  };

  const handleSubmitTier = () => {
    tierMutation.mutate({
      ...tierForm,
      id: editingTier?.id,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Provisionsmanagement</h1>
          <p className="text-muted-foreground">
            Verwalten Sie die Provisionsstrukturen und Volumenrabatte
          </p>
        </div>
      </div>

      {/* Commission Tiers */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Provisionsstufen
              </CardTitle>
              <CardDescription>
                Gestaffelte Provisionsraten basierend auf Fahrzeugwert
              </CardDescription>
            </div>
            
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => {
                  setEditingTier(null);
                  setTierForm({
                    min_amount: '',
                    max_amount: '',
                    rate_type: 'percentage',
                    rate_value: '',
                    min_commission: '',
                  });
                }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Neue Stufe
                </Button>
              </DialogTrigger>
              
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingTier ? 'Provisionsstufe bearbeiten' : 'Neue Provisionsstufe'}
                  </DialogTitle>
                  <DialogDescription>
                    Konfigurieren Sie die Provisionsrate für einen Preisbereich
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Von (€)</Label>
                      <Input
                        type="number"
                        value={tierForm.min_amount}
                        onChange={(e) => setTierForm({ ...tierForm, min_amount: e.target.value })}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Bis (€)</Label>
                      <Input
                        type="number"
                        value={tierForm.max_amount}
                        onChange={(e) => setTierForm({ ...tierForm, max_amount: e.target.value })}
                        placeholder="10000"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Provisionsart</Label>
                    <Select
                      value={tierForm.rate_type}
                      onValueChange={(value: 'percentage' | 'fixed') => 
                        setTierForm({ ...tierForm, rate_type: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">Prozentual</SelectItem>
                        <SelectItem value="fixed">Festbetrag</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>
                        {tierForm.rate_type === 'percentage' ? 'Prozentsatz (%)' : 'Festbetrag (€)'}
                      </Label>
                      <Input
                        type="number"
                        step={tierForm.rate_type === 'percentage' ? '0.1' : '1'}
                        value={tierForm.rate_value}
                        onChange={(e) => setTierForm({ ...tierForm, rate_value: e.target.value })}
                        placeholder={tierForm.rate_type === 'percentage' ? '2.0' : '200'}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Mindestprovision (€)</Label>
                      <Input
                        type="number"
                        value={tierForm.min_commission}
                        onChange={(e) => setTierForm({ ...tierForm, min_commission: e.target.value })}
                        placeholder="150"
                      />
                    </div>
                  </div>
                  
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Abbrechen
                    </Button>
                    <Button onClick={handleSubmitTier} disabled={tierMutation.isPending}>
                      {tierMutation.isPending ? 'Speichert...' : 'Speichern'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        
        <CardContent>
          {tiersLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            </div>
          ) : (
            <div className="space-y-4">
              {tiers?.map((tier) => (
                <div
                  key={tier.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-4">
                      <div>
                        <div className="font-medium">
                          €{tier.min_amount.toLocaleString('de-DE')} - €{tier.max_amount.toLocaleString('de-DE')}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {tier.rate_type === 'percentage' 
                            ? `${tier.rate_value}% (min. €${tier.min_commission})`
                            : `€${tier.rate_value} Festbetrag`
                          }
                        </div>
                      </div>
                      
                      <Badge variant={tier.is_active ? 'default' : 'secondary'}>
                        {tier.is_active ? 'Aktiv' : 'Inaktiv'}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditTier(tier)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteTierMutation.mutate(tier.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Volume Discounts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5" />
            Volumenrabatte
          </CardTitle>
          <CardDescription>
            Automatische Rabatte für Großkunden
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {discountsLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            </div>
          ) : (
            <div className="space-y-4">
              {volumeDiscounts?.map((discount: any) => (
                <div
                  key={discount.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="font-medium">
                      {discount.dealer.company_name || 
                       `${discount.dealer.first_name} ${discount.dealer.last_name}`}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Volumen: €{discount.purchase_volume.toLocaleString('de-DE')} • 
                      Rabatt: {discount.discount_rate}%
                    </div>
                  </div>
                  
                  <Badge variant="default">
                    {discount.discount_rate}% Rabatt
                  </Badge>
                </div>
              ))}
              
              {(!volumeDiscounts || volumeDiscounts.length === 0) && (
                <div className="text-center py-8 text-muted-foreground">
                  Keine aktiven Volumenrabatte
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Commission Calculator Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Provisionsrechner
          </CardTitle>
          <CardDescription>
            Testen Sie die Provisionsberechnung
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <CommissionCalculatorPreview />
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Commission Calculator Preview Component
 */
const CommissionCalculatorPreview = () => {
  const [testAmount, setTestAmount] = useState('45000');
  const [calculation, setCalculation] = useState<any>(null);

  const calculateTest = async () => {
    try {
      const { data, error } = await supabase
        .rpc('calculate_commission', {
          sale_amount: parseFloat(testAmount),
          dealer_id_param: null
        });

      if (error) throw error;
      setCalculation(Array.isArray(data) && data.length > 0 ? data[0] : data);
    } catch (error) {
      logger.error('Test calculation error:', error);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-4 items-end">
        <div className="space-y-2">
          <Label>Testbetrag (€)</Label>
          <Input
            type="number"
            value={testAmount}
            onChange={(e) => setTestAmount(e.target.value)}
            placeholder="45000"
            className="w-32"
          />
        </div>
        <Button onClick={calculateTest}>
          Berechnen
        </Button>
      </div>
      
      {calculation && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
          <div>
            <div className="text-sm text-muted-foreground">Verkaufspreis</div>
            <div className="font-bold">
              €{parseFloat(testAmount).toLocaleString('de-DE')}
            </div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Provisionssatz</div>
            <div className="font-bold">
              {calculation.final_rate.toFixed(2)}%
            </div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Provision</div>
            <div className="font-bold text-orange-600">
              €{calculation.commission_amount.toLocaleString('de-DE')}
            </div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Gesamtkosten</div>
            <div className="font-bold">
              €{(parseFloat(testAmount) + calculation.commission_amount).toLocaleString('de-DE')}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
