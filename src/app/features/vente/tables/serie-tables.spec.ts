import { LOT_MAX, genererNumeros, indexesEnDoublon } from './serie-tables';

describe('genererNumeros', () => {
  it('génère la plage demandée avec son préfixe', () => {
    expect(genererNumeros({ prefixe: 'T', debut: 1, fin: 3, chiffres: 1 })).toEqual([
      'T1',
      'T2',
      'T3',
    ]);
  });

  it('remplit de zéros pour obtenir des numéros de longueur constante', () => {
    // Sans remplissage, un tri alphabétique donnerait T1, T10, T2.
    const numeros = genererNumeros({ prefixe: 'T', debut: 1, fin: 10, chiffres: 2 });

    expect(numeros[0]).toBe('T01');
    expect(numeros.at(-1)).toBe('T10');
    expect([...numeros].sort()).toEqual(numeros);
  });

  it('accepte un préfixe vide comme un préfixe de zone', () => {
    expect(genererNumeros({ prefixe: '', debut: 8, fin: 9, chiffres: 1 })).toEqual(['8', '9']);
    expect(genererNumeros({ prefixe: 'TER-', debut: 1, fin: 2, chiffres: 1 })).toEqual([
      'TER-1',
      'TER-2',
    ]);
  });

  it('gère la plage d’une seule table', () => {
    expect(genererNumeros({ prefixe: 'T', debut: 5, fin: 5, chiffres: 2 })).toEqual(['T05']);
  });

  it('ne génère rien sur une plage inversée ou non numérique', () => {
    expect(genererNumeros({ prefixe: 'T', debut: 10, fin: 4, chiffres: 2 })).toEqual([]);
    expect(genererNumeros({ prefixe: 'T', debut: NaN, fin: 4, chiffres: 2 })).toEqual([]);
  });

  it('ne génère rien au-delà de la limite acceptée par l’API', () => {
    expect(genererNumeros({ prefixe: 'T', debut: 1, fin: LOT_MAX, chiffres: 3 })).toHaveLength(
      LOT_MAX,
    );
    expect(genererNumeros({ prefixe: 'T', debut: 1, fin: LOT_MAX + 1, chiffres: 3 })).toEqual([]);
  });
});

describe('indexesEnDoublon', () => {
  it('ne signale rien quand tous les numéros diffèrent', () => {
    expect(indexesEnDoublon(['T01', 'T02', 'T03'])).toEqual([]);
  });

  it('signale les deux lignes d’un doublon, casse ignorée', () => {
    // Le back refuse en `distinct:ignore_case` : « t01 » et « T01 » sont la
    // même table pour un serveur en salle.
    expect(indexesEnDoublon(['T01', 't01', 'T02']).sort()).toEqual([0, 1]);
  });

  it('ignore les lignes encore vides, qui ne sont pas des doublons', () => {
    expect(indexesEnDoublon(['', '', 'T01'])).toEqual([]);
  });
});
