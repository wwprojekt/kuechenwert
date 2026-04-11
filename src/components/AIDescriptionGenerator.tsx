/**
 * AI Description Generator Component
 * OpenAI-powered motorhome description generation
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import { invokeWithAuth, SessionExpiredError } from '@/lib/sessionGuard';
import { 
  Sparkles, 
  Wand2, 
  Copy, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle,
  Loader2
} from 'lucide-react';
import type { WizardFormData } from '@/hooks/useWizardForm';

interface AIDescriptionGeneratorProps {
  formData: WizardFormData;
  currentDescription: string;
  onDescriptionGenerated: (description: string) => void;
  className?: string;
}

export const AIDescriptionGenerator = ({ 
  formData, 
  currentDescription: _currentDescription,
  onDescriptionGenerated,
  className = ''
}: AIDescriptionGeneratorProps) => {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedDescription, setGeneratedDescription] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  const canGenerate = Boolean(
    formData.manufacturer && 
    formData.model && 
    formData.year && 
    formData.mileage &&
    formData.condition &&
    formData.bodyType &&
    formData.sleeping_places
  );

  const generateDescription = async () => {
    if (!canGenerate) {
      toast({
        title: 'Unvollständige Daten',
        description: 'Bitte füllen Sie mindestens die Grunddaten aus (Hersteller, Modell, Jahr, Kilometerstand, Zustand, Aufbauart, Schlafplätze)',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);

    try {
      const { data, error } = await invokeWithAuth('generate-ai-description', {
        body: {
          manufacturer: formData.manufacturer,
          model: formData.model,
          year: formData.year,
          mileage: formData.mileage,
          condition: formData.condition,
          bodyType: formData.bodyType,
          sleepingPlaces: formData.sleeping_places,
          features: {
            has_kitchen: formData.has_kitchen,
            has_toilet: formData.has_toilet,
            has_shower: formData.has_shower,
            has_solar: formData.has_solar,
            has_awning: formData.has_awning,
            heating_type: formData.heating_type,
            air_conditioning_type: formData.air_conditioning_type,
            has_inverter: formData.has_inverter,
            has_bike_rack: formData.has_bike_rack,
            has_garage: formData.has_garage,
          },
          additionalEquipment: formData.additional_equipment,
        } as Record<string, unknown>,
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data.success) {
        setGeneratedDescription(data.description);
        setShowPreview(true);
        toast({
          title: 'Beschreibung generiert! ✨',
          description: 'KI-Beschreibung wurde erfolgreich erstellt',
        });
      } else {
        // Use fallback description
        setGeneratedDescription(data.fallback_description);
        setShowPreview(true);
        toast({
          title: 'Fallback-Beschreibung',
          description: 'KI nicht verfügbar, Basis-Beschreibung wurde erstellt',
          variant: 'default',
        });
      }

    } catch (error) {
      if (error instanceof SessionExpiredError) {
        toast({
          title: 'Sitzung abgelaufen',
          description: 'Bitte melden Sie sich erneut an',
          variant: 'destructive',
        });
        return;
      }
      logger.error('AI description generation error:', error);
      toast({
        title: 'Fehler bei der KI-Generierung',
        description: error instanceof Error ? error.message : 'Beschreibung konnte nicht generiert werden',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const useGeneratedDescription = () => {
    onDescriptionGenerated(generatedDescription);
    setShowPreview(false);
    toast({
      title: 'Beschreibung übernommen',
      description: 'Die KI-generierte Beschreibung wurde eingefügt',
    });
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generatedDescription);
      toast({
        title: 'In Zwischenablage kopiert',
        description: 'Die Beschreibung wurde kopiert',
      });
    } catch (_error) {
      toast({
        title: 'Kopieren fehlgeschlagen',
        description: 'Beschreibung konnte nicht kopiert werden',
        variant: 'destructive',
      });
    }
  };

  const getCompletionBadge = () => {
    const requiredFields = [
      formData.manufacturer,
      formData.model,
      formData.year,
      formData.mileage,
      formData.condition,
      formData.bodyType,
      formData.sleeping_places,
    ].filter(Boolean);

    const totalRequired = 7;
    const completed = requiredFields.length;
    const percentage = Math.round((completed / totalRequired) * 100);

    if (percentage >= 100) {
      return <Badge className="bg-green-100 text-green-800">Bereit für KI-Generierung</Badge>;
    } else if (percentage >= 70) {
      return <Badge className="bg-yellow-100 text-yellow-800">{percentage}% vollständig</Badge>;
    } else {
      return <Badge className="bg-red-100 text-red-800">Mehr Daten benötigt ({percentage}%)</Badge>;
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* AI Generator Card */}
      <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-blue-50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold">KI-Beschreibung generieren</h3>
                <p className="text-sm text-muted-foreground">
                  Automatische Beschreibung basierend auf Ihren Eingaben
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {getCompletionBadge()}
              <Button
                onClick={generateDescription}
                disabled={isGenerating || !canGenerate}
                variant={canGenerate ? "default" : "outline"}
                size="sm"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generiert...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4 mr-2" />
                    Generieren
                  </>
                )}
              </Button>
            </div>
          </div>
          
          {!canGenerate && (
            <div className="mt-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <p className="font-medium">Mehr Informationen benötigt</p>
                  <p>Füllen Sie mindestens die Grunddaten aus, um eine KI-Beschreibung zu generieren.</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Generated Description Preview */}
      {showPreview && generatedDescription && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-green-800 flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                KI-generierte Beschreibung
              </h3>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyToClipboard}
                >
                  <Copy className="h-4 w-4 mr-1" />
                  Kopieren
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={generateDescription}
                  disabled={isGenerating}
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Neu generieren
                </Button>
              </div>
            </div>
            
            <div className="bg-card dark:bg-card p-4 rounded-lg border mb-4">
              <Textarea
                value={generatedDescription}
                onChange={(e) => setGeneratedDescription(e.target.value)}
                rows={8}
                className="border-0 resize-none focus:ring-0"
                placeholder="Generierte Beschreibung erscheint hier..."
              />
            </div>
            
            <div className="flex justify-between items-center">
              <p className="text-sm text-green-700">
                Sie können die Beschreibung vor der Übernahme noch anpassen
              </p>
              
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowPreview(false)}>
                  Verwerfen
                </Button>
                <Button onClick={useGeneratedDescription} className="bg-green-600 hover:bg-green-700">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Übernehmen
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tips for better AI generation */}
      {canGenerate && !showPreview && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-2">
              <Sparkles className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800">
                <h4 className="font-medium mb-1">Tipps für bessere KI-Beschreibungen</h4>
                <ul className="space-y-1">
                  <li>• Füllen Sie möglichst viele Fahrzeugdetails aus</li>
                  <li>• Geben Sie Zusatzausstattung an</li>
                  <li>• Die KI berücksichtigt alle eingegebenen Informationen</li>
                  <li>• Sie können die Beschreibung nach der Generierung anpassen</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AIDescriptionGenerator;
