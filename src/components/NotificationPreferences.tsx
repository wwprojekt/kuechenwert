/**
 * Notification Preferences Component
 * Allows users to manage their notification settings
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { 
  Bell, 
  Mail, 
  Volume2, 
  Clock,
  TestTube
} from 'lucide-react';
import { useAudioNotification } from '@/hooks/useAudioNotification';

interface NotificationPreferences {
  // Email preferences
  email_new_bid: boolean;
  email_outbid: boolean;
  email_auction_ending: boolean;
  email_auction_won: boolean;
  email_payment_reminder: boolean;
  email_new_auction: boolean;
  email_price_alerts: boolean;
  
  // Audio preferences
  audio_enabled: boolean;
  audio_volume: number;
  audio_new_bid: boolean;
  audio_outbid: boolean;
  audio_auction_won: boolean;
  
  // Marketing preferences
  newsletter_enabled: boolean;
  promotional_emails: boolean;
  
  // Frequency settings
  digest_frequency: string;
  quiet_hours_start: string;
  quiet_hours_end: string;
  timezone: string;
}

export const NotificationPreferences = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const audioNotifications = useAudioNotification();
  
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    email_new_bid: true,
    email_outbid: true,
    email_auction_ending: true,
    email_auction_won: true,
    email_payment_reminder: true,
    email_new_auction: true,
    email_price_alerts: true,
    audio_enabled: true,
    audio_volume: 0.7,
    audio_new_bid: true,
    audio_outbid: true,
    audio_auction_won: true,
    newsletter_enabled: true,
    promotional_emails: false,
    digest_frequency: 'daily',
    quiet_hours_start: '22:00',
    quiet_hours_end: '08:00',
    timezone: 'Europe/Berlin',
  });

  // Fetch current preferences
  const { data: currentPreferences, isLoading } = useQuery({
    queryKey: ['notification-preferences', user?.id],
    queryFn: async () => {
      if (!user) return null;
      
      const { data, error } = await supabase
        .from('user_notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Update preferences when data is loaded
  useEffect(() => {
    if (currentPreferences) {
      setPreferences(currentPreferences);
    }
  }, [currentPreferences]);

  // Save preferences mutation
  const savePreferencesMutation = useMutation({
    mutationFn: async (prefs: NotificationPreferences) => {
      if (!user) throw new Error('User not authenticated');
      
      const { error } = await supabase
        .from('user_notification_preferences')
        .upsert({
          user_id: user.id,
          ...prefs,
        }, {
          onConflict: 'user_id',
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences', user?.id] });
      toast({
        title: 'Einstellungen gespeichert',
        description: 'Ihre Benachrichtigungseinstellungen wurden aktualisiert',
      });
    },
    onError: (_error) => {
      toast({
        title: 'Fehler',
        description: 'Einstellungen konnten nicht gespeichert werden',
        variant: 'destructive',
      });
    },
  });

  const handleSave = () => {
    savePreferencesMutation.mutate(preferences);
  };

  const handleTestAudio = async () => {
    await audioNotifications.testNotification();
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse space-y-4">
                <div className="h-4 bg-muted rounded w-1/3"></div>
                <div className="h-8 bg-muted rounded"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Benachrichtigungseinstellungen</h1>
        <p className="text-muted-foreground">
          Verwalten Sie, wie und wann Sie benachrichtigt werden möchten
        </p>
      </div>

      {/* Email Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            E-Mail-Benachrichtigungen
          </CardTitle>
          <CardDescription>
            Bestimmen Sie, für welche Ereignisse Sie E-Mails erhalten möchten
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="grid gap-4">
            {[
              { key: 'email_new_bid', label: 'Neue Gebote', description: 'Bei neuen Geboten auf Ihre Auktionen' },
              { key: 'email_outbid', label: 'Überboten', description: 'Wenn Sie bei einer Auktion überboten werden' },
              { key: 'email_auction_ending', label: 'Auktion endet bald', description: 'Erinnerung 1 Stunde vor Auktionsende' },
              { key: 'email_auction_won', label: 'Auktion gewonnen', description: 'Bestätigung bei gewonnenen Auktionen' },
              { key: 'email_payment_reminder', label: 'Zahlungserinnerungen', description: 'Rechnungen und Mahnungen' },
              { key: 'email_new_auction', label: 'Neue Auktionen', description: 'Benachrichtigung über neue Fahrzeuge' },
              { key: 'email_price_alerts', label: 'Preisalarme', description: 'Fahrzeuge in Ihrer Preisklasse' },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex-1">
                  <div className="font-medium">{item.label}</div>
                  <div className="text-sm text-muted-foreground">{item.description}</div>
                </div>
                <Switch
                  checked={preferences[item.key as keyof NotificationPreferences] as boolean}
                  onCheckedChange={(checked) =>
                    setPreferences({ ...preferences, [item.key]: checked })
                  }
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Audio Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="h-5 w-5" />
            Audio-Benachrichtigungen
          </CardTitle>
          <CardDescription>
            Ton-Benachrichtigungen für wichtige Ereignisse
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Audio-Benachrichtigungen aktivieren</div>
              <div className="text-sm text-muted-foreground">
                Ton abspielen bei wichtigen Ereignissen
              </div>
            </div>
            <Switch
              checked={preferences.audio_enabled}
              onCheckedChange={(checked) =>
                setPreferences({ ...preferences, audio_enabled: checked })
              }
            />
          </div>
          
          {preferences.audio_enabled && (
            <>
              <div className="space-y-3">
                <Label>Lautstärke: {Math.round(preferences.audio_volume * 100)}%</Label>
                <Slider
                  value={[preferences.audio_volume]}
                  onValueChange={([value]) =>
                    setPreferences({ ...preferences, audio_volume: value })
                  }
                  max={1}
                  min={0}
                  step={0.1}
                  className="w-full"
                />
              </div>
              
              <div className="grid gap-3">
                {[
                  { key: 'audio_new_bid', label: 'Neue Gebote', description: 'Ton bei neuen Geboten' },
                  { key: 'audio_outbid', label: 'Überboten', description: 'Warnton wenn überboten' },
                  { key: 'audio_auction_won', label: 'Auktion gewonnen', description: 'Erfolgston bei Gewinn' },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium">{item.label}</div>
                      <div className="text-sm text-muted-foreground">{item.description}</div>
                    </div>
                    <Switch
                      checked={preferences[item.key as keyof NotificationPreferences] as boolean}
                      onCheckedChange={(checked) =>
                        setPreferences({ ...preferences, [item.key]: checked })
                      }
                      disabled={!preferences.audio_enabled}
                    />
                  </div>
                ))}
              </div>
              
              <Button 
                variant="outline" 
                onClick={handleTestAudio}
                className="w-full"
                disabled={!preferences.audio_enabled}
              >
                <TestTube className="h-4 w-4 mr-2" />
                Test-Benachrichtigung abspielen
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Timing & Frequency */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Zeiteinstellungen
          </CardTitle>
          <CardDescription>
            Wann und wie oft Sie benachrichtigt werden möchten
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Ruhezeiten von</Label>
              <input
                type="time"
                value={preferences.quiet_hours_start}
                onChange={(e) => setPreferences({ ...preferences, quiet_hours_start: e.target.value })}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Ruhezeiten bis</Label>
              <input
                type="time"
                value={preferences.quiet_hours_end}
                onChange={(e) => setPreferences({ ...preferences, quiet_hours_end: e.target.value })}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>Benachrichtigungsfrequenz</Label>
            <Select
              value={preferences.digest_frequency}
              onValueChange={(value) => setPreferences({ ...preferences, digest_frequency: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="immediate">Sofort</SelectItem>
                <SelectItem value="hourly">Stündlich</SelectItem>
                <SelectItem value="daily">Täglich</SelectItem>
                <SelectItem value="weekly">Wöchentlich</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Während der Ruhezeiten werden nur wichtige Benachrichtigungen sofort gesendet
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Marketing Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Marketing & Newsletter
          </CardTitle>
          <CardDescription>
            Informationen über neue Features und Angebote
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Newsletter abonnieren</div>
              <div className="text-sm text-muted-foreground">
                Regelmäßige Updates über neue Features und Markttrends
              </div>
            </div>
            <Switch
              checked={preferences.newsletter_enabled}
              onCheckedChange={(checked) =>
                setPreferences({ ...preferences, newsletter_enabled: checked })
              }
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Werbe-E-Mails</div>
              <div className="text-sm text-muted-foreground">
                Spezielle Angebote und Aktionen
              </div>
            </div>
            <Switch
              checked={preferences.promotional_emails}
              onCheckedChange={(checked) =>
                setPreferences({ ...preferences, promotional_emails: checked })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button 
          onClick={handleSave}
          disabled={savePreferencesMutation.isPending}
          size="lg"
        >
          {savePreferencesMutation.isPending ? 'Speichert...' : 'Einstellungen speichern'}
        </Button>
      </div>
    </div>
  );
};

/**
 * Compact Notification Settings Component
 * For use in sidebars or settings dropdowns
 */
export const CompactNotificationSettings = () => {
  const { user } = useAuth();
  const audioNotifications = useAudioNotification();
  
  const { data: preferences } = useQuery({
    queryKey: ['notification-preferences', user?.id],
    queryFn: async () => {
      if (!user) return null;
      
      const { data, error } = await supabase
        .from('user_notification_preferences')
        .select('audio_enabled, email_outbid, email_new_bid')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const toggleAudio = async () => {
    if (!user) return;
    
    const newAudioState = !preferences?.audio_enabled;
    
    await supabase
      .from('user_notification_preferences')
      .upsert({
        user_id: user.id,
        audio_enabled: newAudioState,
      }, {
        onConflict: 'user_id',
      });
      
    if (newAudioState) {
      await audioNotifications.testNotification();
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={toggleAudio}
        className="flex items-center gap-2"
      >
        <Volume2 className="h-4 w-4" />
        {preferences?.audio_enabled ? 'Audio An' : 'Audio Aus'}
      </Button>
    </div>
  );
};

export default NotificationPreferences;
