/**
 * Pending Dealer Translations
 *
 * Provides localised strings for the PendingDealerBanner and
 * PendingDealerDocumentUpload components based on the dealer's country.
 *
 * Uses the same country → language mapping as the registration form
 * (dealerRegistrationTranslations.ts) so the experience stays consistent.
 */

import { getLanguageForCountry } from './dealerRegistrationTranslations';

/* ------------------------------------------------------------------ */
/*  Translation keys                                                   */
/* ------------------------------------------------------------------ */

export interface PendingDealerTranslations {
  // --- PendingDealerBanner ---
  bannerPendingTitle: string;
  bannerRejectedTitle: string;
  bannerPendingBadge: string;
  bannerRejectedBadge: string;
  bannerPendingDescription: string;
  bannerRejectedDescription: string;
  bannerRejectionReason: string;
  bannerShowDetails: string;
  bannerHideDetails: string;
  bannerCompany: string;
  bannerLegalForm: string;
  bannerSubmittedAt: string;
  bannerRefreshStatus: string;
  bannerContact: string;
  bannerProcessingTime: string;

  // --- PendingDealerDocumentUpload ---
  docTitle: string;
  docDescription: string;
  docRequiredDocuments: string;
  docAllUploaded: string;
  docTradeLicenseLabel: string;
  docTradeLicenseDesc: string;
  docIdFrontLabel: string;
  docIdFrontDesc: string;
  docIdBackLabel: string;
  docIdBackDesc: string;
  docRequired: string;
  docUnderReview: string;
  docVerified: string;
  docFile: string;
  docUploadedAt: string;
  docVerifiedAt: string;
  docAdminNote: string;
  docUploading: string;
  docProcessing: string;
  docReplace: string;
  docUpload: string;
  docInfoBox: string;
  docInvalidType: string;
  docFileTooLarge: string;
  docUploadSuccess: string;
  docUploadFailed: string;
  docDeleted: string;
  docDeleteFailed: string;
  docNotLoggedIn: string;
  docOf: string;
}

/* ------------------------------------------------------------------ */
/*  German                                                             */
/* ------------------------------------------------------------------ */

const de: PendingDealerTranslations = {
  bannerPendingTitle: 'Ihr Händlerkonto wird geprüft',
  bannerRejectedTitle: 'Ihr Händlerantrag wurde abgelehnt',
  bannerPendingBadge: 'In Bearbeitung',
  bannerRejectedBadge: 'Abgelehnt',
  bannerPendingDescription:
    'Alle Händler-Funktionen werden freigeschaltet, sobald Ihr Antrag genehmigt wurde. Sie können sich bereits im Dashboard umsehen.',
  bannerRejectedDescription:
    'Leider konnte Ihr Antrag nicht genehmigt werden. Bitte kontaktieren Sie uns für weitere Informationen.',
  bannerRejectionReason: 'Begründung:',
  bannerShowDetails: 'Details anzeigen',
  bannerHideDetails: 'Details ausblenden',
  bannerCompany: 'Firma:',
  bannerLegalForm: 'Rechtsform:',
  bannerSubmittedAt: 'Eingereicht:',
  bannerRefreshStatus: 'Status aktualisieren',
  bannerContact: 'Kontakt aufnehmen',
  bannerProcessingTime:
    'Die Prüfung dauert in der Regel 1-3 Werktage. Sie erhalten eine E-Mail-Benachrichtigung.',

  docTitle: 'Dokumente für Verifizierung',
  docDescription:
    'Bitte laden Sie die folgenden Dokumente hoch, damit wir Ihren Händlerantrag prüfen können.',
  docRequiredDocuments: 'Erforderliche Dokumente',
  docAllUploaded:
    'Alle erforderlichen Dokumente hochgeladen – wir prüfen Ihren Antrag.',
  docTradeLicenseLabel: 'Gewerbenachweis',
  docTradeLicenseDesc:
    'Gewerbeanmeldung, Gewerbeummeldung oder aktueller Gewerbeschein',
  docIdFrontLabel: 'Ausweis – Vorderseite',
  docIdFrontDesc:
    'Personalausweis oder Reisepass (Vorderseite) des Geschäftsführers',
  docIdBackLabel: 'Ausweis – Rückseite',
  docIdBackDesc:
    'Personalausweis oder Reisepass (Rückseite) des Geschäftsführers',
  docRequired: 'Erforderlich',
  docUnderReview: 'Wird geprüft',
  docVerified: 'Verifiziert',
  docFile: 'Datei:',
  docUploadedAt: 'Hochgeladen:',
  docVerifiedAt: 'Geprüft am:',
  docAdminNote: 'Admin-Hinweis:',
  docUploading: 'Wird hochgeladen...',
  docProcessing: 'Verarbeitung...',
  docReplace: 'Ersetzen',
  docUpload: 'Hochladen',
  docInfoBox:
    'Erlaubte Dateiformate: PDF, JPG, PNG (max. 25 MB). Ihre Dokumente werden vertraulich behandelt und nur zur Verifizierung Ihres Händlerkontos verwendet. Nach der Prüfung erhalten Sie eine E-Mail-Benachrichtigung.',
  docInvalidType: 'Ungültiger Dateityp. Erlaubt: PDF, JPG, PNG',
  docFileTooLarge: 'Datei zu groß. Maximal 25 MB erlaubt.',
  docUploadSuccess: 'erfolgreich hochgeladen',
  docUploadFailed: 'Upload fehlgeschlagen',
  docDeleted: 'Dokument gelöscht',
  docDeleteFailed: 'Dokument konnte nicht gelöscht werden',
  docNotLoggedIn: 'Nicht angemeldet. Bitte laden Sie die Seite neu.',
  docOf: 'von',
};

