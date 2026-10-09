import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BORNES_ORAN, CENTRE_ORAN, MESSAGE_HORS_ORAN, MESSAGE_POSITION_INCOMPLETE, dansOran } from './position';

const migration = readFileSync(
  join(__dirname, '..', 'supabase', 'migrations', '20261010210000_carte_boutiques.sql'),
  'utf8',
);

describe('dansOran (US-24.1)', () => {
  it('accepte les boutiques actuelles et le centre de la carte', () => {
    expect(dansOran(35.7303, -0.5784)).toBe(true); // Boutique Nour
    expect(dansOran(35.7034, -0.6436)).toBe(true); // Maison Ilyes
    expect(dansOran(CENTRE_ORAN.latitude, CENTRE_ORAN.longitude)).toBe(true);
  });

  it('accepte les bornes exactes', () => {
    expect(dansOran(35.33, -1.15)).toBe(true);
    expect(dansOran(35.92, -0.1)).toBe(true);
  });

  it('refuse un point hors du rectangle', () => {
    expect(dansOran(35.329, -0.6)).toBe(false);
    expect(dansOran(35.921, -0.6)).toBe(false);
    expect(dansOran(35.7, -1.151)).toBe(false);
    expect(dansOran(35.7, -0.099)).toBe(false);
    expect(dansOran(36.7538, 3.0588)).toBe(false); // Alger
    expect(dansOran(-0.6, 35.7)).toBe(false); // latitude et longitude inversées
  });

  it('refuse NaN et l’infini', () => {
    expect(dansOran(Number.NaN, -0.6)).toBe(false);
    expect(dansOran(35.7, Number.POSITIVE_INFINITY)).toBe(false);
  });
});

describe('bornes identiques dans le site et dans la base', () => {
  it('la contrainte et le déclencheur utilisent le même rectangle que BORNES_ORAN', () => {
    const sansPrefixe = migration.replaceAll('new.', '');
    const attendu = `latitude between ${BORNES_ORAN.latMin} and ${BORNES_ORAN.latMax} and longitude between ${BORNES_ORAN.lngMin.toFixed(2)} and ${BORNES_ORAN.lngMax.toFixed(2)}`;
    // Contrainte de table + déclencheur (message clair), et aucun autre rectangle.
    expect(sansPrefixe.split(attendu).length - 1).toBe(2);
    expect(sansPrefixe.match(/latitude between/g)).toHaveLength(2);
  });

  it('les messages sont les mêmes que ceux de la base', () => {
    expect(migration).toContain(MESSAGE_HORS_ORAN.replace("'", "''"));
    expect(migration).toContain(MESSAGE_POSITION_INCOMPLETE);
  });
});
