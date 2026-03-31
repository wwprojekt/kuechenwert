/**
 * SEPA Mandate Component
 * Handles SEPA direct debit authorization for dealers
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { CreditCard, Shield, AlertCircle, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const sepaSchema = z.object({
  debtor_name: z.string().trim().min(2, 'Bitte geben Sie den Namen des Kontoinhabers ein'),
  debtor_address: z.string().trim().min(5, 'Bitte geben Sie die Adresse des Kontoinhabers ein'),
  iban: z.string().regex(/^DE\d{20}$/, 'Bitte geben Sie eine gültige deutsche IBAN ein'),
  accepted_terms: z.literal(true, { errorMap: () => ({ message: 'Sie müssen den SEPA-Lastschriftbedingungen zustimmen' }) }),
});

interface SepaMandateProps {
  dealerApplicationId: string;
  onMandateComplete?: (mandateId: string) => void;
  existingMandate?: any;
}

interface SepaMandateForm {
  debtor_name: string;
  debtor_address: string;
  iban: string;
  bic: string;
  bank_name: string;
  accepted_terms: boolean;
}

export const SepaMandate = ({ 
  dealerApplicationId, 
  onMandateComplete,
  existingMandate 
}: SepaMandateProps) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState<SepaMandateForm>({
    debtor_name: existingMandate?.debtor_name || '',
    debtor_address: existingMandate?.debtor_address || '',
    iban: existingMandate?.iban || '',
    bic: existingMandate?.bic || '',
    bank_name: existingMandate?.bank_name || '',
    accepted_terms: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mandateText, setMandateText] = useState('');

  // Fetch SEPA mandate template
  useEffect(() => {
    const fetchMandateText = async () => {
      try {
        const { data } = await supabase
          .from('sepa_mandate_templates')
          .select('template_text')
          .eq('is_active', true)
          .single();
        
        if (data) {
          setMandateText(data.template_text);
        }
      } catch (error) {
        logger.error('Error fetching SEPA mandate text:', error);
      }
    };
    fetchMandateText();
  }, []);

  const validateIBAN = (iban: string): boolean => {
    // Basic IBAN validation for German IBANs
    const cleanIban = iban.replace(/\s/g, '');
    return /^DE\d{20}$/.test(cleanIban);
  };

  const formatIBAN = (value: string): string => {
    const cleaned = value.replace(/\s/g, '').toUpperCase();
    return cleaned.replace(/(.{4})/g, '$1 ').trim();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      sepaSchema.parse({
        debtor_name: formData.debtor_name,
        debtor_address: formData.debtor_address,
        iban: formData.iban.replace(/\s/g, ''),
        accepted_terms: formData.accepted_terms,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: 'Bitte prüfen Sie Ihre Eingaben',
          description: error.errors[0].message,
          variant: 'destructive',
        });
      }
      return;
    }

    setIsSubmitting(true);

    try {
      // Generate mandate reference
      const { data: mandateRef, error: refError } = await supabase
        .rpc('generate_sepa_reference');

      if (refError) throw refError;

      // Create SEPA mandate
      const { data: mandate, error: mandateError } = await supabase
        .from('sepa_mandates')
        .insert({
          dealer_application_id: dealerApplicationId,
          mandate_reference: mandateRef,
          debtor_name: formData.debtor_name,
          debtor_address: formData.debtor_address,
          iban: formData.iban.replace(/\s/g, ''),
          bic: formData.bic,
          bank_name: formData.bank_name,
          mandate_text: mandateText,
          signed_at: new Date().toISOString(),
          status: 'active',
          ip_address: '', // Would get from request in real implementation
          user_agent: navigator.userAgent,
        })
        .select()
        .single();

      if (mandateError) throw mandateError;

      // Update dealer application
      await supabase
        .from('dealer_applications')
        .update({
          sepa_mandate_signed: true,
          sepa_mandate_date: new Date().toISOString(),
          sepa_mandate_reference: mandateRef,
        })
        .eq('id', dealerApplicationId);

      toast({
        title: 'SEPA-Lastschriftmandat erteilt',
        description: `Mandatsreferenz: ${mandateRef}`,
      });

      onMandateComplete?.(mandate.id);

    } catch (error) {
      logger.error('Error creating SEPA mandate:', error);
      toast({
        title: 'Fehler',
        description: 'SEPA-Lastschriftmandat konnte nicht erstellt werden',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (existingMandate?.status === 'active') {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-800">
            <CheckCircle className="h-5 w-5" />
            SEPA-Lastschriftmandat erteilt
          </CardTitle>
          <CardDescription className="text-green-700">
            Ihr Lastschriftmandat ist aktiv und gültig
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-green-700">Mandatsreferenz:</span>
              <span className="font-mono text-sm">{existingMandate.mandate_reference}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-green-700">Erteilt am:</span>
              <span className="text-sm">{new Date(existingMandate.signed_at).toLocaleDateString('de-DE')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-green-700">IBAN:</span>
              <span className="font-mono text-sm">{formatIBAN(existingMandate.iban)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          SEPA-Lastschriftmandat
        </CardTitle>
        <CardDescription>
          Ermächtigung zum Einzug von Provisionen per SEPA-Lastschrift
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Account Holder Information */}
          <div className="space-y-4">
            <h3 className="font-semibold">Kontoinhaber-Informationen</h3>
            
            <div className="space-y-2">
              <Label htmlFor="debtor_name">Kontoinhaber (Name/Firma) *</Label>
              <Input
                id="debtor_name"
                value={formData.debtor_name}
                onChange={(e) => setFormData({ ...formData, debtor_name: e.target.value })}
                placeholder="Firmenname oder Vor- und Nachname"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="debtor_address">Adresse des Kontoinhabers *</Label>
              <Textarea
                id="debtor_address"
                value={formData.debtor_address}
                onChange={(e) => setFormData({ ...formData, debtor_address: e.target.value })}
                placeholder="Straße, Hausnummer, PLZ, Ort"
                rows={3}
              />
            </div>
          </div>

          {/* Bank Details */}
          <div className="space-y-4">
            <h3 className="font-semibold">Bankverbindung</h3>
            
            <div className="space-y-2">
              <Label htmlFor="iban">IBAN *</Label>
              <Input
                id="iban"
                value={formData.iban}
                onChange={(e) => setFormData({ ...formData, iban: formatIBAN(e.target.value) })}
                placeholder="DE89 3704 0044 0532 0130 00"
                maxLength={34}
              />
              {formData.iban && !validateIBAN(formData.iban) && (
                <div className="text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  Ungültige IBAN
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bic">BIC (optional)</Label>
                <Input
                  id="bic"
                  value={formData.bic}
                  onChange={(e) => setFormData({ ...formData, bic: e.target.value.toUpperCase() })}
                  placeholder="COBADEFFXXX"
                  maxLength={11}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="bank_name">Bankname (optional)</Label>
                <Input
                  id="bank_name"
                  value={formData.bank_name}
                  onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                  placeholder="z.B. Commerzbank AG"
                />
              </div>
            </div>
          </div>

          {/* SEPA Mandate Text */}
          <div className="space-y-4">
            <h3 className="font-semibold">Lastschriftmandat</h3>
            
            <div className="p-4 bg-muted rounded-lg">
              <div className="text-sm leading-relaxed">
                {mandateText || 'Lade Mandatstext...'}
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <Checkbox
                id="accepted_terms"
                checked={formData.accepted_terms}
                onCheckedChange={(checked) => setFormData({ ...formData, accepted_terms: checked as boolean })}
              />
              <div className="flex-1">
                <Label htmlFor="accepted_terms" className="cursor-pointer">
                  Ich erteile das SEPA-Lastschriftmandat *
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Mit der Erteilung des Mandats ermächtigen Sie uns, fällige Provisionen automatisch von Ihrem Konto einzuziehen.
                </p>
              </div>
            </div>
          </div>

          {/* Security Information */}
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-blue-800">Ihre Sicherheit</h4>
                <ul className="text-sm text-blue-700 mt-2 space-y-1">
                  <li>• Sie können Lastschriften innerhalb von 8 Wochen widerrufen</li>
                  <li>• Ihre Bankdaten werden verschlüsselt gespeichert</li>
                  <li>• Einzüge erfolgen nur bei fälligen Provisionen</li>
                  <li>• Sie erhalten vorab eine E-Mail-Benachrichtigung</li>
                </ul>
              </div>
            </div>
          </div>

          <Button 
            type="submit" 
            className="w-full" 
            disabled={isSubmitting || !formData.accepted_terms || !validateIBAN(formData.iban)}
          >
            {isSubmitting ? 'Erstelle Mandat...' : 'SEPA-Lastschriftmandat erteilen'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default SepaMandate;
