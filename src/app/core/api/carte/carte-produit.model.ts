import { Statut } from '../api.types';
import { Produit } from '../produit/produit.model';

/** Ligne carte_produit : un produit sur une carte, avec son prix de vente propre. */
export interface CarteProduit {
  id: number;
  carte_id: number;
  produit_id: number;
  prix_vente: string;
  statut: Statut;
  /** Ordre d'affichage dans sa section (= catégorie du produit). */
  ordre: number;
  produit?: Produit;
}

export interface CreateCarteProduitPayload {
  produit_id: number;
  prix_vente: number;
  statut?: Statut;
  ordre?: number;
}

export interface UpdateCarteProduitPayload {
  prix_vente?: number;
  statut?: Statut;
  ordre?: number;
}
