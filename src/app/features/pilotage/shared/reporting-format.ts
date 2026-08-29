import {
  formatMontant as montant,
  formatPourcentage as pourcentage,
  formatQuantite as quantite,
} from '../../../shared/format/nombre.format';

// Helpers de formatage des pages de pilotage. La règle de précision est commune
// à toute l'application — voir shared/format/nombre.format.ts. Ces alias restent
// parce que les templates de pilotage appellent des méthodes de composant plutôt
// que des pipes.
//
// Une valeur absente est traitée comme un zéro, et non comme un tiret : sur un
// tableau de bord, un indicateur sans mouvement vaut bien zéro.

export function formatMontant(value: number): string {
  return montant(value ?? 0, '0');
}

export function formatNombre(value: number): string {
  return quantite(value ?? 0, '0');
}

export function formatPct(value: number): string {
  return pourcentage(value ?? 0, '0');
}
