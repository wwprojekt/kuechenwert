// Comprehensive manufacturer-to-model mapping
export const manufacturerModels: Record<string, string[]> = {
  // Premium
  'Concorde': ['Liner', 'Charisma', 'Carver', 'Cruiser', 'Credo'],
  'Morelo': ['Palace', 'Grand Empire', 'Loft', 'Home', 'Manor', 'First Class'],
  'Niesmann+Bischoff': ['Arto', 'Smove', 'Flair', 'iSmove', 'Clou'],
  'Carthago': ['Chic', 'Liner', 'C-Tourer', 'Malibu', 'C-Compactline'],
  // Major German brands
  'Hymer': ['B-Klasse', 'Exsis', 'ML-T', 'Duomobil', 'Grand Canyon', 'Tramp', 'Nova', 'Yellowstone'],
  'Dethleffs': ['Globebus', 'Pulse', 'Just Go', 'Trend', 'Esprit', 'Advantage', 'Globetrotter'],
  'Knaus': ['BoxStar', 'Van TI', 'Sky Wave', 'L!ve', 'Sun TI', 'Sport', 'Traveller'],
  'Bürstner': ['Lyseo', 'Nexxo', 'Ixeo', 'Elegance', 'Viseo', 'Travel Van', 'Copa'],
  'Hobby': ['Optima', 'Siesta', 'Vantana', 'Maxia', 'Excellent'],
  'Adria': ['Twin', 'Coral', 'Sonic', 'Matrix', 'Compact', 'Supreme'],
  'Carado': ['Vlow', 'CV', 'I', 'T', 'A'],
  'Weinsberg': ['CaraHome', 'CaraCompact', 'CaraBus', 'CaraTour', 'CaraSuite'],
  'Sunlight': ['Cliff', 'T-Series', 'V-Series', 'I-Series', 'A-Series'],
  'Eura Mobil': ['Integra', 'Profila', 'Activa', 'Terrestra', 'Van'],
  'Frankia': ['Platin', 'Titan', 'I-Line', 'M-Line', 'F-Line'],
  'LMC': ['Cruiser', 'Explorer', 'Element', 'Breezer', 'Liberty'],
  // Italian brands
  'Laika': ['Kosmo', 'Ecovip', 'Kreos'],
  'Roller Team': ['Kronos', 'Pegaso', 'Zefiro', 'Livingstone'],
  'Rimor': ['Seal', 'Evo', 'Kayak', 'Superbrig'],
  // French brands
  'Rapido': ['Serie 6', 'Serie 8', 'Serie 9', 'Serie M', 'Distinction'],
  'Chausson': ['Welcome', 'Titanium', 'Flash', 'Twist', 'X'],
  'Pilote': ['Galaxy', 'Pacific', 'Emotion', 'Reference', 'Van'],
  'Challenger': ['Genesis', 'Graphite', 'Sirius', 'Combo'],
  'Benimar': ['Mileo', 'Primero', 'Tessoro', 'Amphitryon'],
  // Camper Vans
  'Mercedes-Benz': ['Marco Polo', 'Sprinter', 'Vito', 'V-Klasse'],
  'Volkswagen': ['California', 'Grand California', 'Crafter', 'T6.1', 'ID.Buzz'],
  'Pössl': ['Summit', 'Roadcamp', 'Roadstar', 'Campster', 'Vanster', 'D-Line'],
  'Globecar': ['Roadscout', 'Campscout', 'Summit', 'Globescout', 'Fortscout'],
  'Karmann': ['Davis', 'Dexter', 'Colorado'],
  'Westfalia': ['Columbus', 'James Cook', 'Amundsen', 'Kelsey', 'Sven Hedin'],
  'La Strada': ['Avanti', 'Nova', 'Regent', 'Fiera'],
  'Malibu': ['Van', 'Genius', 'Family', 'Charming'],
  'CI': ['Magis', 'Nacre', 'Kyros', 'Horon'],
  'Etrusco': ['CV', 'T', 'I', 'A'],
  'Forster': ['Van', 'Livin Up', 'T-Series', 'I-Series'],
  'Autotrail': ['F-Line', 'V-Line', 'Expedition', 'Scout'],
  'Bailey': ['Adamo', 'Alliance', 'Autograph'],
  'Phoenix': ['Alkoven', 'Top-Liner', 'Maxi-Liner'],
  'Andere': ['Sonstiges Modell']
};

// Sorted manufacturer list
export const popularManufacturers = Object.keys(manufacturerModels).sort();

// Body type options matching the motorhome_body_type enum
export const bodyTypes = [
  'Teilintegriert',
  'Alkoven',
  'Vollintegriert',
  'Kastenwagen',
  'Campingbus',
] as const;

// Vehicle type options
export const vehicleTypes = [
  { value: 'Wohnmobil', label: 'Wohnmobil' },
  { value: 'Wohnwagen', label: 'Wohnwagen' },
] as const;
