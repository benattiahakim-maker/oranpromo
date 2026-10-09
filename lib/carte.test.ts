import { describe, expect, it } from 'vitest';
import { fondDeCarte } from './carte';

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
