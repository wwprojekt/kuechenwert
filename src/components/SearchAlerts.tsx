/**
 * Search Alerts Component
 * Allows dealers to create saved searches with notifications
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Search, 
  Plus, 
  Bell, 
  Edit, 
  Trash2, 
  AlertCircle,
  Mail
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Constants } from '@/integrations/supabase/types';
import { ensureValidRLSSession } from '@/lib/sessionGuard';

interface SearchAlert {
  id: string;
  alert_name: string;
  search_criteria: any;
  email_enabled: boolean;
  alert_frequency: string;
  max_price?: number;
  is_active: boolean;
  match_count: number;
  last_triggered_at?: string;
}

interface SearchCriteria {
  manufacturer?: string;
  body_type?: string;
  min_year?: number;
  max_year?: number;
  max_price?: number;
  sleeping_places?: number;
  has_solar?: boolean;
  has_awning?: boolean;
}

const popularManufacturers = [
  'Hymer', 'Dethleffs', 'Knaus', 'Mercedes-Benz', 'Volkswagen',
  'Bürstner', 'Hobby', 'Adria', 'Carado', 'Weinsberg'
];

export const SearchAlerts = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAlert, setEditingAlert] = useState<SearchAlert | null>(null);
  const [alertForm, setAlertForm] = useState({
    alert_name: '',
    email_enabled: true,
    alert_frequency: 'immediate',
    criteria: {} as SearchCriteria,
  });

  // Fetch user's search alerts
  const { data: alerts, isLoading } = useQuery({
    queryKey: ['search-alerts', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) return [];
      
      const { data, error } = await supabase
        .from('search_alerts')
        .select('*')
        .eq('dealer_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as SearchAlert[];
    },
    enabled: !!user,
  });

  // Create/update alert mutation
  const alertMutation = useMutation({
    mutationFn: async (alertData: typeof alertForm & { id?: string }) => {
      if (!user) throw new Error('Not authenticated');
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) throw new Error('Session abgelaufen');
      
      const payload = {
        dealer_id: user.id,
        alert_name: alertData.alert_name,
        search_criteria: alertData.criteria,
        email_enabled: alertData.email_enabled,
        alert_frequency: alertData.alert_frequency,
        max_price: alertData.criteria.max_price || null,
        is_active: true,
      };

      if (alertData.id) {
        // Update existing alert
        const { error } = await supabase
          .from('search_alerts')
          .update(payload)
          .eq('id', alertData.id);
        if (error) throw error;
      } else {
        // Create new alert
        const { error } = await supabase
          .from('search_alerts')
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['search-alerts', user?.id] });
      setIsDialogOpen(false);
      setEditingAlert(null);
      setAlertForm({
        alert_name: '',
        email_enabled: true,
        alert_frequency: 'immediate',
        criteria: {},
      });
      toast({
        title: 'Suchauftrag gespeichert',
        description: 'Sie erhalten Benachrichtigungen bei passenden Fahrzeugen',
      });
    },
  });

  // Delete alert mutation
  const deleteAlertMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) throw new Error('Session abgelaufen');
      const { error } = await supabase
        .from('search_alerts')
        .update({ is_active: false })
        .eq('id', alertId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['search-alerts', user?.id] });
      toast({
        title: 'Suchauftrag gelöscht',
        description: 'Der Suchauftrag wurde deaktiviert',
      });
    },
  });

  const handleEditAlert = (alert: SearchAlert) => {
    setEditingAlert(alert);
    setAlertForm({
      alert_name: alert.alert_name,
      email_enabled: alert.email_enabled,
      alert_frequency: alert.alert_frequency,
      criteria: alert.search_criteria,
    });
    setIsDialogOpen(true);
  };

  const handleSubmitAlert = () => {
    if (!alertForm.alert_name.trim()) {
      toast({
        title: 'Name erforderlich',
        description: 'Bitte geben Sie einen Namen für den Suchauftrag ein',
        variant: 'destructive',
      });
      return;
    }

    alertMutation.mutate({
      ...alertForm,
      id: editingAlert?.id,
    });
  };

  const formatCriteria = (criteria: SearchCriteria): string => {
    const parts = [];
    
    if (criteria.manufacturer) parts.push(`Hersteller: ${criteria.manufacturer}`);
    if (criteria.body_type) parts.push(`Aufbau: ${criteria.body_type}`);
    if (criteria.min_year || criteria.max_year) {
      const yearRange = `${criteria.min_year || ''}${criteria.min_year && criteria.max_year ? '-' : ''}${criteria.max_year || ''}`;
      parts.push(`Baujahr: ${yearRange}`);
    }
    if (criteria.max_price) parts.push(`Max: €${criteria.max_price.toLocaleString('de-DE')}`);
    if (criteria.sleeping_places) parts.push(`${criteria.sleeping_places} Schlafplätze`);
    if (criteria.has_solar) parts.push('Mit Solar');
    if (criteria.has_awning) parts.push('Mit Markise');
    
    return parts.length > 0 ? parts.join(' • ') : 'Alle Fahrzeuge';
  };

  const getFrequencyBadge = (frequency: string) => {
    const colors = {
      immediate: 'bg-red-100 text-red-800',
      daily: 'bg-blue-100 text-blue-800',
      weekly: 'bg-green-100 text-green-800',
    };
    
    const labels = {
      immediate: 'Sofort',
      daily: 'Täglich',
      weekly: 'Wöchentlich',
    };
    
    return (
      <Badge className={colors[frequency as keyof typeof colors]}>
        {labels[frequency as keyof typeof labels]}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Suchaufträge</h1>
          <p className="text-muted-foreground">
            Lassen Sie sich über passende Fahrzeuge benachrichtigen
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => {
              setEditingAlert(null);
              setAlertForm({
                alert_name: '',
                email_enabled: true,
                alert_frequency: 'immediate',
                criteria: {},
              });
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Neuer Suchauftrag
            </Button>
          </DialogTrigger>
          
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingAlert ? 'Suchauftrag bearbeiten' : 'Neuer Suchauftrag'}
              </DialogTitle>
              <DialogDescription>
                Definieren Sie Ihre Suchkriterien für automatische Benachrichtigungen
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Alert Name */}
              <div className="space-y-2">
                <Label htmlFor="alert_name">Name des Suchauftrags *</Label>
                <Input
                  id="alert_name"
                  value={alertForm.alert_name}
                  onChange={(e) => setAlertForm({ ...alertForm, alert_name: e.target.value })}
                  placeholder="z.B. Hymer B-Klasse unter 50k"
                />
              </div>

              {/* Search Criteria */}
              <div className="space-y-4">
                <h3 className="font-medium">Suchkriterien</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Hersteller (optional)</Label>
                    <Select
                      value={alertForm.criteria.manufacturer || '__all__'}
                      onValueChange={(value) => setAlertForm({
                        ...alertForm,
                        criteria: { ...alertForm.criteria, manufacturer: value === '__all__' ? undefined : value }
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Alle Hersteller" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">Alle Hersteller</SelectItem>
                        {popularManufacturers.map((brand) => (
                          <SelectItem key={brand} value={brand}>
                            {brand}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Aufbauart (optional)</Label>
                    <Select
                      value={alertForm.criteria.body_type || '__all__'}
                      onValueChange={(value) => setAlertForm({
                        ...alertForm,
                        criteria: { ...alertForm.criteria, body_type: value === '__all__' ? undefined : value }
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Alle Aufbauarten" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">Alle Aufbauarten</SelectItem>
                        {Constants.public.Enums.motorhome_body_type.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Baujahr von (optional)</Label>
                    <Input
                      type="number"
                      value={alertForm.criteria.min_year || ''}
                      onChange={(e) => setAlertForm({
                        ...alertForm,
                        criteria: { ...alertForm.criteria, min_year: e.target.value ? parseInt(e.target.value) : undefined }
                      })}
                      placeholder="z.B. 2015"
                      min={1980}
                      max={new Date().getFullYear()}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Baujahr bis (optional)</Label>
                    <Input
                      type="number"
                      value={alertForm.criteria.max_year || ''}
                      onChange={(e) => setAlertForm({
                        ...alertForm,
                        criteria: { ...alertForm.criteria, max_year: e.target.value ? parseInt(e.target.value) : undefined }
                      })}
                      placeholder="z.B. 2023"
                      min={1980}
                      max={new Date().getFullYear()}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Maximaler Preis (optional)</Label>
                    <Input
                      type="number"
                      value={alertForm.criteria.max_price || ''}
                      onChange={(e) => setAlertForm({
                        ...alertForm,
                        criteria: { ...alertForm.criteria, max_price: e.target.value ? parseFloat(e.target.value) : undefined }
                      })}
                      placeholder="z.B. 75000"
                      min={0}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Schlafplätze (optional)</Label>
                    <Select
                      value={alertForm.criteria.sleeping_places?.toString() || '__all__'}
                      onValueChange={(value) => setAlertForm({
                        ...alertForm,
                        criteria: { ...alertForm.criteria, sleeping_places: value === '__all__' ? undefined : parseInt(value) }
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Beliebig" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">Beliebig</SelectItem>
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
                          <SelectItem key={num} value={num.toString()}>
                            {num} Schlafplätze
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                {/* Feature Checkboxes */}
                <div className="space-y-3">
                  <Label>Ausstattung (optional)</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="has_solar"
                        checked={alertForm.criteria.has_solar || false}
                        onCheckedChange={(checked) => setAlertForm({
                          ...alertForm,
                          criteria: { ...alertForm.criteria, has_solar: checked || undefined }
                        })}
                      />
                      <Label htmlFor="has_solar" className="cursor-pointer">Solaranlage</Label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="has_awning"
                        checked={alertForm.criteria.has_awning || false}
                        onCheckedChange={(checked) => setAlertForm({
                          ...alertForm,
                          criteria: { ...alertForm.criteria, has_awning: checked || undefined }
                        })}
                      />
                      <Label htmlFor="has_awning" className="cursor-pointer">Markise</Label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notification Settings */}
              <div className="space-y-4">
                <h3 className="font-medium">Benachrichtigungseinstellungen</h3>
                
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">E-Mail-Benachrichtigungen</div>
                    <div className="text-sm text-muted-foreground">
                      Benachrichtigung per E-Mail erhalten
                    </div>
                  </div>
                  <Switch
                    checked={alertForm.email_enabled}
                    onCheckedChange={(checked) => setAlertForm({ ...alertForm, email_enabled: checked })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Benachrichtigungsfrequenz</Label>
                  <Select
                    value={alertForm.alert_frequency}
                    onValueChange={(value) => setAlertForm({ ...alertForm, alert_frequency: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="immediate">Sofort</SelectItem>
                      <SelectItem value="daily">Täglich</SelectItem>
                      <SelectItem value="weekly">Wöchentlich</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Abbrechen
                </Button>
                <Button 
                  onClick={handleSubmitAlert}
                  disabled={alertMutation.isPending || !alertForm.alert_name.trim()}
                >
                  {alertMutation.isPending ? 'Speichert...' : 'Speichern'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search Alerts List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          </div>
        ) : alerts && alerts.length > 0 ? (
          alerts.map((alert) => (
            <Card key={alert.id} className={alert.is_active ? '' : 'opacity-50'}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold">{alert.alert_name}</h3>
                      {getFrequencyBadge(alert.alert_frequency)}
                      {alert.match_count > 0 && (
                        <Badge variant="outline">
                          {alert.match_count} Treffer
                        </Badge>
                      )}
                    </div>
                    
                    <p className="text-sm text-muted-foreground mb-3">
                      {formatCriteria(alert.search_criteria)}
                    </p>
                    
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {alert.email_enabled ? 'E-Mail aktiv' : 'E-Mail deaktiviert'}
                      </div>
                      {alert.last_triggered_at && (
                        <div className="flex items-center gap-1">
                          <Bell className="h-3 w-3" />
                          Letzter Treffer: {new Date(alert.last_triggered_at).toLocaleDateString('de-DE')}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleEditAlert(alert)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => deleteAlertMutation.mutate(alert.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="font-semibold mb-2">Keine Suchaufträge</h3>
              <p className="text-muted-foreground mb-4">
                Erstellen Sie Ihren ersten Suchauftrag, um über passende Fahrzeuge benachrichtigt zu werden
              </p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Ersten Suchauftrag erstellen
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Information Box */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-800">
              <h4 className="font-medium mb-1">So funktionieren Suchaufträge</h4>
              <ul className="space-y-1">
                <li>• Automatische Benachrichtigung bei passenden Fahrzeugen</li>
                <li>• Individuelle Suchkriterien und Benachrichtigungsfrequenz</li>
                <li>• Jederzeit bearbeitbar oder deaktivierbar</li>
                <li>• Keine Verpflichtung zum Kauf</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SearchAlerts;
