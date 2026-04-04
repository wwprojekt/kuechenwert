/**
 * EU Countries and Legal Forms
 * Shared data for dealer registration forms across the application.
 * Each country includes its ISO 3166-1 alpha-2 code, German name,
 * and the most common legal forms for businesses.
 */

export interface LegalForm {
  value: string;
  label: string;
}

export interface EUCountry {
  code: string;
  name: string;
  legalForms: LegalForm[];
}

export const EU_COUNTRIES: EUCountry[] = [
  {
    code: 'DE',
    name: 'Deutschland',
    legalForms: [
      { value: 'Einzelunternehmen', label: 'Einzelunternehmen' },
      { value: 'GmbH', label: 'GmbH' },
      { value: 'UG', label: 'UG (haftungsbeschränkt)' },
      { value: 'GbR', label: 'GbR' },
      { value: 'KG', label: 'KG' },
      { value: 'OHG', label: 'OHG' },
      { value: 'AG', label: 'AG' },
      { value: 'GmbH & Co. KG', label: 'GmbH & Co. KG' },
    ],
  },
  {
    code: 'AT',
    name: 'Österreich',
    legalForms: [
      { value: 'Einzelunternehmen', label: 'Einzelunternehmen' },
      { value: 'GmbH', label: 'GmbH' },
      { value: 'AG', label: 'AG' },
      { value: 'KG', label: 'KG' },
      { value: 'OG', label: 'OG' },
      { value: 'GesbR', label: 'GesbR' },
    ],
  },
  {
    code: 'CH',
    name: 'Schweiz',
    legalForms: [
      { value: 'Einzelunternehmen', label: 'Einzelunternehmen' },
      { value: 'GmbH', label: 'GmbH' },
      { value: 'AG', label: 'AG' },
      { value: 'KlG', label: 'Kollektivgesellschaft (KlG)' },
      { value: 'KmG', label: 'Kommanditgesellschaft (KmG)' },
    ],
  },
  {
    code: 'NL',
    name: 'Niederlande',
    legalForms: [
      { value: 'Eenmanszaak', label: 'Eenmanszaak' },
      { value: 'BV', label: 'BV (Besloten Vennootschap)' },
      { value: 'NV', label: 'NV (Naamloze Vennootschap)' },
      { value: 'VOF', label: 'VOF (Vennootschap onder Firma)' },
      { value: 'CV', label: 'CV (Commanditaire Vennootschap)' },
      { value: 'Maatschap', label: 'Maatschap' },
    ],
  },
  {
    code: 'BE',
    name: 'Belgien',
    legalForms: [
      { value: 'Eenmanszaak', label: 'Eenmanszaak / Entreprise individuelle' },
      { value: 'BV', label: 'BV / SRL' },
      { value: 'NV', label: 'NV / SA' },
      { value: 'VOF', label: 'VOF / SNC' },
      { value: 'CV', label: 'CV / SC' },
    ],
  },
  {
    code: 'FR',
    name: 'Frankreich',
    legalForms: [
      { value: 'EI', label: 'Entreprise individuelle (EI)' },
      { value: 'SARL', label: 'SARL' },
      { value: 'SAS', label: 'SAS' },
      { value: 'SA', label: 'SA' },
      { value: 'EURL', label: 'EURL' },
      { value: 'SCI', label: 'SCI' },
    ],
  },
  {
    code: 'IT',
    name: 'Italien',
    legalForms: [
      { value: 'Ditta individuale', label: 'Ditta individuale' },
      { value: 'SRL', label: 'SRL (Società a responsabilità limitata)' },
      { value: 'SPA', label: 'SPA (Società per azioni)' },
      { value: 'SAS', label: 'SAS (Società in accomandita semplice)' },
      { value: 'SNC', label: 'SNC (Società in nome collettivo)' },
    ],
  },
  {
    code: 'ES',
    name: 'Spanien',
    legalForms: [
      { value: 'Autónomo', label: 'Autónomo' },
      { value: 'SL', label: 'SL (Sociedad Limitada)' },
      { value: 'SA', label: 'SA (Sociedad Anónima)' },
      { value: 'SC', label: 'SC (Sociedad Civil)' },
      { value: 'SLL', label: 'SLL (Sociedad Limitada Laboral)' },
    ],
  },
  {
    code: 'PT',
    name: 'Portugal',
    legalForms: [
      { value: 'ENI', label: 'Empresário em Nome Individual' },
      { value: 'Lda', label: 'Lda (Sociedade por Quotas)' },
      { value: 'SA', label: 'SA (Sociedade Anónima)' },
      { value: 'SNC', label: 'SNC (Sociedade em Nome Coletivo)' },
    ],
  },
  {
    code: 'PL',
    name: 'Polen',
    legalForms: [
      { value: 'JDG', label: 'JDG (Jednoosobowa działalność gospodarcza)' },
      { value: 'Sp. z o.o.', label: 'Sp. z o.o.' },
      { value: 'SA', label: 'SA (Spółka Akcyjna)' },
      { value: 'Sp.k.', label: 'Sp.k. (Spółka komandytowa)' },
      { value: 'Sp.j.', label: 'Sp.j. (Spółka jawna)' },
    ],
  },
  {
    code: 'CZ',
    name: 'Tschechien',
    legalForms: [
      { value: 'OSVČ', label: 'OSVČ (Osoba samostatně výdělečně činná)' },
      { value: 's.r.o.', label: 's.r.o. (Společnost s ručením omezeným)' },
      { value: 'a.s.', label: 'a.s. (Akciová společnost)' },
      { value: 'v.o.s.', label: 'v.o.s. (Veřejná obchodní společnost)' },
      { value: 'k.s.', label: 'k.s. (Komanditní společnost)' },
    ],
  },
  {
    code: 'SK',
    name: 'Slowakei',
    legalForms: [
      { value: 'SZČO', label: 'SZČO (Samostatne zárobkovo činná osoba)' },
      { value: 's.r.o.', label: 's.r.o.' },
      { value: 'a.s.', label: 'a.s.' },
      { value: 'v.o.s.', label: 'v.o.s.' },
      { value: 'k.s.', label: 'k.s.' },
    ],
  },
  {
    code: 'HU',
    name: 'Ungarn',
    legalForms: [
      { value: 'EV', label: 'Egyéni vállalkozó (EV)' },
      { value: 'Kft', label: 'Kft (Korlátolt felelősségű társaság)' },
      { value: 'Rt', label: 'Rt / Nyrt (Részvénytársaság)' },
      { value: 'Bt', label: 'Bt (Betéti társaság)' },
      { value: 'Kkt', label: 'Kkt (Közkereseti társaság)' },
    ],
  },
  {
    code: 'RO',
    name: 'Rumänien',
    legalForms: [
      { value: 'PFA', label: 'PFA (Persoană fizică autorizată)' },
      { value: 'SRL', label: 'SRL' },
      { value: 'SA', label: 'SA' },
      { value: 'SNC', label: 'SNC' },
      { value: 'SCS', label: 'SCS' },
    ],
  },
  {
    code: 'BG',
    name: 'Bulgarien',
    legalForms: [
      { value: 'ET', label: 'ET (Едноличен търговец)' },
      { value: 'OOD', label: 'OOD / EOOD' },
      { value: 'AD', label: 'AD (Акционерно дружество)' },
      { value: 'SD', label: 'SD (Събирателно дружество)' },
      { value: 'KD', label: 'KD (Командитно дружество)' },
    ],
  },
  {
    code: 'HR',
    name: 'Kroatien',
    legalForms: [
      { value: 'Obrt', label: 'Obrt' },
      { value: 'd.o.o.', label: 'd.o.o.' },
      { value: 'd.d.', label: 'd.d.' },
      { value: 'j.d.o.o.', label: 'j.d.o.o.' },
    ],
  },
  {
    code: 'SI',
    name: 'Slowenien',
    legalForms: [
      { value: 's.p.', label: 's.p. (Samostojni podjetnik)' },
      { value: 'd.o.o.', label: 'd.o.o.' },
      { value: 'd.d.', label: 'd.d.' },
      { value: 'k.d.', label: 'k.d.' },
      { value: 'd.n.o.', label: 'd.n.o.' },
    ],
  },
  {
    code: 'DK',
    name: 'Dänemark',
    legalForms: [
      { value: 'Enkeltmandsvirksomhed', label: 'Enkeltmandsvirksomhed' },
      { value: 'ApS', label: 'ApS (Anpartsselskab)' },
      { value: 'A/S', label: 'A/S (Aktieselskab)' },
      { value: 'I/S', label: 'I/S (Interessentskab)' },
      { value: 'K/S', label: 'K/S (Kommanditselskab)' },
    ],
  },
  {
    code: 'SE',
    name: 'Schweden',
    legalForms: [
      { value: 'Enskild firma', label: 'Enskild firma' },
      { value: 'AB', label: 'AB (Aktiebolag)' },
      { value: 'HB', label: 'HB (Handelsbolag)' },
      { value: 'KB', label: 'KB (Kommanditbolag)' },
    ],
  },
  {
    code: 'FI',
    name: 'Finnland',
    legalForms: [
      { value: 'Toiminimi', label: 'Toiminimi' },
      { value: 'Oy', label: 'Oy (Osakeyhtiö)' },
      { value: 'Oyj', label: 'Oyj (Julkinen osakeyhtiö)' },
      { value: 'Ky', label: 'Ky (Kommandiittiyhtiö)' },
      { value: 'Ay', label: 'Ay (Avoin yhtiö)' },
    ],
  },
  {
    code: 'IE',
    name: 'Irland',
    legalForms: [
      { value: 'Sole Trader', label: 'Sole Trader' },
      { value: 'Ltd', label: 'Ltd (Private Limited Company)' },
      { value: 'PLC', label: 'PLC (Public Limited Company)' },
      { value: 'LP', label: 'LP (Limited Partnership)' },
    ],
  },
  {
    code: 'LU',
    name: 'Luxemburg',
    legalForms: [
      { value: 'EI', label: 'Entreprise individuelle' },
      { value: 'SARL', label: 'SARL (Société à responsabilité limitée)' },
      { value: 'SA', label: 'SA (Société anonyme)' },
      { value: 'SCS', label: 'SCS (Société en commandite simple)' },
      { value: 'SCA', label: 'SCA (Société en commandite par actions)' },
    ],
  },
  {
    code: 'GR',
    name: 'Griechenland',
    legalForms: [
      { value: 'Ατομική', label: 'Ατομική Επιχείρηση' },
      { value: 'ΕΠΕ', label: 'ΕΠΕ' },
      { value: 'ΑΕ', label: 'ΑΕ (Ανώνυμη Εταιρεία)' },
      { value: 'ΟΕ', label: 'ΟΕ (Ομόρρυθμη Εταιρεία)' },
      { value: 'ΙΚΕ', label: 'ΙΚΕ (Ιδιωτική Κεφαλαιουχική Εταιρεία)' },
    ],
  },
  {
    code: 'EE',
    name: 'Estland',
    legalForms: [
      { value: 'FIE', label: 'FIE (Füüsilisest isikust ettevõtja)' },
      { value: 'OÜ', label: 'OÜ (Osaühing)' },
      { value: 'AS', label: 'AS (Aktsiaselts)' },
    ],
  },
  {
    code: 'LV',
    name: 'Lettland',
    legalForms: [
      { value: 'IK', label: 'Individuālais komersants (IK)' },
      { value: 'SIA', label: 'SIA (Sabiedrība ar ierobežotu atbildību)' },
      { value: 'AS', label: 'AS (Akciju sabiedrība)' },
    ],
  },
  {
    code: 'LT',
    name: 'Litauen',
    legalForms: [
      { value: 'IĮ', label: 'IĮ (Individuali įmonė)' },
      { value: 'UAB', label: 'UAB (Uždaroji akcinė bendrovė)' },
      { value: 'AB', label: 'AB (Akcinė bendrovė)' },
      { value: 'TŪB', label: 'TŪB (Tikroji ūkinė bendrija)' },
      { value: 'KŪB', label: 'KŪB (Komanditinė ūkinė bendrija)' },
    ],
  },
  {
    code: 'MT',
    name: 'Malta',
    legalForms: [
      { value: 'Sole Trader', label: 'Sole Trader' },
      { value: 'Ltd', label: 'Ltd (Private Limited Company)' },
      { value: 'PLC', label: 'PLC (Public Limited Company)' },
    ],
  },
  {
    code: 'CY',
    name: 'Zypern',
    legalForms: [
      { value: 'Sole Trader', label: 'Sole Trader' },
      { value: 'Ltd', label: 'Ltd (Private Limited Company)' },
      { value: 'PLC', label: 'PLC (Public Limited Company)' },
    ],
  },
];

