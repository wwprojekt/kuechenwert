-- site_settings.meta_description enthielt noch die Auktionsformulierung
-- "Geprüfte Küchenstudios bieten um Ihr Projekt" und versprach, sofort zu
-- sehen, was die Küche kostet (es ist eine Schätzung). Gleicher Wortlaut wie
-- die Startseite (src/pages/Index.tsx). Nur Zeilen mit dem alten Text, damit
-- spätere Änderungen im Admin nicht überschrieben werden.

update public.site_settings
   set meta_description = 'Foto Ihres Raums hochladen, Küche konfigurieren und sofort sehen, wie sie aussieht und was sie ungefähr kostet. Geprüfte Küchenstudios machen Ihnen Angebote – Sie wählen. Kostenlos & unverbindlich.'
 where meta_description like '%bieten um Ihr Projekt%';
