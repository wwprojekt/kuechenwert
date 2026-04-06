/**
 * Dealer Onboarding Page
 * Streamlined dealer registration that creates dealer accounts directly.
 * 4-Step Wizard: Account → Company → Legal → Documents
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
import { trackUserRegistered, setEnhancedConversionData } from '@/lib/gadsConversionService';
import { Building2, User, Shield, CheckCircle, ShieldCheck } from 'lucide-react';
import PageLayout from '@/components/PageLayout';
import { LegalDocumentUpload } from '@/components/LegalDocumentUpload';
import { useSettings } from '@/contexts/SettingsContext';
import { passwordSchema, emailSchema } from '@/lib/validation';
import { EU_COUNTRIES, getLegalFormsByCountry, DEFAULT_COUNTRY } from '@/lib/euCountries';

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
  country: string;
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
    country: DEFAULT_COUNTRY,
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

  const handleCountryChange = (newCountry: string) => {
    const newLegalForms = getLegalFormsByCountry(newCountry);
    const currentFormStillValid = newLegalForms.some(f => f.value === formData.legal_form);
    updateFormData({
      country: newCountry,
      legal_form: currentFormStillValid ? formData.legal_form : '',
    });
  };

  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1: { // Account setup
        const errors: string[] = [];
        
        if (!formData.email || !formData.password || !formData.confirmPassword || !formData.first_name || !formData.last_name || !formData.phone) {
          return false;
        }

        const emailResult = emailSchema.safeParse(formData.email);
        if (!emailResult.success) {
          errors.push(emailResult.error.errors[0]?.message || 'Ungültige E-Mail');
        }

        const passwordResult = passwordSchema.safeParse(formData.password);
        if (!passwordResult.success) {
          errors.push(passwordResult.error.errors[0]?.message || 'Ungültiges Passwort');
        }

        if (formData.password !== formData.confirmPassword) {
          errors.push('Passwörter stimmen nicht überein');
        }

        setValidationErrors(errors);
        return errors.length === 0;
      }
      case 2: // Company info
        return !!(
          formData.company_name &&
          formData.company_address &&
          formData.company_postal_code &&
          formData.company_city &&
          formData.country &&
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
      setValidationErrors([]);
      setCurrentStep(prev => Math.min(prev + 1, totalSteps));
    } else {
      toast({
        title: 'Unvollständige Angaben',
        description: validationErrors.length > 0 
          ? validationErrors[0] 
          : 'Bitte füllen Sie alle erforderlichen Felder aus',
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
            country: formData.country,
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
      // Fetch the created application to get its ID (with retry for trigger delay)
      let fetchedApplicationId: string | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const { data: applicationData, error: applicationError } = await supabase
          .from('dealer_applications')
          .select('id')
          .eq('user_id', authData.user.id)
          .single();

        if (applicationData?.id) {
          fetchedApplicationId = applicationData.id;
          break;
        }

        if (attempt < 2) {
          logger.warn(`Dealer application not yet available (attempt ${attempt + 1}/3), retrying in 1s...`, applicationError);
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          logger.warn('Could not fetch dealer application after 3 attempts (may need email confirmation first):', applicationError);
        }
      }

      setDealerApplicationId(fetchedApplicationId);
      setCurrentStep(4); // Move to document upload step

      // Google Ads: Enhanced Conversions + Händler-Onboarding Konto erstellt
      await setEnhancedConversionData({ email: formData.email, firstName: formData.first_name, lastName: formData.last_name, phone: formData.phone });
      trackUserRegistered('dealer_onboarding');

      toast({
        title: 'Konto erstellt!',
        description: 'Ihr Händlerkonto wurde erstellt. Laden Sie nun Ihre Dokumente hoch.',
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

  const totalSteps = 4;

  const steps = [
    { id: 1, title: 'Konto erstellen', description: 'Persönliche Daten' },
    { id: 2, title: 'Unternehmen', description: 'Firmendaten' },
    { id: 3, title: 'Bestätigung', description: 'Nutzungsbedingungen' },
    { id: 4, title: 'Dokumente', description: 'Nachweise hochladen' },
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
                  <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Händler-Registrierung</h1>
                  <p className="text-muted-foreground">
                    Werden Sie Teil unseres Händlernetzwerks
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-primary">
                    {currentStep}/{totalSteps}
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
                  style={{ width: `${(currentStep / totalSteps) * 100}%` }}
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
                {currentStep === 4 && <CheckCircle className="h-5 w-5" />}
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
                <CompanyInfoStep 
                  formData={formData} 
                  updateFormData={updateFormData}
                  onCountryChange={handleCountryChange}
                />
              )}
              
              {currentStep === 3 && (
                <LegalAcceptanceStep formData={formData} updateFormData={updateFormData} />
              )}
              
              {currentStep === 4 && dealerApplicationId && (
                <DocumentUploadStep dealerApplicationId={dealerApplicationId} />
              )}

              {/* Fallback: Show message when dealerApplicationId is missing on Step 4 */}
              {currentStep === 4 && !dealerApplicationId && (
                <div className="text-center py-8 space-y-4">
                  <div className="text-amber-600 text-lg font-semibold">
                    Bitte bestätigen Sie zuerst Ihre E-Mail-Adresse
                  </div>
                  <p className="text-muted-foreground">
                    Wir haben Ihnen eine Bestätigungs-E-Mail gesendet. Bitte klicken Sie auf den Link in der E-Mail und laden Sie diese Seite anschließend neu.
                  </p>
                  <Button
                    variant="outline"
                    onClick={async () => {
                      try {
                        const { data: { user } } = await supabase.auth.getUser();
                        if (user) {
                          const { data: appData } = await supabase
                            .from('dealer_applications')
                            .select('id')
                            .eq('user_id', user.id)
                            .single();
                          if (appData?.id) {
                            setDealerApplicationId(appData.id);
                            toast({ title: 'Erfolgreich!', description: 'Ihre Bewerbung wurde gefunden. Sie können fortfahren.' });
                          } else {
                            toast({ title: 'Noch nicht verfügbar', description: 'Bitte bestätigen Sie zuerst Ihre E-Mail-Adresse.', variant: 'destructive' });
                          }
                        }
                      } catch (e) {
                        logger.error('Retry fetch dealer application:', e);
                      }
                    }}
                  >
                    Erneut prüfen
                  </Button>
                </div>
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
            
            {currentStep === 4 && dealerApplicationId && (
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
  <div className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-2">
        <Label htmlFor="email">E-Mail-Adresse *</Label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => updateFormData({ email: e.target.value })}
          placeholder="ihre@firma.eu"
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="phone">Telefonnummer *</Label>
        <Input
          id="phone"
          type="tel"
          value={formData.phone}
          onChange={(e) => updateFormData({ phone: e.target.value })}
          placeholder="+43 / +49 / +31 ..."
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="first_name">Vorname *</Label>
        <Input
          id="first_name"
          value={formData.first_name}
          onChange={(e) => updateFormData({ first_name: e.target.value })}
          placeholder="Vorname"
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="last_name">Nachname *</Label>
        <Input
          id="last_name"
          value={formData.last_name}
          onChange={(e) => updateFormData({ last_name: e.target.value })}
          placeholder="Nachname"
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="password">Passwort *</Label>
        <Input
          id="password"
          type="password"
          value={formData.password}
          onChange={(e) => updateFormData({ password: e.target.value })}
          placeholder="Ihr sicheres Passwort"
        />
        {/* Passwort-Anforderungen */}
        <div className="bg-muted/50 rounded-lg p-3 space-y-1.5">
          <p className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground">
            <ShieldCheck className="w-3.5 h-3.5 text-primary" />
            Passwort-Anforderungen
          </p>
          <ul className="text-xs text-muted-foreground space-y-0.5 ml-5">
            <li className={formData.password.length >= 8 ? "text-green-600" : ""}>
              • Mindestens 8 Zeichen
            </li>
            <li className={/[A-Z]/.test(formData.password) ? "text-green-600" : ""}>
              • Mindestens ein Großbuchstabe
            </li>
            <li className={/[a-z]/.test(formData.password) ? "text-green-600" : ""}>
              • Mindestens ein Kleinbuchstabe
            </li>
            <li className={/[0-9]/.test(formData.password) ? "text-green-600" : ""}>
              • Mindestens eine Zahl
            </li>
            <li className={/[^A-Za-z0-9]/.test(formData.password) ? "text-green-600" : ""}>
              • Mindestens ein Sonderzeichen (!@#$%^&* etc.)
            </li>
          </ul>
        </div>
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
  </div>
);

const CompanyInfoStep = ({ formData, updateFormData, onCountryChange }: any) => {
  const availableLegalForms = getLegalFormsByCountry(formData.country);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="company_name">Firmenname *</Label>
          <Input
            id="company_name"
            value={formData.company_name}
            onChange={(e) => updateFormData({ company_name: e.target.value })}
            placeholder="Ihr Autohaus"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="country">Land *</Label>
          <Select
            value={formData.country}
            onValueChange={onCountryChange}
          >
            <SelectTrigger id="country">
              <SelectValue placeholder="Land auswählen" />
            </SelectTrigger>
            <SelectContent>
              {EU_COUNTRIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="legal_form">Rechtsform *</Label>
          <Select
            value={formData.legal_form}
            onValueChange={(value) => updateFormData({ legal_form: value })}
          >
            <SelectTrigger id="legal_form">
              <SelectValue placeholder="Rechtsform auswählen" />
            </SelectTrigger>
            <SelectContent>
              {availableLegalForms.map((form) => (
                <SelectItem key={form.value} value={form.value}>
                  {form.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="website">Website (optional)</Label>
          <Input
            id="website"
            value={formData.website}
            onChange={(e) => updateFormData({ website: e.target.value })}
            placeholder="https://www.ihre-firma.eu"
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="company_address">Firmenadresse *</Label>
          <Input
            id="company_address"
            value={formData.company_address}
            onChange={(e) => updateFormData({ company_address: e.target.value })}
            placeholder="Straße und Hausnummer"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="company_postal_code">Postleitzahl *</Label>
          <Input
            id="company_postal_code"
            value={formData.company_postal_code}
            onChange={(e) => updateFormData({ company_postal_code: e.target.value })}
            placeholder="PLZ"
            maxLength={10}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="company_city">Ort *</Label>
          <Input
            id="company_city"
            value={formData.company_city}
            onChange={(e) => updateFormData({ company_city: e.target.value })}
            placeholder="Ort"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="contact_person_name">Ansprechpartner *</Label>
          <Input
            id="contact_person_name"
            value={formData.contact_person_name}
            onChange={(e) => updateFormData({ contact_person_name: e.target.value })}
            placeholder="Vor- und Nachname"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="contact_person_position">Position (optional)</Label>
          <Input
            id="contact_person_position"
            value={formData.contact_person_position}
            onChange={(e) => updateFormData({ contact_person_position: e.target.value })}
            placeholder="z.B. Geschäftsführer"
          />
        </div>
      </div>
    </div>
  );
};

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
            Ich akzeptiere die{' '}
            <a href="/agb" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              Nutzungsbedingungen
            </a>{' '}*
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
            Ich akzeptiere die{' '}
            <a href="/datenschutz" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              Datenschutzerklärung
            </a>{' '}*
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
