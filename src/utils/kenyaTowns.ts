/**
 * Comprehensive list of Kenyan towns and cities
 * Organized by county with postal codes and coordinates
 */

export interface KenyanTown {
  name: string;
  county: string;
  postalCode?: string;
  region?: string;
  lat: number;
  lng: number;
}

export const KENYAN_TOWNS: KenyanTown[] = [
  // Nairobi County
  { name: 'Nairobi CBD', county: 'Nairobi', postalCode: '00100', region: 'Central', lat: -1.286389, lng: 36.817223 },
  { name: 'Westlands', county: 'Nairobi', postalCode: '00800', region: 'Central', lat: -1.2642, lng: 36.8048 },
  { name: 'Kilimani', county: 'Nairobi', postalCode: '00100', region: 'Central', lat: -1.2917, lng: 36.7877 },
  { name: 'Karen', county: 'Nairobi', postalCode: '00502', region: 'South', lat: -1.3197, lng: 36.7062 },
  { name: 'Langata', county: 'Nairobi', postalCode: '00509', region: 'South', lat: -1.3482, lng: 36.7725 },
  { name: 'Lavington', county: 'Nairobi', postalCode: '00621', region: 'West', lat: -1.2785, lng: 36.7686 },
  { name: 'Parklands', county: 'Nairobi', postalCode: '00600', region: 'North', lat: -1.2615, lng: 36.8202 },
  { name: 'Gigiri', county: 'Nairobi', postalCode: '00621', region: 'North', lat: -1.2301, lng: 36.8052 },
  { name: 'Embakasi', county: 'Nairobi', postalCode: '00100', region: 'East', lat: -1.3192, lng: 36.9275 },
  { name: 'Upper Hill', county: 'Nairobi', postalCode: '00100', region: 'Central', lat: -1.2989, lng: 36.8144 },
  { name: 'Runda', county: 'Nairobi', postalCode: '00100', region: 'North', lat: -1.2185, lng: 36.8234 },
  { name: 'Muthaiga', county: 'Nairobi', postalCode: '00621', region: 'North', lat: -1.2300, lng: 36.8300 },
  { name: 'Mathare', county: 'Nairobi', postalCode: '00100', region: 'North', lat: -1.2750, lng: 36.8550 },
  { name: 'Kasarani', county: 'Nairobi', postalCode: '00100', region: 'North', lat: -1.2200, lng: 36.8900 },
  { name: 'Donholm', county: 'Nairobi', postalCode: '00100', region: 'East', lat: -1.3100, lng: 36.9000 },
  { name: 'Imara Daima', county: 'Nairobi', postalCode: '00100', region: 'South', lat: -1.3400, lng: 36.8700 },

  // Kiambu County
  { name: 'Kikuyu', county: 'Kiambu', postalCode: '00900', region: 'Central', lat: -1.2464, lng: 36.6633 },
  { name: 'Thika', county: 'Kiambu', postalCode: '01000', region: 'Central', lat: -1.0333, lng: 37.0693 },
  { name: 'Ruiru', county: 'Kiambu', postalCode: '00232', region: 'East', lat: -1.1461, lng: 36.9602 },
  { name: 'Kiambu Town', county: 'Kiambu', postalCode: '00104', region: 'Central', lat: -1.1670, lng: 36.8100 },
  { name: 'Muranga Road', county: 'Kiambu', postalCode: '00232', region: 'West', lat: -1.2000, lng: 36.7500 },
  { name: 'Limuru', county: 'Kiambu', postalCode: '00901', region: 'North', lat: -1.1050, lng: 36.6400 },
  { name: 'Karuri', county: 'Kiambu', postalCode: '00232', region: 'North', lat: -1.1800, lng: 36.6800 },
  { name: 'Lukenya', county: 'Kiambu', postalCode: '00232', region: 'East', lat: -1.1200, lng: 36.9800 },

  // Machakos County
  { name: 'Machakos Town', county: 'Machakos', postalCode: '90100', region: 'Central', lat: -1.5150, lng: 37.2673 },
  { name: 'Athi River', county: 'Machakos', postalCode: '90300', region: 'West', lat: -1.5236, lng: 37.0365 },
  { name: 'Kangundo', county: 'Machakos', postalCode: '90200', region: 'East', lat: -1.4950, lng: 37.5000 },
  { name: 'Kapiti', county: 'Machakos', postalCode: '90400', region: 'South', lat: -1.6800, lng: 37.1600 },
  { name: 'Matungulu', county: 'Machakos', postalCode: '90200', region: 'East', lat: -1.5500, lng: 37.4000 },

  // Kajiado County
  { name: 'Kajiado Town', county: 'Kajiado', postalCode: '89100', region: 'Central', lat: -1.8510, lng: 36.7755 },
  { name: 'Ongata Rongai', county: 'Kajiado', postalCode: '89100', region: 'North', lat: -1.3965, lng: 36.7607 },
  { name: 'Kitengela', county: 'Kajiado', postalCode: '89111', region: 'North', lat: -1.4820, lng: 36.9580 },
  { name: 'Ngong', county: 'Kajiado', postalCode: '00124', region: 'North', lat: -1.3578, lng: 36.6844 },

  // Nakuru County
  { name: 'Nakuru', county: 'Nakuru', postalCode: '20100', region: 'Central', lat: -0.3031, lng: 36.0800 },
  { name: 'Naivasha', county: 'Nakuru', postalCode: '20117', region: 'South', lat: -0.7171, lng: 36.4310 },
  { name: 'Kericho', county: 'Nakuru', postalCode: '20200', region: 'North', lat: -0.3690, lng: 35.2831 },
  { name: 'Njoro', county: 'Nakuru', postalCode: '20105', region: 'South', lat: -0.4500, lng: 36.1200 },
  { name: 'Subukia', county: 'Nakuru', postalCode: '20105', region: 'North', lat: -0.2300, lng: 36.0800 },

  // Kisumu County
  { name: 'Kisumu', county: 'Kisumu', postalCode: '40100', region: 'Central', lat: -0.1022, lng: 34.7617 },
  { name: 'Ahero', county: 'Kisumu', postalCode: '40400', region: 'North', lat: 0.0500, lng: 34.6000 },
  { name: 'Seme', county: 'Kisumu', postalCode: '40300', region: 'South', lat: -0.2000, lng: 34.5000 },

  // Mombasa County
  { name: 'Mombasa', county: 'Mombasa', postalCode: '80100', region: 'Central', lat: -4.0435, lng: 39.6682 },
  { name: 'Nyali', county: 'Mombasa', postalCode: '80107', region: 'North', lat: -3.9800, lng: 39.7600 },
  { name: 'Diani', county: 'Mombasa', postalCode: '80400', region: 'South', lat: -4.3000, lng: 39.5900 },
  { name: 'Kilifi', county: 'Mombasa', postalCode: '80500', region: 'North', lat: -3.6300, lng: 39.8500 },

  // Kilifi County
  { name: 'Kilifi Town', county: 'Kilifi', postalCode: '80500', region: 'Central', lat: -3.6300, lng: 39.8500 },
  { name: 'Malindi', county: 'Kilifi', postalCode: '80500', region: 'North', lat: -3.2167, lng: 40.1167 },
  { name: 'Watamu', county: 'Kilifi', postalCode: '80500', region: 'North', lat: -3.3700, lng: 40.0200 },

  // Lamu County
  { name: 'Lamu', county: 'Lamu', postalCode: '80500', region: 'Central', lat: -2.2667, lng: 40.9000 },
  { name: 'Kiunga', county: 'Lamu', postalCode: '80500', region: 'North', lat: -1.8500, lng: 41.2500 },

  // Tana River County
  { name: 'Hola', county: 'Tana River', postalCode: '70100', region: 'Central', lat: -2.4000, lng: 40.5200 },
  { name: 'Lindi', county: 'Tana River', postalCode: '70100', region: 'South', lat: -2.7500, lng: 40.4500 },

  // Garissa County
  { name: 'Garissa', county: 'Garissa', postalCode: '70100', region: 'Central', lat: -0.4606, lng: 39.6421 },
  { name: 'Ijara', county: 'Garissa', postalCode: '70100', region: 'West', lat: 0.1000, lng: 39.2000 },

  // Wajir County
  { name: 'Wajir', county: 'Wajir', postalCode: '70600', region: 'Central', lat: 1.7442, lng: 40.0562 },

  // Mandera County
  { name: 'Mandera', county: 'Mandera', postalCode: '70400', region: 'Central', lat: 3.6667, lng: 41.8667 },

  // Isiolo County
  { name: 'Isiolo', county: 'Isiolo', postalCode: '60100', region: 'Central', lat: 0.3515, lng: 37.5828 },

  // Samburu County
  { name: 'Samburu', county: 'Samburu', postalCode: '60500', region: 'Central', lat: 1.2500, lng: 37.5833 },

  // Laikipia County
  { name: 'Nanyuki', county: 'Laikipia', postalCode: '10400', region: 'Central', lat: 0.0033, lng: 37.0744 },
  { name: 'Nyahururu', county: 'Laikipia', postalCode: '20300', region: 'South', lat: 0.5333, lng: 36.3500 },
  { name: 'Timau', county: 'Laikipia', postalCode: '10400', region: 'North', lat: -0.1167, lng: 37.4000 },

  // Nyeri County
  { name: 'Nyeri', county: 'Nyeri', postalCode: '10100', region: 'Central', lat: -0.4167, lng: 36.9500 },
  { name: 'Karatina', county: 'Nyeri', postalCode: '10101', region: 'East', lat: -0.5167, lng: 37.2000 },
  { name: 'Murang\'a', county: 'Nyeri', postalCode: '10101', region: 'South', lat: -0.6667, lng: 37.1667 },

  // Muranga County
  { name: 'Murang\'a Town', county: 'Murang\'a', postalCode: '10200', region: 'Central', lat: -0.6667, lng: 37.1667 },
  { name: 'Kandara', county: 'Murang\'a', postalCode: '10202', region: 'South', lat: -0.7500, lng: 37.2500 },
  { name: 'Sagana', county: 'Murang\'a', postalCode: '10200', region: 'East', lat: -0.5833, lng: 37.3333 },

  // Kirinyaga County
  { name: 'Kerugoya', county: 'Kirinyaga', postalCode: '10300', region: 'Central', lat: -0.5000, lng: 37.4833 },
  { name: 'Kutus', county: 'Kirinyaga', postalCode: '10301', region: 'South', lat: -0.6667, lng: 37.3333 },

  // Embu County
  { name: 'Embu', county: 'Embu', postalCode: '40100', region: 'Central', lat: -0.5333, lng: 37.4500 },
  { name: 'Runyenjes', county: 'Embu', postalCode: '40101', region: 'South', lat: -0.7000, lng: 37.5000 },

  // Tharaka Nithi County
  { name: 'Chuka', county: 'Tharaka Nithi', postalCode: '60500', region: 'Central', lat: 0.1500, lng: 37.6500 },

  // Meru County
  { name: 'Meru Town', county: 'Meru', postalCode: '60100', region: 'Central', lat: 0.0500, lng: 37.6600 },
  { name: 'Nkubu', county: 'Meru', postalCode: '60100', region: 'East', lat: -0.0500, lng: 37.7500 },
  { name: 'Maua', county: 'Meru', postalCode: '60100', region: 'North', lat: 0.2500, lng: 37.5500 },

  // Uasin Gishu County
  { name: 'Eldoret', county: 'Uasin Gishu', postalCode: '30100', region: 'Central', lat: 0.5167, lng: 35.3000 },
  { name: 'Kapsabet', county: 'Uasin Gishu', postalCode: '30200', region: 'South', lat: 0.4000, lng: 35.2000 },

  // Elgeyo Marakwet County
  { name: 'Iten', county: 'Elgeyo Marakwet', postalCode: '30500', region: 'Central', lat: 0.7500, lng: 35.3667 },
  { name: 'Keiyo', county: 'Elgeyo Marakwet', postalCode: '30500', region: 'North', lat: 0.9333, lng: 35.4000 },

  // West Pokot County
  { name: 'Kapenguria', county: 'West Pokot', postalCode: '34300', region: 'Central', lat: 1.4000, lng: 35.1167 },

  // Baringo County
  { name: 'Kabarnet', county: 'Baringo', postalCode: '30700', region: 'Central', lat: 0.4833, lng: 35.7500 },
  { name: 'Marigat', county: 'Baringo', postalCode: '30700', region: 'North', lat: 0.8500, lng: 36.0000 },

  // Turkana County
  { name: 'Lodwar', county: 'Turkana', postalCode: '34100', region: 'Central', lat: 3.1167, lng: 35.6000 },
  { name: 'Kalokol', county: 'Turkana', postalCode: '34100', region: 'North', lat: 3.7667, lng: 35.9500 },

  // Homabay County
  { name: 'Homabay', county: 'Homabay', postalCode: '40400', region: 'Central', lat: -0.3333, lng: 34.4667 },

  // Siaya County
  { name: 'Siaya', county: 'Siaya', postalCode: '40600', region: 'Central', lat: 0.0650, lng: 34.2500 },

  // Kisii County
  { name: 'Kisii', county: 'Kisii', postalCode: '40200', region: 'Central', lat: -0.6833, lng: 34.7833 },
  { name: 'Kericho', county: 'Kisii', postalCode: '40200', region: 'North', lat: -0.3690, lng: 35.2831 },

  // Nyamira County
  { name: 'Nyamira', county: 'Nyamira', postalCode: '40500', region: 'Central', lat: -0.5500, lng: 34.9167 },

  // Migori County
  { name: 'Migori', county: 'Migori', postalCode: '40500', region: 'Central', lat: -1.0500, lng: 34.4667 },

  // Bomet County
  { name: 'Bomet', county: 'Bomet', postalCode: '20400', region: 'Central', lat: -0.8000, lng: 35.3000 },

  // Narok County
  { name: 'Narok', county: 'Narok', postalCode: '20500', region: 'Central', lat: -1.1167, lng: 35.8667 },
  { name: 'Nairobi', county: 'Narok', postalCode: '20500', region: 'North', lat: -1.3000, lng: 35.5000 },

  // Trans Nzoia County
  { name: 'Kitale', county: 'Trans Nzoia', postalCode: '30500', region: 'Central', lat: 0.9783, lng: 34.9767 },
  { name: 'Endebess', county: 'Trans Nzoia', postalCode: '30500', region: 'East', lat: 1.1500, lng: 35.2500 },

  // Bungoma County
  { name: 'Bungoma', county: 'Bungoma', postalCode: '50200', region: 'Central', lat: 0.5833, lng: 34.5667 },
  { name: 'Webuye', county: 'Bungoma', postalCode: '50300', region: 'East', lat: 0.6000, lng: 34.7500 },

  // Busia County
  { name: 'Busia', county: 'Busia', postalCode: '50400', region: 'Central', lat: 0.4667, lng: 34.1167 },
  { name: 'Malaba', county: 'Busia', postalCode: '50400', region: 'East', lat: 0.6500, lng: 34.3333 },

  // Vihiga County
  { name: 'Vihiga', county: 'Vihiga', postalCode: '50100', region: 'Central', lat: -0.0667, lng: 34.7500 },

  // Kakamega County
  { name: 'Kakamega', county: 'Kakamega', postalCode: '50000', region: 'Central', lat: 0.2833, lng: 34.7500 },
];

/**
 * Get all unique town names sorted alphabetically
 */
export function getAllKenyanTowns(): string[] {
  return KENYAN_TOWNS.map(town => town.name)
    .filter((name, index, array) => array.indexOf(name) === index)
    .sort();
}

/**
 * Get towns by county
 */
export function getTownsByCounty(county: string): KenyanTown[] {
  return KENYAN_TOWNS.filter(town => town.county.toLowerCase() === county.toLowerCase());
}

/**
 * Get postal code for a town
 */
export function getPostalCodeForTown(townName: string): string | undefined {
  const town = KENYAN_TOWNS.find(t => t.name.toLowerCase() === townName.toLowerCase());
  return town?.postalCode;
}

/**
 * Get county for a town
 */
export function getCountyForTown(townName: string): string | undefined {
  const town = KENYAN_TOWNS.find(t => t.name.toLowerCase() === townName.toLowerCase());
  return town?.county;
}