/* ------------------------------------------------------------------ */
/*  English                                                            */
/* ------------------------------------------------------------------ */

const en: PendingDealerTranslations = {
  bannerPendingTitle: 'Your dealer account is being reviewed',
  bannerRejectedTitle: 'Your dealer application was rejected',
  bannerPendingBadge: 'Under Review',
  bannerRejectedBadge: 'Rejected',
  bannerPendingDescription:
    'All dealer features will be unlocked once your application has been approved. You can already look around the dashboard.',
  bannerRejectedDescription:
    'Unfortunately, your application could not be approved. Please contact us for more information.',
  bannerRejectionReason: 'Reason:',
  bannerShowDetails: 'Show details',
  bannerHideDetails: 'Hide details',
  bannerCompany: 'Company:',
  bannerLegalForm: 'Legal form:',
  bannerSubmittedAt: 'Submitted:',
  bannerRefreshStatus: 'Refresh status',
  bannerContact: 'Contact us',
  bannerProcessingTime:
    'The review usually takes 1-3 business days. You will receive an email notification.',

  docTitle: 'Documents for Verification',
  docDescription:
    'Please upload the following documents so we can review your dealer application.',
  docRequiredDocuments: 'Required documents',
  docAllUploaded:
    'All required documents uploaded – we are reviewing your application.',
  docTradeLicenseLabel: 'Trade Licence',
  docTradeLicenseDesc:
    'Business registration or current trade licence',
  docIdFrontLabel: 'ID – Front',
  docIdFrontDesc:
    'National ID card or passport (front) of the managing director',
  docIdBackLabel: 'ID – Back',
  docIdBackDesc:
    'National ID card or passport (back) of the managing director',
  docRequired: 'Required',
  docUnderReview: 'Under review',
  docVerified: 'Verified',
  docFile: 'File:',
  docUploadedAt: 'Uploaded:',
  docVerifiedAt: 'Verified on:',
  docAdminNote: 'Admin note:',
  docUploading: 'Uploading...',
  docProcessing: 'Processing...',
  docReplace: 'Replace',
  docUpload: 'Upload',
  docInfoBox:
    'Allowed file formats: PDF, JPG, PNG (max. 25 MB). Your documents are treated confidentially and used only for dealer account verification. You will receive an email notification after the review.',
  docInvalidType: 'Invalid file type. Allowed: PDF, JPG, PNG',
  docFileTooLarge: 'File too large. Maximum 25 MB allowed.',
  docUploadSuccess: 'uploaded successfully',
  docUploadFailed: 'Upload failed',
  docDeleted: 'Document deleted',
  docDeleteFailed: 'Document could not be deleted',
  docNotLoggedIn: 'Not logged in. Please reload the page.',
  docOf: 'of',
};

