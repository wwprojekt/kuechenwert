/**
 * SaleChannelStep - Step 7 des Wizards
 * 
 * Enthält: Verkaufsweg-Auswahl, Mindestpreis, Kontaktdaten (Name, E-Mail, Telefon), Anmerkungen.
 * Name und E-Mail werden bereits in Step 5 (QuickContactStep) erfasst und hier vorausgefüllt.
 */

import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card } from "@/components/ui/card";
import type { WizardFormData } from "@/hooks/useWizardForm";
import { Mail, Phone, User as UserIcon, Gavel, Zap, MapPin, Star, Users, TrendingUp, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SaleChannelStepProps {
  formData: WizardFormData;
  updateFormData: (updates: Partial<WizardFormData>) => void;
  fieldErrors?: Record<string, string>;
}

export const SaleChannelStep = ({ formData, updateFormData, fieldErrors = {} }: SaleChannelStepProps) => {
  // Pre-select recommended option to reduce friction (user can change)
  useEffect(() => {
    if (!formData.saleChannel) {
      updateFormData({ saleChannel: "auction" });
    }
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="mb-6">
        <h2 className="text-xl md:text-2xl font-bold text-foreground mb-2 flex items-center gap-2">
          <Mail className="w-5 h-5 md:w-6 md:h-6 text-primary" />
          Verkaufsweg wählen
        </h2>
        <p className="text-muted-foreground">
          Wählen Sie Ihren Verkaufsweg und vervollständigen Sie Ihre Kontaktdaten
        </p>
      </div>

      {/* FOMO-Banner */}
      <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-green-600">
            <Users className="w-5 h-5" />
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-green-800 dark:text-green-200">
              Geprüfte Händler suchen aktuell nach {formData.bodyType || "Wohnmobilen"} wie Ihrem {formData.manufacturer || ""}
            </p>
            <p className="text-xs text-green-700 dark:text-green-300 mt-0.5">
              Durchschnittlich erhalten Verkäufer innerhalb von 24 Stunden ihr erstes Angebot
            </p>
          </div>
        </div>
      </div>

      {/* Verkaufsweg */}
      <div className="space-y-3">
        <Label className={cn("text-base font-semibold", fieldErrors.saleChannel && "text-red-600")}>Wie möchten Sie verkaufen? <span className="text-red-500">*</span></Label>
        <RadioGroup
          value={formData.saleChannel}
          onValueChange={(value) => updateFormData({ saleChannel: value })}
          className="grid grid-cols-1 gap-3"
        >
          {/* Sofortpreis */}
          <Card
            className={`relative p-4 md:p-5 cursor-pointer transition-all duration-300 rounded-xl group ${
              formData.saleChannel === "instant_price"
                ? "border-2 border-primary bg-primary/5 shadow-lg shadow-primary/10 md:scale-[1.01]"
                : "border-2 border-transparent bg-card hover:border-primary/30 hover:shadow-md md:hover:scale-[1.005]"
            }`}
            onClick={() => updateFormData({ saleChannel: "instant_price" })}
          >
            <div className="flex items-center gap-3 md:gap-4">
              <div className={`flex-shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center transition-all duration-300 ${
                formData.saleChannel === "instant_price"
                  ? "bg-yellow-500 text-white shadow-md shadow-yellow-500/30"
                  : "bg-yellow-50 dark:bg-yellow-950/30 text-yellow-500 group-hover:bg-yellow-100 dark:group-hover:bg-yellow-950/50"
              }`}>
                <Zap className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Label htmlFor="instant_price" className="cursor-pointer text-base font-semibold text-foreground">
                    Sofortpreis
                  </Label>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Erhalten Sie sofort ein verbindliches Kaufangebot von geprüften Händlern
                </p>
              </div>
              <RadioGroupItem value="instant_price" id="instant_price" className="flex-shrink-0" onClick={(e) => e.stopPropagation()} />
            </div>
          </Card>

          {/* Händler-Auktion - Empfohlen */}
          <Card
            className={`relative p-4 md:p-5 cursor-pointer transition-all duration-300 rounded-xl group ${
              formData.saleChannel === "auction"
                ? "border-2 border-primary bg-primary/5 shadow-lg shadow-primary/10 md:scale-[1.01]"
                : "border-2 border-primary/20 bg-card hover:border-primary/40 hover:shadow-md md:hover:scale-[1.005]"
            }`}
            onClick={() => updateFormData({ saleChannel: "auction" })}
          >
            <div className="absolute -top-3 right-4">
              <span className="inline-flex items-center gap-1 text-xs font-semibold bg-gradient-to-r from-green-500 to-emerald-600 text-white px-3 py-1 rounded-full shadow-sm">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Empfohlen
              </span>
            </div>
            <div className="flex items-center gap-3 md:gap-4">
              <div className={`flex-shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center transition-all duration-300 ${
                formData.saleChannel === "auction"
                  ? "bg-blue-500 text-white shadow-md shadow-blue-500/30"
                  : "bg-blue-50 dark:bg-blue-950/30 text-blue-500 group-hover:bg-blue-100 dark:group-hover:bg-blue-950/50"
              }`}>
                <Gavel className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Label htmlFor="auction" className="cursor-pointer text-base font-semibold text-foreground">
                    Händler-Auktion
                  </Label>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Mehrere Händler bieten auf Ihr Fahrzeug – oft der höchste Preis
                </p>
              </div>
              <RadioGroupItem value="auction" id="auction" className="flex-shrink-0" onClick={(e) => e.stopPropagation()} />
            </div>
          </Card>

          {/* Ankaufstation */}
          <Card
            className={`relative p-4 md:p-5 cursor-pointer transition-all duration-300 rounded-xl group ${
              formData.saleChannel === "station"
                ? "border-2 border-primary bg-primary/5 shadow-lg shadow-primary/10 md:scale-[1.01]"
                : "border-2 border-transparent bg-card hover:border-primary/30 hover:shadow-md md:hover:scale-[1.005]"
            }`}
            onClick={() => updateFormData({ saleChannel: "station" })}
          >
            <div className="flex items-center gap-3 md:gap-4">
              <div className={`flex-shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center transition-all duration-300 ${
                formData.saleChannel === "station"
                  ? "bg-green-500 text-white shadow-md shadow-green-500/30"
                  : "bg-green-50 dark:bg-green-950/30 text-green-500 group-hover:bg-green-100 dark:group-hover:bg-green-950/50"
              }`}>
                <MapPin className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Label htmlFor="station" className="cursor-pointer text-base font-semibold text-foreground">
                    Ankaufstation
                  </Label>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Persönliche Bewertung vor Ort – Bargeld am selben Tag
                </p>
              </div>
              <RadioGroupItem value="station" id="station" className="flex-shrink-0" onClick={(e) => e.stopPropagation()} />
            </div>
          </Card>
        </RadioGroup>
        {fieldErrors.saleChannel && (
          <p className="text-sm text-red-600 font-medium animate-fade-in">{fieldErrors.saleChannel}</p>
        )}
      </div>

      {/* Preis-Felder je nach Verkaufsweg */}
      {formData.saleChannel === "auction" && (
        <div className="space-y-2 animate-fade-in">
          <Label htmlFor="reservePrice">Mindestpreis (optional)</Label>
            <Input
              id="reservePrice"
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
            placeholder="z.B. 35000"
            value={formData.reservePrice || ""}
            onChange={(e) => updateFormData({ reservePrice: e.target.value ? parseInt(e.target.value) : null })}
            min={0}
          />
          <p className="text-xs text-muted-foreground">
            Unter diesem Preis wird nicht verkauft. Lassen Sie das Feld leer für maximale Reichweite.
          </p>
        </div>
      )}

      {/* Telefonnummer */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold">Kontaktdaten vervollständigen</h3>

        {/* Anzeige der bereits erfassten Daten */}
        {(formData.customerName || formData.customerEmail) && (
          <div className="bg-muted/50 rounded-lg p-3 flex items-start gap-3">
            <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-muted-foreground">
              <p>
                {formData.customerName && <span className="font-medium text-foreground">{formData.customerName}</span>}
                {formData.customerName && formData.customerEmail && " · "}
                {formData.customerEmail && <span>{formData.customerEmail}</span>}
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Name - vorausgefüllt aus Step 5, aber editierbar */}
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="customerName" className={cn("flex items-center gap-2", fieldErrors.customerName && "text-red-600")}>
              <UserIcon className="w-4 h-4" />
              Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="customerName"
              type="text"
              placeholder="Vor- und Nachname"
              value={formData.customerName || ""}
              onChange={(e) => updateFormData({ customerName: e.target.value })}
              autoComplete="name"
              className={cn(fieldErrors.customerName && "border-red-500 ring-red-500/20 ring-2")}
            />
            {fieldErrors.customerName && (
              <p className="text-sm text-red-600 animate-fade-in">{fieldErrors.customerName}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="customerEmail" className={cn("flex items-center gap-2", fieldErrors.customerEmail && "text-red-600")}>
              <Mail className="w-4 h-4" />
              E-Mail <span className="text-red-500">*</span>
            </Label>
            <Input
              id="customerEmail"
              type="email"
              placeholder="ihre@email.de"
              value={formData.customerEmail || ""}
              onChange={(e) => updateFormData({ customerEmail: e.target.value })}
              autoComplete="email"
              className={cn(fieldErrors.customerEmail && "border-red-500 ring-red-500/20 ring-2")}
            />
            {fieldErrors.customerEmail && (
              <p className="text-sm text-red-600 animate-fade-in">{fieldErrors.customerEmail}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="customerPhone" className={cn("flex items-center gap-2", fieldErrors.customerPhone && "text-red-600")}>
              <Phone className="w-4 h-4" />
              Telefon <span className="text-red-500">*</span>
            </Label>
            <Input
              id="customerPhone"
              type="tel"
              placeholder="+49 123 456789"
              value={formData.customerPhone || ""}
              onChange={(e) => updateFormData({ customerPhone: e.target.value })}
              autoComplete="tel"
              className={cn(fieldErrors.customerPhone && "border-red-500 ring-red-500/20 ring-2")}
            />
            {fieldErrors.customerPhone && (
              <p className="text-sm text-red-600 animate-fade-in">{fieldErrors.customerPhone}</p>
            )}
          </div>
        </div>
      </div>

      {/* Beschreibung */}
      <div className="space-y-2 border-t pt-4">
        <Label htmlFor="description">
          Anmerkungen zum Fahrzeug <span className="text-muted-foreground text-xs">(optional)</span>
        </Label>
        <Textarea
          id="description"
          placeholder="Besondere Merkmale, Wartungshistorie, Zusatzausstattung..."
          value={formData.description}
          onChange={(e) => updateFormData({ description: e.target.value })}
          rows={3}
          className="resize-none"
        />
      </div>
    </div>
  );
};

export type { SaleChannelStepProps };
