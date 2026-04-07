/**
 * Damage Documentation Component
 * Separate damage photo upload and display system
 */

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  AlertTriangle, 
  Upload, 
  X, 
  Eye,
  Camera,
  FileImage,
  CheckCircle,
  Info
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { optimizeImage, validateImageFile, OPTIMIZATION_PRESETS } from '@/lib/imageOptimization';

interface DamageDocumentationProps {
  motorhomeId: string;
  variant?: 'upload' | 'display';
  onDamageChange?: (hasDamage: boolean) => void;
}

interface DamagePhoto {
  id: string;
  photo_url: string;
  damage_description: string;
  damage_severity: 'minor' | 'moderate' | 'major';
  damage_location: string;
  display_order: number;
}

const severityOptions = [
  { value: 'minor', label: 'Geringfügig', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'moderate', label: 'Mäßig', color: 'bg-orange-100 text-orange-800' },
  { value: 'major', label: 'Erheblich', color: 'bg-red-100 text-red-800' },
];

const locationOptions = [
  'Frontbereich',
  'Heckbereich', 
  'Linke Seite',
  'Rechte Seite',
  'Dach',
  'Innenraum',
  'Motor/Technik',
  'Reifen/Felgen',
  'Sonstiges'
];

export const DamageDocumentation = ({ 
  motorhomeId, 
  variant = 'display',
  onDamageChange 
}: DamageDocumentationProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [newDamageForm, setNewDamageForm] = useState({
    description: '',
    severity: 'minor' as 'minor' | 'moderate' | 'major',
    location: '',
  });

  // Fetch damage photos
  const { data: damagePhotos, isLoading } = useQuery({
    queryKey: ['damage-photos', motorhomeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('damage_photos')
        .select('*')
        .eq('motorhome_id', motorhomeId)
        .order('display_order');
      
      if (error) throw error;
      return data as DamagePhoto[];
    },
  });

  // Upload damage photo mutation
  const uploadDamagePhotoMutation = useMutation({
    mutationFn: async (file: File) => {
      // Validate file
      const validation = validateImageFile(file);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // Optimize image (with fallback for HEIC on unsupported browsers)
      let uploadFile: File;
      let fileExt: string;
      try {
        const optimized = await optimizeImage(file, OPTIMIZATION_PRESETS.STANDARD);
        uploadFile = optimized.file;
        fileExt = optimized.format;
      } catch {
        // Fallback: upload original file if optimization fails (e.g. HEIC)
        uploadFile = file;
        fileExt = file.name.split('.').pop() || 'jpg';
      }
      
      // Upload to storage
      const fileName = `${motorhomeId}/damage_${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('motorhome-photos')
        .upload(fileName, uploadFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('motorhome-photos')
        .getPublicUrl(fileName);

      // Save damage photo record
      const { error: insertError } = await supabase
        .from('damage_photos')
        .insert({
          motorhome_id: motorhomeId,
          photo_url: publicUrl,
          damage_description: newDamageForm.description,
          damage_severity: newDamageForm.severity,
          damage_location: newDamageForm.location,
          display_order: (damagePhotos?.length || 0) + 1,
        });

      if (insertError) throw insertError;

      return publicUrl;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['damage-photos', motorhomeId] });
      setNewDamageForm({
        description: '',
        severity: 'minor',
        location: '',
      });
      toast({
        title: 'Schadensfoto hochgeladen',
        description: 'Das Foto wurde erfolgreich hinzugefügt',
      });
      onDamageChange?.(true);
    },
    onError: (error) => {
      toast({
        title: 'Upload-Fehler',
        description: error instanceof Error ? error.message : 'Foto konnte nicht hochgeladen werden',
        variant: 'destructive',
      });
    },
  });

  // Delete damage photo mutation
  const deleteDamagePhotoMutation = useMutation({
    mutationFn: async (photoId: string) => {
      const { error } = await supabase
        .from('damage_photos')
        .delete()
        .eq('id', photoId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['damage-photos', motorhomeId] });
      toast({
        title: 'Foto gelöscht',
        description: 'Das Schadensfoto wurde entfernt',
      });
      
      // Check if any damage photos remain
      const remainingPhotos = damagePhotos?.filter(p => p.id !== arguments[0]) || [];
      onDamageChange?.(remainingPhotos.length > 0);
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!newDamageForm.description.trim()) {
      toast({
        title: 'Beschreibung erforderlich',
        description: 'Bitte beschreiben Sie den Schaden vor dem Upload',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      await uploadDamagePhotoMutation.mutateAsync(file);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const getSeverityBadge = (severity: string) => {
    const option = severityOptions.find(opt => opt.value === severity);
    return (
      <Badge className={option?.color || 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200'}>
        {option?.label || severity}
      </Badge>
    );
  };

  if (variant === 'display') {
    if (!damagePhotos || damagePhotos.length === 0) {
      return (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-6 text-center">
            <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
            <h3 className="font-semibold text-green-800 mb-2">Keine Schäden dokumentiert</h3>
            <p className="text-sm text-green-700">
              Der Verkäufer hat keine Schäden an diesem Fahrzeug gemeldet.
            </p>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className="border-orange-200 bg-orange-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-800">
            <AlertTriangle className="h-5 w-5" />
            Dokumentierte Schäden ({damagePhotos.length})
          </CardTitle>
          <CardDescription className="text-orange-700">
            Der Verkäufer hat folgende Schäden dokumentiert
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {damagePhotos.map((damage) => (
              <div key={damage.id} className="bg-card dark:bg-card p-4 rounded-lg border">
                <div className="aspect-video mb-3 overflow-hidden rounded-lg bg-muted">
                  <img
                    src={damage.photo_url}
                    alt={`Schaden: ${damage.damage_description}`}
                    loading="lazy"
                    className="w-full h-full object-cover hover:scale-105 transition-transform cursor-pointer"
                    onClick={() => window.open(damage.photo_url, '_blank')}
                  />
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-sm">{damage.damage_location}</h4>
                    {getSeverityBadge(damage.damage_severity)}
                  </div>
                  
                  <p className="text-sm text-muted-foreground">
                    {damage.damage_description}
                  </p>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-4 p-3 bg-orange-100 rounded-lg">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-orange-600 mt-0.5" />
              <div className="text-sm text-orange-800">
                <p className="font-medium">Wichtiger Hinweis</p>
                <p>Alle dokumentierten Schäden sind im Verkaufspreis berücksichtigt. 
                   Bitte prüfen Sie die Bilder sorgfältig vor dem Kauf.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Upload variant
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="h-5 w-5" />
          Schäden dokumentieren (optional)
        </CardTitle>
        <CardDescription>
          Dokumentieren Sie eventuelle Schäden am Fahrzeug mit Fotos und Beschreibungen
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Upload Form */}
        <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
          <h3 className="font-medium">Neuen Schaden dokumentieren</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="damage_location">Schadensstelle</Label>
              <Select
                value={newDamageForm.location}
                onValueChange={(value) => setNewDamageForm({ ...newDamageForm, location: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Wählen Sie..." />
                </SelectTrigger>
                <SelectContent>
                  {locationOptions.map((location) => (
                    <SelectItem key={location} value={location}>
                      {location}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="damage_severity">Schweregrad</Label>
              <Select
                value={newDamageForm.severity}
                onValueChange={(value: 'minor' | 'moderate' | 'major') => 
                  setNewDamageForm({ ...newDamageForm, severity: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {severityOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="damage_description">Schadensbeschreibung</Label>
            <Textarea
              id="damage_description"
              value={newDamageForm.description}
              onChange={(e) => setNewDamageForm({ ...newDamageForm, description: e.target.value })}
              placeholder="Beschreiben Sie den Schaden detailliert..."
              rows={3}
            />
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
          
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || !newDamageForm.description.trim() || !newDamageForm.location}
            className="w-full"
          >
            <Upload className="h-4 w-4 mr-2" />
            {isUploading ? 'Lädt hoch...' : 'Schadensfoto hochladen'}
          </Button>
          
          {isUploading && (
            <div className="space-y-2">
              <Progress value={uploadProgress} />
              <p className="text-xs text-center text-muted-foreground">
                Foto wird optimiert und hochgeladen...
              </p>
            </div>
          )}
        </div>

        {/* Existing Damage Photos */}
        {damagePhotos && damagePhotos.length > 0 && (
          <div className="space-y-4">
            <h3 className="font-medium">Dokumentierte Schäden ({damagePhotos.length})</h3>
            
            <div className="grid gap-4 md:grid-cols-2">
              {damagePhotos.map((damage) => (
                <div key={damage.id} className="border rounded-lg p-4 space-y-3">
                  <div className="aspect-video overflow-hidden rounded-lg bg-muted">
                    <img
                      src={damage.photo_url}
                      alt={`Schaden: ${damage.damage_description}`}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{damage.damage_location}</span>
                      {getSeverityBadge(damage.damage_severity)}
                    </div>
                    
                    <p className="text-sm text-muted-foreground">
                      {damage.damage_description}
                    </p>
                    
                    <div className="flex justify-between items-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(damage.photo_url, '_blank')}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Vergrößern
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteDamagePhotoMutation.mutate(damage.id)}
                        disabled={deleteDamagePhotoMutation.isPending}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No Damage State */}
        {(!damagePhotos || damagePhotos.length === 0) && !isLoading && (
          <div className="text-center py-8">
            <FileImage className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">Keine Schäden dokumentiert</p>
            <p className="text-sm text-muted-foreground mt-1">
              Falls Ihr Fahrzeug Schäden aufweist, dokumentieren Sie diese bitte mit Fotos
            </p>
          </div>
        )}

        {/* Information Box */}
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-800">
              <h4 className="font-medium mb-2">Warum Schäden dokumentieren?</h4>
              <ul className="space-y-1">
                <li>• Transparenz gegenüber potenziellen Käufern</li>
                <li>• Vermeidung von späteren Reklamationen</li>
                <li>• Realistische Preiseinschätzung</li>
                <li>• Vertrauensbildung durch Ehrlichkeit</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

/**
 * Damage Summary Component
 * Shows damage summary for listing cards
 */
export const DamageSummary = ({ motorhomeId }: { motorhomeId: string }) => {
  const { data: damagePhotos } = useQuery({
    queryKey: ['damage-photos', motorhomeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('damage_photos')
        .select('damage_severity')
        .eq('motorhome_id', motorhomeId);
      
      if (error) throw error;
      return data;
    },
  });

  if (!damagePhotos || damagePhotos.length === 0) {
    return null;
  }

  const majorDamages = damagePhotos.filter(d => d.damage_severity === 'major').length;
  const moderateDamages = damagePhotos.filter(d => d.damage_severity === 'moderate').length;
  const minorDamages = damagePhotos.filter(d => d.damage_severity === 'minor').length;

  return (
    <div className="flex items-center gap-2">
      <AlertTriangle className="h-4 w-4 text-orange-600" />
      <span className="text-sm text-orange-800">
        {majorDamages > 0 && `${majorDamages} erheblich`}
        {majorDamages > 0 && (moderateDamages > 0 || minorDamages > 0) && ', '}
        {moderateDamages > 0 && `${moderateDamages} mäßig`}
        {moderateDamages > 0 && minorDamages > 0 && ', '}
        {minorDamages > 0 && `${minorDamages} geringfügig`}
      </span>
    </div>
  );
};

export default DamageDocumentation;
