import type { ReactNode } from "react";

interface PageHeroProps {
  children: ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg";
}

/**
 * Consistent hero/header section for subpages with the same gradient as the main Hero
 */
const PageHero = ({ children, className = "", size = "md" }: PageHeroProps) => {
  const sizeClasses = {
    sm: "py-6 md:py-16",
    md: "py-10 md:py-24",
    lg: "py-14 md:py-32",
  };

  return (
    <section className={`relative overflow-hidden ${sizeClasses[size]} ${className}`}>
      {/* Gradient background matching main Hero */}
      <div className="absolute inset-0 bg-gradient-to-b from-cyan-50/80 via-sky-50/40 to-white" />
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent" />
      
      {/* Decorative elements for depth */}
      <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-cyan-100/30 to-transparent" />
      <div className="absolute bottom-0 left-0 w-full h-24 bg-gradient-to-t from-white to-transparent" />
      
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