/**
 * Get legal forms for a specific country code.
 * Returns an empty array if the country code is not found.
 */
export function getLegalFormsByCountry(countryCode: string): LegalForm[] {
  const country = EU_COUNTRIES.find((c) => c.code === countryCode);
  return country?.legalForms ?? [];
}

/**
 * Get country name by code.
 */
export function getCountryName(countryCode: string): string {
  const country = EU_COUNTRIES.find((c) => c.code === countryCode);
  return country?.name ?? countryCode;
}

/**
 * Country calling codes (ITU-T E.164) for phone number placeholders.
 * Used to show the correct international dialling prefix when a country
 * falls back to a generic language translation (e.g. English).
 */
export const COUNTRY_PHONE_PREFIXES: Record<string, string> = {
  DE: '+49 123 456789',
  AT: '+43 1 234 5678',
  CH: '+41 44 123 45 67',
  NL: '+31 6 12345678',
  BE: '+32 2 123 45 67',
  FR: '+33 1 23 45 67 89',
  LU: '+352 621 123 456',
  IT: '+39 02 1234567',
  ES: '+34 912 345 678',
  PT: '+351 21 123 4567',
  PL: '+48 12 345 67 89',
  CZ: '+420 123 456 789',
  SK: '+421 2 1234 5678',
  HU: '+36 1 234 5678',
  RO: '+40 21 123 4567',
  BG: '+359 2 123 4567',
  HR: '+385 1 234 5678',
  SI: '+386 1 234 56 78',
  DK: '+45 12 34 56 78',
  SE: '+46 8 123 456 78',
  FI: '+358 9 123 4567',
  IE: '+353 1 234 5678',
  GR: '+30 21 0123 4567',
  EE: '+372 5123 4567',
  LV: '+371 2123 4567',
  LT: '+370 5 123 4567',
  MT: '+356 2123 4567',
  CY: '+357 22 123456',
};

/**
 * Get the phone placeholder for a specific country.
 * Returns the country-specific prefix example.
 */
export function getPhonePlaceholder(countryCode: string): string {
  return COUNTRY_PHONE_PREFIXES[countryCode] ?? '+' + countryCode + ' ...';
}

/**
 * Default country code for new registrations.
 */
export const DEFAULT_COUNTRY = 'DE';
