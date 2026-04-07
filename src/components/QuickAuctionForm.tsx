/**
 * Quick Auction Form Component
 * Simplified hero entry: Just vehicle type tiles + CTA → direct to wizard
 * Optimized for minimum friction and maximum conversion
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowRight, CheckCircle, Users, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TeilintegriertIcon, WohnwagenIcon } from '@/components/wizard/VehicleIcons';

interface QuickAuctionFormProps {
  className?: string;
  variant?: 'hero' | 'compact';
}

export const QuickAuctionForm = ({ className = '', variant = 'hero' }: QuickAuctionFormProps) => {
  const [vehicleType, setVehicleType] = useState<'wohnmobil' | 'wohnwagen' | ''>('');
  const navigate = useNavigate();

  const handleStart = () => {
    const params = new URLSearchParams();
    if (vehicleType) {
      params.set('vehicleType', vehicleType);
    }
    navigate(`/verkaufen/wizard${params.toString() ? '?' + params.toString() : ''}`);
  };

  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Button onClick={() => navigate('/verkaufen/wizard?vehicleType=wohnmobil')} size="sm" variant="outline">
          Wohnmobil verkaufen
        </Button>
        <Button onClick={() => navigate('/verkaufen/wizard?vehicleType=wohnwagen')} size="sm" variant="outline">
          Wohnwagen verkaufen
        </Button>
      </div>
    );
  }

  const vehicleTypes = [
    {
      id: 'wohnmobil' as const,
      label: 'Wohnmobil',
      description: 'Integriert, Teilintegriert, Kastenwagen, Alkoven',
      icon: TeilintegriertIcon,
    },
    {
      id: 'wohnwagen' as const,
      label: 'Wohnwagen',
      description: 'Caravan, Faltcaravan, Mobilheim',
      icon: WohnwagenIcon,
    },
  ];

  return (
    <Card className={`p-6 lg:p-8 bg-card/90 dark:bg-card/90 backdrop-blur-md shadow-2xl border-0 rounded-2xl ${className}`}>
      <div className="space-y-5">
        {/* Header */}
        <div className="pb-1">
          <h3 className="font-bold text-xl lg:text-2xl text-foreground">Jetzt verkaufen</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Kostenloses Angebot in nur 2 Minuten
          </p>
        </div>

        {/* Social Proof Banner */}
        <div className="flex items-center gap-2 bg-primary/5 border border-primary/15 rounded-xl px-4 py-2.5">
          <div className="flex -space-x-2">
            <div className="w-7 h-7 rounded-full bg-primary/20 border-2 border-white flex items-center justify-center">
              <Users className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="w-7 h-7 rounded-full bg-emerald-100 border-2 border-white flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
            </div>
          </div>
          <p className="text-xs text-foreground">
            <span className="font-bold text-primary">Geprüfte Händler</span> suchen aktuell in Ihrer Region
          </p>
        </div>

        {/* Vehicle Type Selection - 2 large tiles */}
        <div className="space-y-2.5">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
            Was möchten Sie verkaufen?
          </label>
          <div className="grid grid-cols-2 gap-3">
            {vehicleTypes.map((type) => {
              const Icon = type.icon;
              const isSelected = vehicleType === type.id;
              return (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setVehicleType(type.id)}
                  className={cn(
                    "relative flex flex-col items-center justify-center p-4 sm:p-5 rounded-xl border-2 transition-all duration-200",
                    "hover:border-primary/50 hover:bg-primary/5 hover:shadow-md",
                    isSelected
                      ? "border-primary bg-primary/10 shadow-md ring-2 ring-primary/20"
                      : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 shadow-sm"
                  )}
                >
                  {isSelected && (
                    <div className="absolute top-2 right-2">
                      <CheckCircle className="w-5 h-5 text-primary fill-primary/20" />
                    </div>
                  )}
                  <Icon className={cn(
                    "w-14 h-10 sm:w-16 sm:h-12 mb-2",
                    isSelected ? "text-primary" : "text-slate-500 dark:text-slate-400"
                  )} />
                  <span className={cn(
                    "text-sm sm:text-base font-bold",
                    isSelected ? "text-primary" : "text-foreground"
                  )}>
                    {type.label}
                  </span>
                  <span className="text-[10px] sm:text-xs text-muted-foreground text-center mt-0.5 leading-tight">
                    {type.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* CTA Button */}
        <Button
          onClick={handleStart}
          className="w-full gradient-hero hover:shadow-glow h-12 text-base font-semibold rounded-xl group"
          size="lg"
        >
          {vehicleType
            ? `${vehicleType === 'wohnmobil' ? 'Wohnmobil' : 'Wohnwagen'} jetzt bewerten lassen`
            : 'Kostenloses Angebot erhalten'}
          <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
        </Button>

        {/* Trust indicators */}
        <div className="flex items-center justify-center gap-4 text-xs text-slate-500 dark:text-slate-400 pt-1">
          <span className="flex items-center gap-1">
            <CheckCircle className="h-3.5 w-3.5 text-green-500" />
            100% kostenlos
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle className="h-3.5 w-3.5 text-green-500" />
            Unverbindlich
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle className="h-3.5 w-3.5 text-green-500" />
            In 2 Min. fertig
          </span>
        </div>
      </div>
    </Card>
  );
};

export default QuickAuctionForm;
