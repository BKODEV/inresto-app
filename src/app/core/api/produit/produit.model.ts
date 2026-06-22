import { Statut } from '../api.types';
import { CategorieProduit } from '../categorie-produit/categorie-produit.model';
import { FicheTechnique } from '../fiche-technique/fiche-technique.model';

export interface Produit {
  id: number;
  categorie_id: number;
  libelle: string;
  description: string | null;
  est_menu: boolean;
  photo: string | null;
  allergenes: string | null;
  statut: Statut;
  categorie?: CategorieProduit;
  /**
   * Fiche technique active embarquée par `GET /produits/{id}` (null si le produit
   * n'en a pas encore). Absente sur les réponses de liste.
   */
  fiche_technique?: FicheTechnique | null;
}

export interface CreateProduitPayload {
  categorie_id: number;
  libelle: string;
  description?: string | null;
  est_menu?: boolean;
  photo?: string | null;
  allergenes?: string | null;
  statut?: Statut;
}

export interface UpdateProduitPayload extends Partial<CreateProduitPayload> {}
