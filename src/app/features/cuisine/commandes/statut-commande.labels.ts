import { StatutCommandeFournisseur } from '../../../core/api/commande-fournisseur/commande-fournisseur.model';

/** Libellés métier des statuts de commande fournisseur. */
export const STATUT_COMMANDE_LABEL: Record<StatutCommandeFournisseur, string> = {
  brouillon: 'Brouillon',
  envoyee: 'Envoyée',
  partiellement_recue: 'Partiellement reçue',
  cloturee: 'Clôturée',
  annulee: 'Annulée',
};

/** Classe de badge (design-system) associée à chaque statut. */
export const STATUT_COMMANDE_BADGE: Record<StatutCommandeFournisseur, string> = {
  brouillon: 'badge-brouillon',
  envoyee: 'badge-info',
  partiellement_recue: 'badge-warning',
  cloturee: 'badge-success',
  annulee: 'badge-neutral',
};
