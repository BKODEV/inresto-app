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

/** Une ligne d'un ajout en lot : pas d'`ordre`, le lot se pose en fin de section. */
export interface CarteProduitLotLigne {
  produit_id: number;
  prix_vente: number;
  statut?: Statut;
}

export interface UpdateCarteProduitPayload {
  prix_vente?: number;
  statut?: Statut;
  ordre?: number;
}
