import { calculerDimensions, redimensionnerImage } from './redimensionner-image';

/**
 * Seul `calculerDimensions` est couvert : l'encodage repose sur le canvas, que
 * jsdom n'implémente pas (`getContext('2d')` y renvoie `null`). Le dernier test
 * vérifie donc la garantie qui rend cette absence de couverture acceptable — le
 * repli sur le fichier d'origine.
 */
describe('calculerDimensions', () => {
  it('laisse une image plus petite que la limite intacte', () => {
    expect(calculerDimensions(800, 600, 1200)).toEqual({ largeur: 800, hauteur: 600 });
  });

  it('ramène le côté le plus long à la limite en paysage', () => {
    expect(calculerDimensions(4000, 3000, 1200)).toEqual({ largeur: 1200, hauteur: 900 });
  });

  it('ramène le côté le plus long à la limite en portrait', () => {
    expect(calculerDimensions(3000, 4000, 1200)).toEqual({ largeur: 900, hauteur: 1200 });
  });

  it('traite le cas carré sans dérive de ratio', () => {
    expect(calculerDimensions(2400, 2400, 1200)).toEqual({ largeur: 1200, hauteur: 1200 });
  });

  it('n’agrandit jamais une image déjà petite', () => {
    expect(calculerDimensions(300, 200, 1200)).toEqual({ largeur: 300, hauteur: 200 });
  });

  it('conserve le ratio à l’arrondi près', () => {
    const { largeur, hauteur } = calculerDimensions(1999, 1000, 1200);

    expect(largeur).toBe(1200);
    // 1000 × (1200 / 1999) = 600,3
    expect(hauteur).toBe(600);
  });

  it('ne divise pas par zéro sur une image sans dimensions', () => {
    expect(calculerDimensions(0, 0, 1200)).toEqual({ largeur: 0, hauteur: 0 });
  });
});

describe('redimensionnerImage', () => {
  it('rend le fichier d’origine quand ce n’est pas une image', async () => {
    const fichier = new File(['%PDF'], 'recette.pdf', { type: 'application/pdf' });

    await expect(redimensionnerImage(fichier)).resolves.toBe(fichier);
  });
});
