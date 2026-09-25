-- Positionierung: vom Gebrauchtküchen-Marktplatz zur Traumküchen-Plattform
-- (KI-Visualisierung im eigenen Raum, Preisschätzung, Studio-Angebote).
-- site_settings überschreibt die Code-Defaults (BRAND.tagline) in Header,
-- Footer, E-Mail-Footer und Structured Data.

update public.site_settings
set
  site_tagline = 'Traumküche planen & Angebote vergleichen',
  site_description = 'Traumküche im eigenen Raum mit KI visualisieren, Preis sofort schätzen und Angebote geprüfter Küchenstudios vergleichen – kostenlos und unverbindlich.',
  meta_title = 'KüchenWert – Traumküche mit KI planen & Angebote vergleichen',
  meta_description = 'Raumfoto hochladen, Küche konfigurieren und sofort sehen, wie sie aussieht und was sie kostet. Geprüfte Küchenstudios bieten um Ihr Projekt – Sie wählen.',
  meta_keywords = 'küche planen, küchenplaner online, küche visualisieren, ki küchenplaner, küche preis berechnen, küchenstudio angebote vergleichen, neue küche kaufen, küchen preisvergleich',
  updated_at = now()
where id = '00000000-0000-0000-0000-000000000000';
