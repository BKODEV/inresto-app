import { Statut } from '../api.types';
import { CategorieProduit } from '../categorie-produit/categorie-produit.model';
import { PointDeVente } from '../point-de-vente/point-de-vente.model';
import { MembreBrigade } from '../session-cuisine/session-cuisine.model';

/**
 * Poste de production d'un point de vente : « Entrées froides », « Chaud »…
 *
 * Taxonomie de PRODUCTION, distincte des catégories de produit qui sont une
 * taxonomie commerciale : une carte porte quinze catégories, un pass compte
 * trois postes, et « Cocktails » et « Softs » sont deux sections de carte pour
 * un seul bar. Les catégories s'y rattachent, chacune à un seul poste par point
 * de vente. Une catégorie non rattachée reste visible de tous les postes à
 * l'écran ; sur les bons de cuisine, elle part au poste par défaut.
 */
export interface PosteCuisine {
  id: number;
  point_de_vente_id: number;
  libelle: string;
  /** Ordre des onglets à l'écran : entrées avant plats avant desserts. */
  ordre: number;
  /**
   * Reçoit, sur les bons, ce que personne d'autre ne produit. Un seul par point
   * de vente, toujours actif ; le premier poste créé le devient.
   */
  par_defaut: boolean;
  statut: Statut;
  categories?: CategorieProduit[];
  /**
   * Qui tient le poste. C'est l'autre moitié de l'organisation du pass : les
   * catégories disent ce qu'on y produit, les membres qui le fait. Être
   * rattaché à au moins un poste d'un point de vente définit « être de la
   * cuisine » de ce point de vente.
   */
  membres?: MembreBrigade[];
  point_de_vente?: PointDeVente;
}

export interface CreatePosteCuisinePayload {
  point_de_vente_id: number;
  libelle: string;
  ordre?: number;
  par_defaut?: boolean;
  statut?: Statut;
  /** Identifiants de catégories ; l'API les pose par `sync`. */
  categories?: number[];
  /** Identifiants d'utilisateurs ; même `sync`, mêmes conditions. */
  membres?: string[];
}

export interface UpdatePosteCuisinePayload {
  libelle?: string;
  ordre?: number;
  /**
   * `true` seulement : désigner ce poste retire la charge à l'ancien. On ne la
   * retire pas « dans le vide » — l'API refuse `false` sur le poste par défaut.
   */
  par_defaut?: true;
  statut?: Statut;
  /**
   * Absent = rattachement inchangé ; tableau vide = on détache tout. Deux
   * intentions distinctes, à ne pas confondre en envoyant `[]` par défaut.
   */
  categories?: number[];
  /** Même règle absent/vide que `categories`. */
  membres?: string[];
}