/* ------------------------------------------------------------------ */
/*  Dutch                                                              */
/* ------------------------------------------------------------------ */

const nl: PendingDealerTranslations = {
  bannerPendingTitle: 'Uw dealerrekening wordt beoordeeld',
  bannerRejectedTitle: 'Uw dealeraanvraag is afgewezen',
  bannerPendingBadge: 'In behandeling',
  bannerRejectedBadge: 'Afgewezen',
  bannerPendingDescription:
    'Alle dealerfuncties worden ontgrendeld zodra uw aanvraag is goedgekeurd. U kunt alvast rondkijken in het dashboard.',
  bannerRejectedDescription:
    'Helaas kon uw aanvraag niet worden goedgekeurd. Neem contact met ons op voor meer informatie.',
  bannerRejectionReason: 'Reden:',
  bannerShowDetails: 'Details tonen',
  bannerHideDetails: 'Details verbergen',
  bannerCompany: 'Bedrijf:',
  bannerLegalForm: 'Rechtsvorm:',
  bannerSubmittedAt: 'Ingediend:',
  bannerRefreshStatus: 'Status vernieuwen',
  bannerContact: 'Contact opnemen',
  bannerProcessingTime:
    'De beoordeling duurt doorgaans 1-3 werkdagen. U ontvangt een e-mailmelding.',

  docTitle: 'Documenten voor verificatie',
  docDescription:
    'Upload de volgende documenten zodat wij uw dealeraanvraag kunnen beoordelen.',
  docRequiredDocuments: 'Vereiste documenten',
  docAllUploaded:
    'Alle vereiste documenten geüpload – wij beoordelen uw aanvraag.',
  docTradeLicenseLabel: 'KvK-uittreksel',
  docTradeLicenseDesc:
    'Uittreksel Kamer van Koophandel of handelsregister',
  docIdFrontLabel: 'Identiteitsbewijs – Voorzijde',
  docIdFrontDesc:
    'Identiteitskaart of paspoort (voorzijde) van de directeur',
  docIdBackLabel: 'Identiteitsbewijs – Achterzijde',
  docIdBackDesc:
    'Identiteitskaart of paspoort (achterzijde) van de directeur',
  docRequired: 'Vereist',
  docUnderReview: 'Wordt beoordeeld',
  docVerified: 'Geverifieerd',
  docFile: 'Bestand:',
  docUploadedAt: 'Geüpload:',
  docVerifiedAt: 'Geverifieerd op:',
  docAdminNote: 'Admin-opmerking:',
  docUploading: 'Wordt geüpload...',
  docProcessing: 'Verwerking...',
  docReplace: 'Vervangen',
  docUpload: 'Uploaden',
  docInfoBox:
    'Toegestane bestandsformaten: PDF, JPG, PNG (max. 25 MB). Uw documenten worden vertrouwelijk behandeld en alleen gebruikt voor verificatie van uw dealerrekening. Na de beoordeling ontvangt u een e-mailmelding.',
  docInvalidType: 'Ongeldig bestandstype. Toegestaan: PDF, JPG, PNG',
  docFileTooLarge: 'Bestand te groot. Maximaal 25 MB toegestaan.',
  docUploadSuccess: 'succesvol geüpload',
  docUploadFailed: 'Upload mislukt',
  docDeleted: 'Document verwijderd',
  docDeleteFailed: 'Document kon niet worden verwijderd',
  docNotLoggedIn: 'Niet ingelogd. Vernieuw de pagina.',
  docOf: 'van',
};

/* ------------------------------------------------------------------ */
/*  French                                                             */
/* ------------------------------------------------------------------ */

