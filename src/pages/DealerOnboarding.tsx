/**
 * Dealer Onboarding Page
 * Streamlined dealer registration that creates dealer accounts directly
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { Building2, User, FileText, Shield, CheckCircle } from 'lucide-react';
import PageLayout from '@/components/PageLayout';
import { SepaMandate } from '@/components/SepaMandate';
import { LegalDocumentUpload } from '@/components/LegalDocumentUpload';
import { useSettings } from '@/contexts/SettingsContext';

interface DealerRegistrationForm {
  // Auth data
  email: string;
  password: string;
  confirmPassword: string;
  
  // Personal data
  first_name: string;
  last_name: string;
  phone: string;
  
  // Company data
  company_name: string;
  company_address: string;
  company_postal_code: string;
  company_city: string;
  legal_form: string;
  hrb_number: string;
  
  // Contact person
  contact_person_name: string;
  contact_person_position: string;
  
  // Optional
  website: string;
  
  // Legal
  accept_terms: boolean;
  accept_privacy: boolean;
}

const legalForms = [
  'Einzelunternehmen',
  'GmbH',
  'UG',
  'GbR',
  'KG',
  'OHG',
  'AG',
  'GmbH & Co. KG',
];

export default function DealerOnboarding() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { settings } = useSettings();
  const siteName = settings?.site_name || 'CaravanWert';
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dealerApplicationId, setDealerApplicationId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<DealerRegistrationForm>({
    email: '',
    password: '',
    confirmPassword: '',
    first_name: '',
    last_name: '',
    phone: '',
    company_name: '',
    company_address: '',
    company_postal_code: '',
    company_city: '',
    legal_form: '',

    hrb_number: '',
    contact_person_name: '',
    contact_person_position: '',
    website: '',

    accept_terms: false,
    accept_privacy: false,
  });

  const updateFormData = (updates: Partial<DealerRegistrationForm>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1: // Account setup
        return !!(
          formData.email &&
          formData.password &&
          formData.password === formData.confirmPassword &&
          formData.first_name &&
          formData.last_name &&
          formData.phone
        );
      case 2: // Company info
        return !!(
          formData.company_name &&
          formData.company_address &&
          formData.company_postal_code &&
          formData.company_city &&
          formData.legal_form &&
          formData.contact_person_name
        );
      case 3: // Legal acceptance
        return formData.accept_terms && formData.accept_privacy;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 5));
    } else {
      toast({
        title: 'Unvollständige Angaben',
        description: 'Bitte füllen Sie alle erforderlichen Felder aus',
        variant: 'destructive',
      });
    }
  };

  const handlePrevious = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    if (!validateStep(3)) {
      toast({
        title: 'Unvollständige Angaben',
        description: 'Bitte akzeptieren Sie die Nutzungsbedingungen',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Create auth user account
      // All dealer data is passed as user_metadata so the handle_new_user
      // database trigger can create the dealer_application automatically
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            first_name: formData.first_name,
            last_name: formData.last_name,
            phone: formData.phone,
            company_name: formData.company_name,
            company_address: formData.company_address,
            company_postal_code: formData.company_postal_code,
            company_city: formData.company_city,
            contact_person_name: formData.contact_person_name,
            contact_person_position: formData.contact_person_position || null,
            website: formData.website || null,
            legal_form: formData.legal_form || null,
            user_type: 'dealer',
          },
        },
      });

      if (authError) throw authError;

      if (!authData.user) {
        throw new Error('User creation failed');
      }

      // The dealer_application is created by the handle_new_user database trigger
      // (runs with SECURITY DEFINER, bypassing RLS)
      // Fetch the created application to get its ID
      const { data: applicationData, error: applicationError } = await supabase
        .from('dealer_applications')
        .select('id')
        .eq('user_id', authData.user.id)
        .single();

      if (applicationError) {
        logger.warn('Could not fetch dealer application (may need email confirmation first):', applicationError);
      }

      setDealerApplicationId(applicationData?.id || null);
      setCurrentStep(4); // Move to SEPA mandate step

      toast({
        title: 'Konto erstellt!',
        description: 'Ihr Händlerkonto wurde erstellt. Vervollständigen Sie nun die Registrierung.',
      });

    } catch (error: any) {
      logger.error('Dealer registration error:', error);
      toast({
        title: 'Registrierung fehlgeschlagen',
        description: error.message || 'Ein Fehler ist aufgetreten',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleComplete = () => {
    toast({
      title: 'Registrierung abgeschlossen!',
      description: 'Ihr Antrag wird geprüft. Sie erhalten eine E-Mail sobald Ihr Konto freigeschaltet wird.',
    });
    navigate('/');
  };

  const steps = [
    { id: 1, title: 'Konto erstellen', description: 'Persönliche Daten' },
    { id: 2, title: 'Unternehmen', description: 'Firmendaten' },
    { id: 3, title: 'Bestätigung', description: 'Nutzungsbedingungen' },
    { id: 4, title: 'SEPA-Mandat', description: 'Zahlungsautorisation' },
    { id: 5, title: 'Dokumente', description: 'Nachweise hochladen' },
  ];

  return (
    <PageLayout
      title={`Händler-Registrierung - ${siteName}`}
      description={`Registrieren Sie sich als Händler bei ${siteName}`}
      canonicalPath="/dealer-onboarding"
      noIndex={true}
    >
      <div className="min-h-screen py-12 relative overflow-hidden">
        {/* Consistent gradient background */}
        <div className="absolute inset-0 bg-gradient-to-b from-cyan-50/80 via-sky-50/40 to-white" />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent" />
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-cyan-100/30 to-transparent" />
        <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)', backgroundSize: '32px 32px' }} />
        
        <div className="container max-w-4xl mx-auto px-4 relative z-10">
          {/* Progress Header */}
          <Card className="mb-8">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h1 className="text-3xl font-bold">Händler-Registrierung</h1>
                  <p className="text-muted-foreground">
                    Werden Sie Teil unseres Händlernetzwerks
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-primary">
                    {currentStep}/5
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {steps[currentStep - 1]?.title}
                  </div>
                </div>
              </div>
              
              {/* Progress Bar */}
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all duration-500"
                  style={{ width: `${(currentStep / 5) * 100}%` }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Step Content */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {currentStep === 1 && <User className="h-5 w-5" />}
                {currentStep === 2 && <Building2 className="h-5 w-5" />}
                {currentStep === 3 && <Shield className="h-5 w-5" />}
                {currentStep === 4 && <FileText className="h-5 w-5" />}
                {currentStep === 5 && <CheckCircle className="h-5 w-5" />}
                {steps[currentStep - 1]?.title}
              </CardTitle>
              <CardDescription>
                {steps[currentStep - 1]?.description}
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {currentStep === 1 && (
                <AccountSetupStep formData={formData} updateFormData={updateFormData} />
              )}
              
              {currentStep === 2 && (
                <CompanyInfoStep formData={formData} updateFormData={updateFormData} />
              )}
              
              {currentStep === 3 && (
                <LegalAcceptanceStep formData={formData} updateFormData={updateFormData} />
              )}
              
              {currentStep === 4 && dealerApplicationId && (
                <SepaMandate 
                  dealerApplicationId={dealerApplicationId}
                  onMandateComplete={() => setCurrentStep(5)}
                />
              )}
              
              {currentStep === 5 && dealerApplicationId && (
                <DocumentUploadStep dealerApplicationId={dealerApplicationId} />
              )}
            </CardContent>

            {/* Navigation */}
            {currentStep < 4 && (
              <div className="flex justify-between p-6 border-t">
                <Button
                  variant="outline"
                  onClick={handlePrevious}
                  disabled={currentStep === 1}
                >
                  Zurück
                </Button>
                
                <Button
                  onClick={currentStep === 3 ? handleSubmit : handleNext}
                  disabled={!validateStep(currentStep) || isSubmitting}
                >
                  {currentStep === 3 ? 
                    (isSubmitting ? 'Erstelle Konto...' : 'Konto erstellen') : 
                    'Weiter'
                  }
                </Button>
              </div>
            )}
            
            {currentStep === 5 && (
              <div className="flex justify-end p-6 border-t">
                <Button onClick={handleComplete}>
                  Registrierung abschließen
                </Button>
              </div>
            )}
          </Card>
        </div>
      </div>
    </PageLayout>
  );
}

