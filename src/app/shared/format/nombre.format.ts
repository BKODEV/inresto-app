/**
 * Formatage des nombres venus de l'API.
 *
 * Les colonnes `decimal:n` d'Eloquent sont sérialisées en chaînes à précision
 * fixe : une quantité de 10 arrive en `"10.000"`, un montant de 1500 en
 * `"1500.00"`. Affichée telle quelle, la première se lit « dix mille » en
 * français, où le point sépare les milliers. Tout nombre venant de l'API doit
 * donc passer par ces helpers.
 *
 * Le maximum de décimales de chaque format est calé sur la précision de la
 * colonne correspondante (voir les migrations) : on n'affiche jamais moins de
 * décimales que la base n'en stocke, donc aucune valeur n'est arrondie à
 * l'écran. Un stock de 0,004 kg reste `0,004` au lieu de tomber à `0`.
 *
 * À l'inverse, aucun `minimumFractionDigits` n'est posé : `Intl` n'écrit la
 * partie décimale que si elle existe, donc pas de `1 500,00` inutile.
 */

/** Montants : `decimal(_, 2)` — prix, totaux, budgets, écarts de caisse. */
const MONTANT = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });

/** Quantités : `decimal(_, 3)` — stock, inventaires, recettes, réceptions. */
const QUANTITE = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 });

/** Coûts unitaires : `decimal(_, 4)` — PMP et prix d'achat à l'unité. */
const COUT_UNITAIRE = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 4 });

/** Pourcentages calculés : une décimale suffit à la lecture. */
const POURCENTAGE = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });

/**
 * Convertit une valeur d'API en nombre exploitable.
 *
 * Accepte les chaînes décimales (`"10.000"`) comme les nombres. Renvoie `null`
 * pour tout ce qui n'est pas un nombre fini — y compris la chaîne vide, qu'un
 * `Number('')` transformerait sinon en `0` trompeur.
 */
export function toNombre(valeur: unknown): number | null {
  if (valeur === null || valeur === undefined || valeur === '') {
    return null;
  }

  const nombre = typeof valeur === 'number' ? valeur : Number(valeur);

  return Number.isFinite(nombre) ? nombre : null;
}

/** Montant : jusqu'à 2 décimales (le FCFA n'en a aucune, elles sautent donc). */
export function formatMontant(valeur: unknown, siVide = '—'): string {
  const nombre = toNombre(valeur);

  return nombre === null ? siVide : MONTANT.format(nombre);
}

/** Quantité de stock, d'inventaire ou de recette : jusqu'à 3 décimales. */
export function formatQuantite(valeur: unknown, siVide = '—'): string {
  const nombre = toNombre(valeur);

  return nombre === null ? siVide : QUANTITE.format(nombre);
}

/** Coût unitaire ou PMP : jusqu'à 4 décimales, utiles sur les petites unités. */
export function formatCoutUnitaire(valeur: unknown, siVide = '—'): string {
  const nombre = toNombre(valeur);

  return nombre === null ? siVide : COUT_UNITAIRE.format(nombre);
}

/** Pourcentage déjà exprimé sur 100 (`12.5` → `12,5 %`). */
export function formatPourcentage(valeur: unknown, siVide = '—'): string {
  const nombre = toNombre(valeur);

  return nombre === null ? siVide : `${POURCENTAGE.format(nombre)} %`;
}
