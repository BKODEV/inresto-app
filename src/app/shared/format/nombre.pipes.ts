import { Pipe, PipeTransform } from '@angular/core';

import {
  formatCoutUnitaire,
  formatMontant,
  formatPourcentage,
  formatQuantite,
} from './nombre.format';

/**
 * Pipes d'affichage des nombres d'API — voir {@link ./nombre.format.ts} pour la
 * règle de précision. L'argument optionnel remplace le tiret affiché quand la
 * valeur est absente : `{{ ligne.ecart | qte }}` donne `—`, `{{ x | qte: '0' }}`
 * donne `0`.
 *
 * Le choix du pipe se fait par nature de la valeur, pas par nom de champ :
 * `ecart` est un montant en caisse (2 décimales) et une quantité en inventaire
 * (3 décimales).
 */
@Pipe({ name: 'montant', standalone: true })
export class MontantPipe implements PipeTransform {
  transform(valeur: unknown, siVide = '—'): string {
    return formatMontant(valeur, siVide);
  }
}

@Pipe({ name: 'qte', standalone: true })
export class QuantitePipe implements PipeTransform {
  transform(valeur: unknown, siVide = '—'): string {
    return formatQuantite(valeur, siVide);
  }
}

@Pipe({ name: 'coutUnitaire', standalone: true })
export class CoutUnitairePipe implements PipeTransform {
  transform(valeur: unknown, siVide = '—'): string {
    return formatCoutUnitaire(valeur, siVide);
  }
}

@Pipe({ name: 'pct', standalone: true })
export class PourcentagePipe implements PipeTransform {
  transform(valeur: unknown, siVide = '—'): string {
    return formatPourcentage(valeur, siVide);
  }
}
