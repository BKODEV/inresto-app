import { ModeDePaiement } from './mode-de-paiement.model';

/**
 * Modes proposables à la caisse : actifs, dans l'ordre voulu.
 *
 * L'API trie déjà, mais le front reçoit aussi des listes filtrées ou remaniées
 * localement — trier ici rend l'ordre indépendant du chemin par lequel la liste
 * est arrivée.
 */
export function modesProposables(modes: ModeDePaiement[]): ModeDePaiement[] {
  return modes.filter((m) => m.statut === 'actif').sort((a, b) => a.ordre - b.ordre || a.id - b.id);
}

/**
 * Mode présélectionné dans le tiroir de règlement : le premier mode EN TIROIR.
 *
 * La présélection se déduit du sens métier et non d'une position d'affichage.
 * Remonter « Virement » en tête pour le confort visuel ne doit pas changer ce
 * que la caisse propose par défaut — c'est le champ qui décide où l'argent est
 * compté, et il présélectionnait jusqu'ici le premier élément d'une liste que
 * PostgreSQL renvoyait sans ordre garanti.
 *
 * À défaut de mode en tiroir, le premier actif : mieux vaut une proposition
 * qu'un formulaire vide, la caisse affichant de toute façon le mode retenu.
 */
export function modeParDefaut(modes: ModeDePaiement[]): number {
  const proposables = modesProposables(modes);

  return (proposables.find((m) => m.compte_en_caisse) ?? proposables[0])?.id ?? 0;
}