const fr: PendingDealerTranslations = {
  bannerPendingTitle: 'Votre compte concessionnaire est en cours de vérification',
  bannerRejectedTitle: 'Votre demande de concessionnaire a été refusée',
  bannerPendingBadge: 'En cours',
  bannerRejectedBadge: 'Refusé',
  bannerPendingDescription:
    'Toutes les fonctions concessionnaire seront débloquées dès que votre demande aura été approuvée. Vous pouvez déjà consulter le tableau de bord.',
  bannerRejectedDescription:
    'Malheureusement, votre demande n\'a pas pu être approuvée. Veuillez nous contacter pour plus d\'informations.',
  bannerRejectionReason: 'Motif :',
  bannerShowDetails: 'Afficher les détails',
  bannerHideDetails: 'Masquer les détails',
  bannerCompany: 'Entreprise :',
  bannerLegalForm: 'Forme juridique :',
  bannerSubmittedAt: 'Soumis le :',
  bannerRefreshStatus: 'Actualiser le statut',
  bannerContact: 'Nous contacter',
  bannerProcessingTime:
    'L\'examen prend généralement 1 à 3 jours ouvrables. Vous recevrez une notification par e-mail.',

  docTitle: 'Documents pour la vérification',
  docDescription:
    'Veuillez télécharger les documents suivants afin que nous puissions examiner votre demande.',
  docRequiredDocuments: 'Documents requis',
  docAllUploaded:
    'Tous les documents requis ont été téléchargés – nous examinons votre demande.',
  docTradeLicenseLabel: 'Extrait Kbis',
  docTradeLicenseDesc:
    'Extrait Kbis ou inscription au registre du commerce',
  docIdFrontLabel: 'Pièce d\'identité – Recto',
  docIdFrontDesc:
    'Carte d\'identité ou passeport (recto) du dirigeant',
  docIdBackLabel: 'Pièce d\'identité – Verso',
  docIdBackDesc:
    'Carte d\'identité ou passeport (verso) du dirigeant',
  docRequired: 'Requis',
  docUnderReview: 'En cours de vérification',
  docVerified: 'Vérifié',
  docFile: 'Fichier :',
  docUploadedAt: 'Téléchargé le :',
  docVerifiedAt: 'Vérifié le :',
  docAdminNote: 'Note admin :',
  docUploading: 'Téléchargement en cours...',
  docProcessing: 'Traitement...',
  docReplace: 'Remplacer',
  docUpload: 'Télécharger',
  docInfoBox:
    'Formats de fichiers autorisés : PDF, JPG, PNG (max. 10 Mo). Vos documents sont traités de manière confidentielle et utilisés uniquement pour la vérification de votre compte. Vous recevrez une notification par e-mail après l\'examen.',
  docInvalidType: 'Type de fichier invalide. Autorisé : PDF, JPG, PNG',
  docFileTooLarge: 'Fichier trop volumineux. Maximum 25 Mo autorisé.',
  docUploadSuccess: 'téléchargé avec succès',
  docUploadFailed: 'Échec du téléchargement',
  docDeleted: 'Document supprimé',
  docDeleteFailed: 'Le document n\'a pas pu être supprimé',
  docNotLoggedIn: 'Non connecté. Veuillez recharger la page.',
  docOf: 'sur',
};

/* ------------------------------------------------------------------ */
/*  Italian                                                            */
/* ------------------------------------------------------------------ */

