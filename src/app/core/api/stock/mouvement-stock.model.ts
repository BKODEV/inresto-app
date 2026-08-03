import { MatierePremiere } from '../matiere-premiere/matiere-premiere.model';
import { Site } from '../site/site.model';

export type MouvementType =
  | 'entree_reception'
  | 'sortie_vente'
  | 'perte'
  | 'casse'
  | 'offert'
  | 'repas_personnel'
  | 'correction_inventaire';

/** Sens du mouvement ; `neutre` = correction d'inventaire (valeur absolue posée). */
export type MouvementSens = 'entree' | 'sortie' | 'neutre';

/** Alias morphologiques de l'origine (cf. `Relation::morphMap` côté back). */
export type MouvementOrigine =
  | 'lignes_reception'
  | 'lignes_inventaire'
  | 'lignes_commande_client'
  | 'commandes_client'
  | 'annulations';

/**
 * Ligne du journal des mouvements. Immuable : aucune écriture depuis l'API.
 */
export interface MouvementStock {
  id: number;
  matiere_premiere_id: number;
  site_id: number;
  user_id: string | null;
  type: MouvementType;
  sens: MouvementSens;
  /** Toujours positive — c'est `sens` qui porte l'impact sur le stock. */
  quantite: string;
  /** PMP figé à l'instant du mouvement, pas le PMP courant. */
  pmp_au_moment: string;
  valeur: number;
  date_mouvement: string | null;
  reference_type: MouvementOrigine | string | null;
  reference_id: number | null;
  note: string | null;
  matiere_premiere?: MatierePremiere;
  site?: Site;
  /** Nom de l'auteur ; null sur les mouvements automatiques. */
  auteur?: string | null;
}
