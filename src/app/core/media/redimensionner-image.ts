/** Côté le plus long, en pixels, d'une photo de plat après redimensionnement. */
const COTE_MAX_PAR_DEFAUT = 1200;

/** Qualité WebP : au-delà, le gain visuel ne justifie plus le poids. */
const QUALITE_PAR_DEFAUT = 0.82;

/**
 * Dimensions cibles conservant le ratio, sans jamais agrandir.
 *
 * Fonction pure et exportée pour être testable : le reste du module dépend du
 * canvas, absent de l'environnement de test.
 */
export function calculerDimensions(
  largeur: number,
  hauteur: number,
  max: number = COTE_MAX_PAR_DEFAUT,
): { largeur: number; hauteur: number } {
  const cotePlusLong = Math.max(largeur, hauteur);

  if (cotePlusLong <= max || cotePlusLong === 0) {
    return { largeur, hauteur };
  }

  const facteur = max / cotePlusLong;

  return {
    largeur: Math.round(largeur * facteur),
    hauteur: Math.round(hauteur * facteur),
  };
}

/**
 * Réduit et réencode une image en WebP avant l'envoi au serveur.
 *
 * Les photos de plats alimentent le menu public, consulté au téléphone et
 * souvent en réseau lent : une carte de quarante plats en photos d'appareil
 * pèserait des dizaines de mégaoctets. Le traitement se fait ici plutôt que sur
 * le serveur pour n'ajouter aucune dépendance ni extension PHP.
 *
 * En cas d'échec — navigateur sans canvas, format exotique, image illisible —
 * le fichier d'origine est renvoyé tel quel : mieux vaut téléverser lourd que
 * bloquer l'opérateur. La limite de taille du back reste le garde-fou.
 */
export function redimensionnerImage(
  fichier: File,
  max: number = COTE_MAX_PAR_DEFAUT,
  qualite: number = QUALITE_PAR_DEFAUT,
): Promise<File> {
  if (typeof document === 'undefined' || !fichier.type.startsWith('image/')) {
    return Promise.resolve(fichier);
  }

  return new Promise((resolve) => {
    const url = URL.createObjectURL(fichier);
    const image = new Image();

    const terminer = (resultat: File): void => {
      URL.revokeObjectURL(url);
      resolve(resultat);
    };

    image.onerror = () => terminer(fichier);
    image.onload = () => {
      const { largeur, hauteur } = calculerDimensions(image.width, image.height, max);

      // Le canvas est créé ici et jamais au chargement du module : ce fichier
      // est aussi évalué côté serveur au rendu SSR.
      const canvas = document.createElement('canvas');
      canvas.width = largeur;
      canvas.height = hauteur;

      const contexte = canvas.getContext('2d');
      if (contexte === null) {
        terminer(fichier);
        return;
      }

      contexte.drawImage(image, 0, 0, largeur, hauteur);

      canvas.toBlob(
        (blob) => {
          if (blob === null) {
            terminer(fichier);
            return;
          }
          terminer(new File([blob], remplacerExtension(fichier.name), { type: 'image/webp' }));
        },
        'image/webp',
        qualite,
      );
    };

    image.src = url;
  });
}

/** `photo-plat.JPG` → `photo-plat.webp` (le back nomme le fichier d'après l'extension). */
function remplacerExtension(nom: string): string {
  return `${nom.replace(/\.[^./\\]+$/, '')}.webp`;
}