const it: PendingDealerTranslations = {
  bannerPendingTitle: 'Il vostro account concessionario è in fase di verifica',
  bannerRejectedTitle: 'La vostra richiesta di concessionario è stata rifiutata',
  bannerPendingBadge: 'In elaborazione',
  bannerRejectedBadge: 'Rifiutato',
  bannerPendingDescription:
    'Tutte le funzioni concessionario verranno sbloccate non appena la vostra richiesta sarà approvata. Potete già consultare la dashboard.',
  bannerRejectedDescription:
    'Purtroppo la vostra richiesta non ha potuto essere approvata. Contattateci per ulteriori informazioni.',
  bannerRejectionReason: 'Motivazione:',
  bannerShowDetails: 'Mostra dettagli',
  bannerHideDetails: 'Nascondi dettagli',
  bannerCompany: 'Azienda:',
  bannerLegalForm: 'Forma giuridica:',
  bannerSubmittedAt: 'Inviato il:',
  bannerRefreshStatus: 'Aggiorna stato',
  bannerContact: 'Contattaci',
  bannerProcessingTime:
    'La verifica richiede solitamente 1-3 giorni lavorativi. Riceverete una notifica via e-mail.',

  docTitle: 'Documenti per la verifica',
  docDescription:
    'Caricate i seguenti documenti affinché possiamo esaminare la vostra richiesta.',
  docRequiredDocuments: 'Documenti richiesti',
  docAllUploaded:
    'Tutti i documenti richiesti caricati – stiamo esaminando la vostra richiesta.',
  docTradeLicenseLabel: 'Visura camerale',
  docTradeLicenseDesc:
    'Visura camerale o iscrizione al registro delle imprese',
  docIdFrontLabel: 'Documento d\'identità – Fronte',
  docIdFrontDesc:
    'Carta d\'identità o passaporto (fronte) dell\'amministratore',
  docIdBackLabel: 'Documento d\'identità – Retro',
  docIdBackDesc:
    'Carta d\'identità o passaporto (retro) dell\'amministratore',
  docRequired: 'Richiesto',
  docUnderReview: 'In fase di verifica',
  docVerified: 'Verificato',
  docFile: 'File:',
  docUploadedAt: 'Caricato il:',
  docVerifiedAt: 'Verificato il:',
  docAdminNote: 'Nota admin:',
  docUploading: 'Caricamento in corso...',
  docProcessing: 'Elaborazione...',
  docReplace: 'Sostituire',
  docUpload: 'Caricare',
  docInfoBox:
    'Formati di file consentiti: PDF, JPG, PNG (max. 25 MB). I vostri documenti sono trattati in modo confidenziale e utilizzati solo per la verifica del vostro account. Riceverete una notifica via e-mail dopo la verifica.',
  docInvalidType: 'Tipo di file non valido. Consentiti: PDF, JPG, PNG',
  docFileTooLarge: 'File troppo grande. Massimo 25 MB consentiti.',
  docUploadSuccess: 'caricato con successo',
  docUploadFailed: 'Caricamento fallito',
  docDeleted: 'Documento eliminato',
  docDeleteFailed: 'Il documento non è stato eliminato',
  docNotLoggedIn: 'Non connesso. Ricaricate la pagina.',
  docOf: 'di',
};

/* ------------------------------------------------------------------ */
/*  Spanish                                                            */
/* ------------------------------------------------------------------ */

const es: PendingDealerTranslations = {
  bannerPendingTitle: 'Su cuenta de concesionario está siendo revisada',
  bannerRejectedTitle: 'Su solicitud de concesionario ha sido rechazada',
  bannerPendingBadge: 'En proceso',
  bannerRejectedBadge: 'Rechazado',
  bannerPendingDescription:
    'Todas las funciones de concesionario se desbloquearán una vez que su solicitud haya sido aprobada. Ya puede explorar el panel de control.',
  bannerRejectedDescription:
    'Lamentablemente, su solicitud no pudo ser aprobada. Póngase en contacto con nosotros para más información.',
  bannerRejectionReason: 'Motivo:',
  bannerShowDetails: 'Mostrar detalles',
  bannerHideDetails: 'Ocultar detalles',
  bannerCompany: 'Empresa:',
  bannerLegalForm: 'Forma jurídica:',
  bannerSubmittedAt: 'Enviado el:',
  bannerRefreshStatus: 'Actualizar estado',
  bannerContact: 'Contactar',
  bannerProcessingTime:
    'La revisión suele tardar de 1 a 3 días laborables. Recibirá una notificación por correo electrónico.',

  docTitle: 'Documentos para verificación',
  docDescription:
    'Suba los siguientes documentos para que podamos revisar su solicitud.',
  docRequiredDocuments: 'Documentos requeridos',
  docAllUploaded:
    'Todos los documentos requeridos subidos – estamos revisando su solicitud.',
  docTradeLicenseLabel: 'Licencia comercial',
  docTradeLicenseDesc:
    'Alta en el censo o licencia de actividad comercial',
  docIdFrontLabel: 'Documento de identidad – Anverso',
  docIdFrontDesc:
    'DNI o pasaporte (anverso) del administrador',
  docIdBackLabel: 'Documento de identidad – Reverso',
  docIdBackDesc:
    'DNI o pasaporte (reverso) del administrador',
  docRequired: 'Requerido',
  docUnderReview: 'En revisión',
  docVerified: 'Verificado',
  docFile: 'Archivo:',
  docUploadedAt: 'Subido el:',
  docVerifiedAt: 'Verificado el:',
  docAdminNote: 'Nota del admin:',
  docUploading: 'Subiendo...',
  docProcessing: 'Procesando...',
  docReplace: 'Reemplazar',
  docUpload: 'Subir',
  docInfoBox:
    'Formatos de archivo permitidos: PDF, JPG, PNG (máx. 25 MB). Sus documentos se tratan de forma confidencial y se utilizan únicamente para la verificación de su cuenta. Recibirá una notificación por correo electrónico tras la revisión.',
  docInvalidType: 'Tipo de archivo no válido. Permitidos: PDF, JPG, PNG',
  docFileTooLarge: 'Archivo demasiado grande. Máximo 25 MB permitido.',
  docUploadSuccess: 'subido con éxito',
  docUploadFailed: 'Error al subir',
  docDeleted: 'Documento eliminado',
  docDeleteFailed: 'No se pudo eliminar el documento',
  docNotLoggedIn: 'No conectado. Recargue la página.',
  docOf: 'de',
};

