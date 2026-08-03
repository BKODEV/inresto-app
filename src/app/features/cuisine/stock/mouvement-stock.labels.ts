import { MouvementType } from '../../../core/api/stock/mouvement-stock.model';

/** Libellés métier des types de mouvement de stock. */
export const MOUVEMENT_TYPE_LABEL: Record<MouvementType, string> = {
  entree_reception: 'Entrée réception',
  sortie_vente: 'Sortie vente',
  perte: 'Perte',
  casse: 'Casse',
  offert: 'Offert',
  repas_personnel: 'Repas personnel',
  correction_inventaire: 'Correction inventaire',
};

/** Classe de badge (design-system) associée à chaque type. */
export const MOUVEMENT_TYPE_BADGE: Record<MouvementType, string> = {
  entree_reception: 'badge-success',
  sortie_vente: 'badge-info',
  perte: 'badge-warning',
  casse: 'badge-warning',
  offert: 'badge-neutral',
  repas_personnel: 'badge-neutral',
  correction_inventaire: 'badge-brouillon',
};

/**
 * Libellés des origines polymorphes (`reference_type`), alignés sur les alias
 * déclarés dans `Relation::morphMap` côté serveur.
 */
export const MOUVEMENT_ORIGINE_LABEL: Record<string, string> = {
  lignes_reception: 'Réception',
  lignes_inventaire: 'Inventaire',
  lignes_commande_client: 'Vente',
  commandes_client: 'Commande client',
  annulations: 'Annulation',
};
