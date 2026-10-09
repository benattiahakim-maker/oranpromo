// US-24 : fond de carte (un seul endroit pour changer de fournisseur, voir docs/architecture.md).
// CARTO Positron avec la clé publique NEXT_PUBLIC_CARTO_CLE (usage commercial gratuit jusqu'à 1 M de tuiles par mois) ;
// sans clé (développement sur le PC) : tuiles d'OpenStreetMap, à ne pas utiliser en production.
export type FondDeCarte = { url: string; attribution: string; sousDomaines: string; zoomMax: number; fournisseur: 'carto' | 'osm' };

const ATTRIBUTION_OSM = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export function fondDeCarte(cle: string | undefined): FondDeCarte {
  const propre = cle?.trim();
  if (propre) {
    return {
      fournisseur: 'carto',
      url: `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(propre)}`,
      attribution: `${ATTRIBUTION_OSM}, &copy; <a href="https://carto.com/attributions">CARTO</a>`,
      sousDomaines: 'abcd',
      zoomMax: 19,
    };
  }
  return { fournisseur: 'osm', url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: ATTRIBUTION_OSM, sousDomaines: 'abc', zoomMax: 19 };
}
