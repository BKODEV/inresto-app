/**
 * Génération d'une série de numéros de table.
 *
 * Extrait du composant pour être testable seul : c'est la seule vraie logique
 * du tiroir de création en lot, et celle où une régression passerait inaperçue
 * à l'œil (un préfixe perdu, un zéro de remplissage en trop).
 */

export interface ParametresSerie {
  prefixe: string;
  debut: number;
  fin: number;
  chiffres: number;
}

/** Borne haute alignée sur le `max:100` du back : au-delà, l'API refuse. */
export const LOT_MAX = 100;

/**
 * Numéros générés pour la plage demandée, dans l'ordre.
 *
 * Le remplissage à zéro n'est pas cosmétique : il donne des numéros de longueur
 * constante, qui se trient correctement partout, y compris là où le tri est
 * alphabétique (l'API ordonne par `numero`, une colonne texte).
 *
 * Renvoie un tableau vide si la plage est invalide ou dépasse {@link LOT_MAX} —
 * l'appelant affiche alors le compteur à zéro plutôt qu'une erreur brutale
 * pendant que l'utilisateur tape encore.
 */
export function genererNumeros({ prefixe, debut, fin, chiffres }: ParametresSerie): string[] {
  if (!Number.isFinite(debut) || !Number.isFinite(fin) || fin < debut) {
    return [];
  }
  if (fin - debut + 1 > LOT_MAX) {
    return [];
  }

  const numeros: string[] = [];
  for (let i = debut; i <= fin; i++) {
    numeros.push(`${prefixe}${String(i).padStart(Math.max(chiffres, 1), '0')}`);
  }
  return numeros;
}

/**
 * Index des lignes dont le numéro apparaît plusieurs fois, casse ignorée.
 *
 * Doublon repéré avant l'envoi : le back le refuserait (`distinct:ignore_case`)
 * mais faire l'aller-retour pour une faute visible à l'écran est inutile.
 */
export function indexesEnDoublon(numeros: string[]): number[] {
  const vus = new Map<string, number[]>();

  numeros.forEach((numero, index) => {
    const cle = numero.trim().toLowerCase();
    if (cle === '') {
      return;
    }
    vus.set(cle, [...(vus.get(cle) ?? []), index]);
  });

  return [...vus.values()].filter((indexes) => indexes.length > 1).flat();
}