/* ------------------------------------------------------------------ */
/*  Portuguese                                                         */
/* ------------------------------------------------------------------ */

const pt: PendingDealerTranslations = {
  bannerPendingTitle: 'A sua conta de concessionário está a ser analisada',
  bannerRejectedTitle: 'O seu pedido de concessionário foi rejeitado',
  bannerPendingBadge: 'Em análise',
  bannerRejectedBadge: 'Rejeitado',
  bannerPendingDescription:
    'Todas as funções de concessionário serão desbloqueadas assim que o seu pedido for aprovado. Já pode explorar o painel.',
  bannerRejectedDescription:
    'Infelizmente, o seu pedido não pôde ser aprovado. Contacte-nos para mais informações.',
  bannerRejectionReason: 'Motivo:',
  bannerShowDetails: 'Mostrar detalhes',
  bannerHideDetails: 'Ocultar detalhes',
  bannerCompany: 'Empresa:',
  bannerLegalForm: 'Forma jurídica:',
  bannerSubmittedAt: 'Submetido em:',
  bannerRefreshStatus: 'Atualizar estado',
  bannerContact: 'Contactar',
  bannerProcessingTime:
    'A análise demora normalmente 1 a 3 dias úteis. Receberá uma notificação por e-mail.',

  docTitle: 'Documentos para verificação',
  docDescription:
    'Carregue os seguintes documentos para que possamos analisar o seu pedido.',
  docRequiredDocuments: 'Documentos obrigatórios',
  docAllUploaded:
    'Todos os documentos obrigatórios carregados – estamos a analisar o seu pedido.',
  docTradeLicenseLabel: 'Certidão comercial',
  docTradeLicenseDesc:
    'Certidão permanente ou registo comercial',
  docIdFrontLabel: 'Documento de identidade – Frente',
  docIdFrontDesc:
    'Cartão de cidadão ou passaporte (frente) do gerente',
  docIdBackLabel: 'Documento de identidade – Verso',
  docIdBackDesc:
    'Cartão de cidadão ou passaporte (verso) do gerente',
  docRequired: 'Obrigatório',
  docUnderReview: 'Em análise',
  docVerified: 'Verificado',
  docFile: 'Ficheiro:',
  docUploadedAt: 'Carregado em:',
  docVerifiedAt: 'Verificado em:',
  docAdminNote: 'Nota do admin:',
  docUploading: 'A carregar...',
  docProcessing: 'A processar...',
  docReplace: 'Substituir',
  docUpload: 'Carregar',
  docInfoBox:
    'Formatos de ficheiro permitidos: PDF, JPG, PNG (máx. 25 MB). Os seus documentos são tratados de forma confidencial e utilizados apenas para verificação da sua conta. Receberá uma notificação por e-mail após a análise.',
  docInvalidType: 'Tipo de ficheiro inválido. Permitidos: PDF, JPG, PNG',
  docFileTooLarge: 'Ficheiro demasiado grande. Máximo 25 MB permitido.',
  docUploadSuccess: 'carregado com sucesso',
  docUploadFailed: 'Falha no carregamento',
  docDeleted: 'Documento eliminado',
  docDeleteFailed: 'Não foi possível eliminar o documento',
  docNotLoggedIn: 'Não ligado. Recarregue a página.',
  docOf: 'de',
};

