import { describe, expect, it } from 'vitest';
import {
  OPTIONS_LOCALISATION_CLIENTE, distanceMetres, filtrerParUnivers, fondDeCarte, formaterDistance, lienItineraire,
  trierParDistance, universBoutique, versBoutiquesCarte, type BoutiqueCarte,
} from './carte';

describe('US-24 : fond de carte', () => {
  it('avec la clé : CARTO Positron, clé dans l’adresse des tuiles, attribution OSM + CARTO', () => {
    const fond = fondDeCarte(' cle/123 ');
    expect(fond.fournisseur).toBe('carto');
    expect(fond.url).toBe('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=cle%2F123');
    expect(fond.sousDomaines).toBe('abcd');
    expect(fond.attribution).toContain('OpenStreetMap</a> contributors');
    expect(fond.attribution).toContain('href="https://www.openstreetmap.org/copyright"');
    expect(fond.attribution).toContain('CARTO');
  });

  it.each([undefined, '', '   '])('sans clé (%s) : tuiles OpenStreetMap, attribution OSM', cle => {
    const fond = fondDeCarte(cle);
    expect(fond.fournisseur).toBe('osm');
    expect(fond.url).toBe('https://tile.openstreetmap.org/{z}/{x}/{y}.png');
    expect(fond.attribution).toContain('OpenStreetMap</a> contributors');
    expect(fond.attribution).not.toContain('CARTO');
  });
});


const boutique = (id: string, nom: string, latitude: number | null, longitude: number | null, univers: BoutiqueCarte['univers'] = []): BoutiqueCarte =>
  ({ id, slug: id, nom, quartier: 'Centre', latitude, longitude, promos: 0, univers });

describe('US-24.3 : univers d’une boutique (même règle que le catalogue)', () => {
  it('déduits des couples catégorie / genre', () => {
    expect(universBoutique([{ categorie: 'Robes', genre: 'femme' }])).toEqual(['femme']);
    expect(universBoutique([{ categorie: 'T-shirts et polos', genre: 'mixte' }])).toEqual(['femme', 'homme']);
    expect(universBoutique([{ categorie: 'Chemises', genre: 'enfant' }, { categorie: 'Parfums', genre: 'femme' }])).toEqual(['enfant', 'beaute']);
    expect(universBoutique([])).toEqual([]);
    expect(universBoutique(null)).toEqual([]);
    expect(universBoutique([{ categorie: 1 }, 'x'])).toEqual([]);
  });
  it('lignes de boutiques_carte converties ; promos jamais négatives ; position incomplète = sans position', () => {
    expect(versBoutiquesCarte([
      { id: 'a', slug: 'a', nom: 'A', quartier: 'Q', latitude: 35.7, longitude: -0.6, promos_en_cours: 3, rayons: [{ categorie: 'Robes', genre: 'femme' }] },
      { id: 'b', slug: 'b', nom: 'B', quartier: 'Q', latitude: 35.7, longitude: null, promos_en_cours: null, rayons: [] },
    ])).toEqual([
      { id: 'a', slug: 'a', nom: 'A', quartier: 'Q', latitude: 35.7, longitude: -0.6, promos: 3, univers: ['femme'] },
      { id: 'b', slug: 'b', nom: 'B', quartier: 'Q', latitude: null, longitude: null, promos: 0, univers: [] },
    ]);
  });
  it('filtre : une boutique sans article n’apparaît que dans « Tous »', () => {
    const liste = [boutique('a', 'A', 35.7, -0.6, ['femme']), boutique('b', 'B', 35.7, -0.6)];
    expect(filtrerParUnivers(liste, null)).toHaveLength(2);
    expect(filtrerParUnivers(liste, 'femme').map(b => b.id)).toEqual(['a']);
    expect(filtrerParUnivers(liste, 'beaute')).toEqual([]);
  });
});

describe('US-24.3 : distances, calculées dans le navigateur', () => {
  it('valeurs connues (haversine)', () => {
    expect(distanceMetres({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 })).toBeCloseTo(111195, -1);
    expect(distanceMetres({ latitude: 35.7303, longitude: -0.5784 }, { latitude: 35.7303, longitude: -0.5784 })).toBe(0);
    // Boutique Nour (Akid Lotfi) → Maison Ilyes (Front de Mer) : ≈ 6,6 km
    const d = distanceMetres({ latitude: 35.7303, longitude: -0.5784 }, { latitude: 35.7034, longitude: -0.6436 });
    expect(d).toBeGreaterThan(6500); expect(d).toBeLessThan(6700);
  });
  it('tri du plus proche au plus éloigné, boutiques sans position écartées', () => {
    const origine = { latitude: 35.7, longitude: -0.64 };
    const tri = trierParDistance([boutique('loin', 'Loin', 35.73, -0.58), boutique('sans', 'Sans', null, null), boutique('pres', 'Près', 35.703, -0.643)], origine);
    expect(tri.map(b => b.id)).toEqual(['pres', 'loin']);
    expect(tri[0].distance).toBeLessThan(tri[1].distance);
  });
  it.each([
    [0, 'fr', '10 m'], [847, 'fr', '850 m'], [1100, 'fr', '1,1 km'], [2449, 'fr', '2,4 km'], [3000, 'fr', '3,0 km'], [12400, 'fr', '12 km'],
    [850, 'ar', '850 م'], [2400, 'ar', '2,4 كم'],
  ] as const)('%i m en %s : « %s »', (metres, langue, attendu) => {
    expect(formaterDistance(metres, langue)).toBe(attendu);
  });
  it('localisation de la cliente : précision du quartier, 15 s au plus', () => {
    expect(OPTIONS_LOCALISATION_CLIENTE).toEqual({ enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 });
  });
});

describe('US-24.3 : itinéraire (même lien que la vitrine), sans la position de la cliente', () => {
  it('vers la position de la boutique, sinon vers son adresse', () => {
    expect(lienItineraire({ latitude: 35.7303, longitude: -0.5784, quartier: 'Akid Lotfi' })).toBe('https://www.google.com/maps/dir/?api=1&destination=35.7303%2C-0.5784');
    expect(lienItineraire({ latitude: null, longitude: null, adresse: '12 rue X', quartier: 'Gambetta' })).toBe('https://www.google.com/maps/dir/?api=1&destination=12%20rue%20X%2C%20Gambetta%2C%20Oran%2C%20Alg%C3%A9rie');
    expect(lienItineraire({ latitude: 35.7303, longitude: -0.5784, quartier: 'Q' })).not.toContain('origin');
  });
});

describe("US-29.3 : itinéraire sans position, avec la ville", () => {
  it("« quartier, Tlemcen, Algérie » ; Oran par défaut (comme avant) ; ville inconnue : « quartier, Algérie »", async () => {
    const { lienItineraire } = await import("./carte");
    const base = { latitude: null, longitude: null, quartier: "Kiffane" };
    expect(decodeURIComponent(lienItineraire({ ...base, ville: "Tlemcen" }))).toContain("destination=Kiffane, Tlemcen, Algérie");
    expect(decodeURIComponent(lienItineraire(base))).toContain("destination=Kiffane, Oran, Algérie");
    expect(decodeURIComponent(lienItineraire({ ...base, ville: null }))).toContain("destination=Kiffane, Algérie");
  });
});
