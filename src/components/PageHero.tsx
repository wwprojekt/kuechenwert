import type { ReactNode } from "react";

interface PageHeroProps {
  children: ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg";
}

/**
 * Einheitlicher Kopfbereich der Unterseiten – derselbe warme Salbei-zu-Creme-
 * Verlauf wie der Hero der Startseite.
 */
const PageHero = ({ children, className = "", size = "md" }: PageHeroProps) => {
  const sizeClasses = {
    sm: "py-6 md:py-16",
    md: "py-10 md:py-24",
    lg: "py-14 md:py-32",
  };

  return (
    <section className={`relative overflow-hidden ${sizeClasses[size]} ${className}`}>
      <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.08] via-background to-background" />
      <div className="absolute top-0 right-0 h-full w-1/2 bg-gradient-to-l from-accent/[0.06] to-transparent" />
      
      {/* Subtle pattern overlay */}
      <div 
        className="absolute inset-0 opacity-[0.015]" 
        style={{ 
          backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)', 
          backgroundSize: '32px 32px' 
        }} 
      />
      
      {/* Content */}
      <div className="container relative z-10">
        {children}
      </div>
    </section>
  );
};

export default PageHero;

