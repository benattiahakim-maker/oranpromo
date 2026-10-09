import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BORNES_ORAN, CENTRE_ORAN, MESSAGE_HORS_ORAN, MESSAGE_LIEN_COURT, MESSAGE_LIEN_INTROUVABLE, MESSAGE_POSITION_INCOMPLETE,
  OPTIONS_LOCALISATION_BOUTIQUE, arrondirCoordonnee, coordonneesDepuisTexte, dansOran, formaterPosition, lireCoordonnee,
  messageLecture, textePrecision, validerPosition,
} from './position';

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


describe('US-24.2 : lire un lien Google Maps, dans le navigateur, sans réseau', () => {
  afterEach(() => vi.unstubAllGlobals());
  const attendu = { ok: true, latitude: 35.69712, longitude: -0.63375 };

  it.each([
    ['vue « @ »', 'https://www.google.com/maps/@35.69712,-0.63375,17z'],
    ['lieu', 'https://www.google.com/maps/place/Boutique+Nour/@35.6,-0.7,15z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d35.69712!4d-0.63375!16s'],
    ['?q=', 'https://maps.google.com/?q=35.69712,-0.63375'],
    ['?ll=', 'https://maps.google.fr/maps?ll=35.69712,-0.63375&z=17'],
    ['query=', 'https://www.google.com/maps/search/?api=1&query=35.69712%2C-0.63375'],
    ['destination=', 'https://www.google.dz/maps/dir/?api=1&destination=35.69712,-0.63375'],
    ['sans https', 'google.com/maps/@35.69712,-0.63375,17z'],
    ['texte de partage autour du lien', 'Boutique Nour https://www.google.com/maps/@35.69712,-0.63375,17z merci'],
    ['deux nombres (point)', '35.69712, -0.63375'],
    ['deux nombres (virgule décimale)', '35,69712 -0,63375'],
    ['deux nombres (point-virgule, vrai signe moins)', '35,69712 ; −0,63375'],
  ])('%s', (_cas, texte) => {
    expect(coordonneesDepuisTexte(texte)).toEqual(attendu);
  });

  it('priorité à l’épingle du lieu (!3d!4d) sur le centre de la vue (@)', () => {
    const lecture = coordonneesDepuisTexte('https://www.google.com/maps/place/X/@35.70000,-0.64000,16z/data=!4m5!3m4!8m2!3d35.69712!4d-0.63375');
    expect(lecture).toEqual(attendu);
  });

  it.each(['https://maps.app.goo.gl/Ab12Cd34', 'maps.app.goo.gl/Ab12Cd34', 'https://goo.gl/maps/Ab12Cd34', 'Regarde https://maps.app.goo.gl/Ab12Cd34?g_st=iw'])(
    'lien court %s : refusé, jamais suivi (aucun appel réseau)',
    texte => {
      const espion = vi.fn();
      vi.stubGlobal('fetch', espion);
      vi.stubGlobal('XMLHttpRequest', vi.fn());
      expect(coordonneesDepuisTexte(texte)).toEqual({ ok: false, raison: 'lien_court' });
      expect(espion).not.toHaveBeenCalled();
      expect(XMLHttpRequest).not.toHaveBeenCalled();
      expect(messageLecture('lien_court')).toBe(MESSAGE_LIEN_COURT);
    },
  );

  it.each(['', 'bonjour', 'https://example.com/@35.69712,-0.63375', 'https://www.google.com/search?q=35.69712,-0.63375', 'https://www.google.com/maps/place/Oran', '135.5, -0.6', '35.69712'])(
    'texte sans position lisible « %s » : introuvable',
    texte => {
      expect(coordonneesDepuisTexte(texte)).toEqual({ ok: false, raison: 'introuvable' });
      expect(messageLecture('introuvable')).toBe(MESSAGE_LIEN_INTROUVABLE);
    },
  );

  it('position hors de la wilaya d’Oran : refusée avec le message de la base', () => {
    expect(coordonneesDepuisTexte('https://www.google.com/maps/@36.75380,3.05880,15z')).toEqual({ ok: false, raison: 'hors_oran' });
    expect(messageLecture('hors_oran')).toBe(MESSAGE_HORS_ORAN);
  });

  it('arrondit à 6 décimales', () => {
    expect(coordonneesDepuisTexte('35.6971234567, -0.6337549999')).toEqual({ ok: true, latitude: 35.697123, longitude: -0.633755 });
    expect(arrondirCoordonnee(35.12345649)).toBe(35.123456);
  });
});

describe('US-24.2 : validation et affichage de la position', () => {
  it('les deux ou aucune, dans Oran, arrondie', () => {
    expect(validerPosition(null, null)).toEqual({ ok: true, latitude: null, longitude: null });
    expect(validerPosition(35.6971234, -0.6337549)).toEqual({ ok: true, latitude: 35.697123, longitude: -0.633755 });
    expect(validerPosition(35.7, null)).toEqual({ ok: false, message: MESSAGE_POSITION_INCOMPLETE });
    expect(validerPosition(undefined, -0.6)).toEqual({ ok: false, message: MESSAGE_POSITION_INCOMPLETE });
    expect(validerPosition(36.75, 3.05)).toEqual({ ok: false, message: MESSAGE_HORS_ORAN });
    expect(validerPosition(Number.NaN, -0.6)).toEqual({ ok: false, message: MESSAGE_HORS_ORAN });
  });

  it('champs saisis à la main : virgule ou point, vrai signe moins', () => {
    expect(lireCoordonnee('')).toBeNull();
    expect(lireCoordonnee(' 35,697120 ')).toBe(35.69712);
    expect(lireCoordonnee('−0.63375')).toBe(-0.63375);
    expect(lireCoordonnee('35°41′')).toBeNaN();
  });

  it('format « 35,697120 · −0,633750 »', () => {
    expect(formaterPosition({ latitude: 35.69712, longitude: -0.63375 })).toBe('35,697120 · −0,633750');
  });

  it('précision affichée, avertissement au-delà de 100 m', () => {
    expect(textePrecision(11.6)).toEqual({ texte: 'Position trouvée · précision ± 12 m', avertissement: null });
    expect(textePrecision(100).avertissement).toBeNull();
    expect(textePrecision(350).avertissement).toBe('Position peu précise (± 350 m) : activez la localisation précise ou le GPS, approchez-vous de la porte, ou déplacez l’épingle.');
  });

  it('localisation du commerçant : précise, jamais en cache, 20 s au plus', () => {
    expect(OPTIONS_LOCALISATION_BOUTIQUE).toEqual({ enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
  });
});
