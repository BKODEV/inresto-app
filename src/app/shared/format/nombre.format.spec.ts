import {
  formatCoutUnitaire,
  formatMontant,
  formatPourcentage,
  formatQuantite,
  toNombre,
} from './nombre.format';

/**
 * `Intl` insère une espace insécable étroite (U+202F) comme séparateur de
 * milliers ; les attentes la reproduisent explicitement pour que l'échec soit
 * lisible si la locale change.
 */
const ESPACE_FINE = ' ';

describe('toNombre', () => {
  it('parse les chaînes décimales renvoyées par les casts Eloquent', () => {
    expect(toNombre('10.000')).toBe(10);
    expect(toNombre('1500.50')).toBe(1500.5);
    expect(toNombre('0.0125')).toBe(0.0125);
  });

  it('laisse passer les nombres tels quels', () => {
    expect(toNombre(10)).toBe(10);
    expect(toNombre(0)).toBe(0);
  });

  it('renvoie null pour les valeurs absentes, chaîne vide comprise', () => {
    expect(toNombre(null)).toBeNull();
    expect(toNombre(undefined)).toBeNull();
    // Sans ce cas, Number('') vaudrait 0 et afficherait un faux zéro.
    expect(toNombre('')).toBeNull();
    expect(toNombre('abc')).toBeNull();
  });
});

describe('formatQuantite', () => {
  it('n’ajoute pas de décimale à un nombre entier', () => {
    // Le bug d’origine : "10.000" se lisait « dix mille » en français.
    expect(formatQuantite('10.000')).toBe('10');
  });

  it('écrit la décimale avec une virgule', () => {
    expect(formatQuantite('10.500')).toBe('10,5');
  });

  it('conserve les 3 décimales stockées, sans en arrondir aucune', () => {
    expect(formatQuantite('0.125')).toBe('0,125');
    // Un stock non nul ne doit jamais s’afficher à zéro.
    expect(formatQuantite('0.004')).toBe('0,004');
  });

  it('sépare les milliers par une espace, jamais par un point', () => {
    expect(formatQuantite('1500.000')).toBe(`1${ESPACE_FINE}500`);
  });

  it('distingue le zéro de l’absence de valeur', () => {
    expect(formatQuantite('0.000')).toBe('0');
    expect(formatQuantite(null)).toBe('—');
  });
});

describe('formatMontant', () => {
  it('supprime les centimes inutiles', () => {
    expect(formatMontant('1500.00')).toBe(`1${ESPACE_FINE}500`);
  });

  it('garde les centimes réels', () => {
    expect(formatMontant('1500.25')).toBe(`1${ESPACE_FINE}500,25`);
  });

  it('gère les montants négatifs des écarts de caisse', () => {
    expect(formatMontant('-250.50')).toContain('250,5');
  });
});

describe('formatCoutUnitaire', () => {
  it('ne montre les 4 décimales que lorsqu’elles portent de l’information', () => {
    expect(formatCoutUnitaire('1250.7500')).toBe(`1${ESPACE_FINE}250,75`);
    expect(formatCoutUnitaire('0.0125')).toBe('0,0125');
  });
});

describe('formatPourcentage', () => {
  it('arrondit à une décimale et suffixe le symbole', () => {
    expect(formatPourcentage(32.44)).toBe('32,4 %');
    expect(formatPourcentage(30)).toBe('30 %');
  });
});