// Step Components
const AccountSetupStep = ({ formData, updateFormData }: any) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
    <div className="space-y-2">
      <Label htmlFor="email">E-Mail-Adresse *</Label>
      <Input
        id="email"
        type="email"
        value={formData.email}
        onChange={(e) => updateFormData({ email: e.target.value })}
        placeholder="ihre@email.de"
      />
    </div>
    
    <div className="space-y-2">
      <Label htmlFor="phone">Telefonnummer *</Label>
      <Input
        id="phone"
        type="tel"
        value={formData.phone}
        onChange={(e) => updateFormData({ phone: e.target.value })}
        placeholder="+49 123 456789"
      />
    </div>
    
    <div className="space-y-2">
      <Label htmlFor="first_name">Vorname *</Label>
      <Input
        id="first_name"
        value={formData.first_name}
        onChange={(e) => updateFormData({ first_name: e.target.value })}
        placeholder="Max"
      />
    </div>
    
    <div className="space-y-2">
      <Label htmlFor="last_name">Nachname *</Label>
      <Input
        id="last_name"
        value={formData.last_name}
        onChange={(e) => updateFormData({ last_name: e.target.value })}
        placeholder="Mustermann"
      />
    </div>
    
    <div className="space-y-2">
      <Label htmlFor="password">Passwort *</Label>
      <Input
        id="password"
        type="password"
        value={formData.password}
        onChange={(e) => updateFormData({ password: e.target.value })}
        placeholder="Mindestens 8 Zeichen"
      />
    </div>
    
    <div className="space-y-2">
      <Label htmlFor="confirmPassword">Passwort bestätigen *</Label>
      <Input
        id="confirmPassword"
        type="password"
        value={formData.confirmPassword}
        onChange={(e) => updateFormData({ confirmPassword: e.target.value })}
        placeholder="Passwort wiederholen"
      />
    </div>
  </div>
);

