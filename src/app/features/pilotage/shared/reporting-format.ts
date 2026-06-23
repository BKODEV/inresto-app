// Helpers de formatage partagés par les pages de pilotage. L'API renvoie des
// nombres bruts ; on formate en fr-FR (séparateurs), la devise restant gérée
// ailleurs (paramètres d'établissement).

const MONTANT = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const NOMBRE = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 });

export function formatMontant(value: number): string {
  return MONTANT.format(value ?? 0);
}

export function formatNombre(value: number): string {
  return NOMBRE.format(value ?? 0);
}

export function formatPct(value: number): string {
  return `${MONTANT.format(value ?? 0)} %`;
}
