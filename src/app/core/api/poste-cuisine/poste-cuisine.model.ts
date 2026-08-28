import { Statut } from '../api.types';
import { CategorieProduit } from '../categorie-produit/categorie-produit.model';
import { PointDeVente } from '../point-de-vente/point-de-vente.model';

/**
 * Poste de production d'un point de vente : « Entrées froides », « Chaud »…
 *
 * Taxonomie de PRODUCTION, distincte des catégories de produit qui sont une
 * taxonomie commerciale : une carte porte quinze catégories, un pass compte
 * trois postes, et « Cocktails » et « Softs » sont deux sections de carte pour
 * un seul bar. Les catégories s'y rattachent ; une catégorie non rattachée
 * reste visible de tous les postes.
 */
export interface PosteCuisine {
  id: number;
  point_de_vente_id: number;
  libelle: string;
  /** Ordre des onglets à l'écran : entrées avant plats avant desserts. */
  ordre: number;
  statut: Statut;
  categories?: CategorieProduit[];
  point_de_vente?: PointDeVente;
}

export interface CreatePosteCuisinePayload {
  point_de_vente_id: number;
  libelle: string;
  ordre?: number;
  statut?: Statut;
  /** Identifiants de catégories ; l'API les pose par `sync`. */
  categories?: number[];
}

export interface UpdatePosteCuisinePayload {
  libelle?: string;
  ordre?: number;
  statut?: Statut;
  /**
   * Absent = rattachement inchangé ; tableau vide = on détache tout. Deux
   * intentions distinctes, à ne pas confondre en envoyant `[]` par défaut.
   */
  categories?: number[];
}