const CompanyInfoStep = ({ formData, updateFormData }: any) => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-2">
        <Label htmlFor="company_name">Firmenname *</Label>
        <Input
          id="company_name"
          value={formData.company_name}
          onChange={(e) => updateFormData({ company_name: e.target.value })}
          placeholder="Mustermann Automobile GmbH"
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="legal_form">Rechtsform *</Label>
        <Select
          value={formData.legal_form}
          onValueChange={(value) => updateFormData({ legal_form: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Rechtsform auswählen" />
          </SelectTrigger>
          <SelectContent>
            {legalForms.map((form) => (
              <SelectItem key={form} value={form}>
                {form}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="company_address">Firmenadresse *</Label>
        <Input
          id="company_address"
          value={formData.company_address}
          onChange={(e) => updateFormData({ company_address: e.target.value })}
          placeholder="Musterstraße 123"
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="company_postal_code">PLZ *</Label>
        <Input
          id="company_postal_code"
          value={formData.company_postal_code}
          onChange={(e) => updateFormData({ company_postal_code: e.target.value })}
          placeholder="12345"
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="company_city">Ort *</Label>
        <Input
          id="company_city"
          value={formData.company_city}
          onChange={(e) => updateFormData({ company_city: e.target.value })}
          placeholder="Berlin"
        />
      </div>
      
      
      <div className="space-y-2">
        <Label htmlFor="contact_person_name">Ansprechpartner *</Label>
        <Input
          id="contact_person_name"
          value={formData.contact_person_name}
          onChange={(e) => updateFormData({ contact_person_name: e.target.value })}
          placeholder="Max Mustermann"
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="contact_person_position">Position (optional)</Label>
        <Input
          id="contact_person_position"
          value={formData.contact_person_position}
          onChange={(e) => updateFormData({ contact_person_position: e.target.value })}
          placeholder="Geschäftsführer"
        />
      </div>
    </div>
  </div>
);

const LegalAcceptanceStep = ({ formData, updateFormData }: any) => (
  <div className="space-y-6">
    <div className="space-y-4">
      <div className="flex items-start space-x-2">
        <Checkbox
          id="accept_terms"
          checked={formData.accept_terms}
          onCheckedChange={(checked) => updateFormData({ accept_terms: checked })}
        />
        <div className="grid gap-1.5 leading-none">
          <Label htmlFor="accept_terms" className="cursor-pointer">
            Ich akzeptiere die Nutzungsbedingungen *
          </Label>
          <p className="text-xs text-muted-foreground">
            Sie müssen den Nutzungsbedingungen zustimmen, um fortzufahren.
          </p>
        </div>
      </div>
      
      <div className="flex items-start space-x-2">
        <Checkbox
          id="accept_privacy"
          checked={formData.accept_privacy}
          onCheckedChange={(checked) => updateFormData({ accept_privacy: checked })}
        />
        <div className="grid gap-1.5 leading-none">
          <Label htmlFor="accept_privacy" className="cursor-pointer">
            Ich akzeptiere die Datenschutzerklärung *
          </Label>
          <p className="text-xs text-muted-foreground">
            Ihre Daten werden gemäß unserer Datenschutzerklärung verarbeitet.
          </p>
        </div>
      </div>
    </div>
    
    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
      <h3 className="font-medium text-blue-800 mb-2">Was passiert als nächstes?</h3>
      <ul className="text-sm text-blue-700 space-y-1">
        <li>• Ihr Händlerkonto wird zur Prüfung eingereicht</li>
        <li>• Sie erhalten eine Bestätigungs-E-Mail</li>
        <li>• Unser Team prüft Ihre Angaben (1-3 Werktage)</li>
        <li>• Nach Genehmigung erhalten Sie Zugang zum Händlerportal</li>
      </ul>
    </div>
  </div>
);

const DocumentUploadStep = ({ dealerApplicationId }: { dealerApplicationId: string }) => (
  <div className="space-y-6">
    <LegalDocumentUpload dealerApplicationId={dealerApplicationId} />
    
    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
      <div className="flex items-center gap-2 mb-2">
        <CheckCircle className="h-5 w-5 text-green-600" />
        <h3 className="font-medium text-green-800">Registrierung fast abgeschlossen!</h3>
      </div>
      <p className="text-sm text-green-700">
        Laden Sie Ihre Geschäftsdokumente hoch, um die Registrierung zu vervollständigen.
        Sie können diesen Schritt auch später nachholen.
      </p>
    </div>
  </div>
);