/* ------------------------------------------------------------------ */
/*  Polish                                                             */
/* ------------------------------------------------------------------ */

const pl: PendingDealerTranslations = {
  bannerPendingTitle: 'Twoje konto dealera jest weryfikowane',
  bannerRejectedTitle: 'Twój wniosek dealerski został odrzucony',
  bannerPendingBadge: 'W trakcie',
  bannerRejectedBadge: 'Odrzucony',
  bannerPendingDescription:
    'Wszystkie funkcje dealerskie zostaną odblokowane po zatwierdzeniu Twojego wniosku. Możesz już przeglądać panel.',
  bannerRejectedDescription:
    'Niestety Twój wniosek nie mógł zostać zatwierdzony. Skontaktuj się z nami, aby uzyskać więcej informacji.',
  bannerRejectionReason: 'Powód:',
  bannerShowDetails: 'Pokaż szczegóły',
  bannerHideDetails: 'Ukryj szczegóły',
  bannerCompany: 'Firma:',
  bannerLegalForm: 'Forma prawna:',
  bannerSubmittedAt: 'Złożono:',
  bannerRefreshStatus: 'Odśwież status',
  bannerContact: 'Skontaktuj się',
  bannerProcessingTime:
    'Weryfikacja trwa zwykle 1-3 dni robocze. Otrzymasz powiadomienie e-mail.',

  docTitle: 'Dokumenty do weryfikacji',
  docDescription:
    'Prześlij poniższe dokumenty, abyśmy mogli rozpatrzyć Twój wniosek.',
  docRequiredDocuments: 'Wymagane dokumenty',
  docAllUploaded:
    'Wszystkie wymagane dokumenty przesłane – weryfikujemy Twój wniosek.',
  docTradeLicenseLabel: 'Wpis do CEIDG / KRS',
  docTradeLicenseDesc:
    'Wydruk z CEIDG lub odpis z KRS',
  docIdFrontLabel: 'Dokument tożsamości – Przód',
  docIdFrontDesc:
    'Dowód osobisty lub paszport (przód) osoby zarządzającej',
  docIdBackLabel: 'Dokument tożsamości – Tył',
  docIdBackDesc:
    'Dowód osobisty lub paszport (tył) osoby zarządzającej',
  docRequired: 'Wymagane',
  docUnderReview: 'W trakcie weryfikacji',
  docVerified: 'Zweryfikowany',
  docFile: 'Plik:',
  docUploadedAt: 'Przesłano:',
  docVerifiedAt: 'Zweryfikowano:',
  docAdminNote: 'Uwaga admina:',
  docUploading: 'Przesyłanie...',
  docProcessing: 'Przetwarzanie...',
  docReplace: 'Zastąp',
  docUpload: 'Prześlij',
  docInfoBox:
    'Dozwolone formaty plików: PDF, JPG, PNG (maks. 25 MB). Twoje dokumenty są traktowane poufnie i wykorzystywane wyłącznie do weryfikacji konta. Po weryfikacji otrzymasz powiadomienie e-mail.',
  docInvalidType: 'Nieprawidłowy typ pliku. Dozwolone: PDF, JPG, PNG',
  docFileTooLarge: 'Plik za duży. Maksymalnie 25 MB.',
  docUploadSuccess: 'przesłano pomyślnie',
  docUploadFailed: 'Przesyłanie nie powiodło się',
  docDeleted: 'Dokument usunięty',
  docDeleteFailed: 'Nie udało się usunąć dokumentu',
  docNotLoggedIn: 'Nie zalogowano. Odśwież stronę.',
  docOf: 'z',
};

/* ------------------------------------------------------------------ */
/*  Language map & accessor                                            */
/* ------------------------------------------------------------------ */

const LANGUAGE_MAP: Record<string, PendingDealerTranslations> = {
  de,
  en,
  nl,
  fr,
  it,
  es,
  pt,
  pl,
};

/**
 * Get all pending-dealer translations for a given country code.
 * Falls back to English if no specific translation exists.
 */
export function getPendingDealerTranslations(
  countryCode: string,
): PendingDealerTranslations {
  const lang = getLanguageForCountry(countryCode);
  return LANGUAGE_MAP[lang] ?? en;
}
