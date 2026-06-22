import { MatierePremiere } from '../matiere-premiere/matiere-premiere.model';
import { SousRecette } from '../sous-recette/sous-recette.model';
import { UniteDeMesure } from '../unite-de-mesure/unite-de-mesure.model';

export type StatutFicheTechnique = 'active' | 'archivee';

/** Produit minimal renvoyé via la fiche (pas d'endpoint produits dédié pour l'instant). */
export interface Produit {
  id: number;
  categorie_id: number;
  libelle: string;
  statut: string;
}

export interface LigneFicheTechnique {
  id: number;
  fiche_technique_id: number;
  matiere_premiere_id: number;
  unite_id: number;
  quantite: string;
  matiere_premiere?: MatierePremiere;
  unite?: UniteDeMesure;
}

export interface LigneFicheTechniqueSousRecette {
  id: number;
  fiche_technique_id: number;
  sous_recette_id: number;
  quantite: string;
  sous_recette?: SousRecette;
}

export interface FicheTechnique {
  id: number;
  produit_id: number;
  version: number;
  statut: StatutFicheTechnique;
  /** Coût de référence (meilleur prix catalogue), recalculé, lecture seule. */
  cout_matiere: string;
  updated_by: string | null;
  produit?: Produit;
  lignes_matieres?: LigneFicheTechnique[];
  lignes_sous_recettes?: LigneFicheTechniqueSousRecette[];
  created_at: string;
  updated_at: string;
}

export interface LigneMatierePayload {
  matiere_premiere_id: number;
  unite_id: number;
  quantite: number;
}

export interface LigneSousRecettePayload {
  sous_recette_id: number;
  quantite: number;
}

export interface FicheTechniquePayload {
  produit_id: number;
  lignes_matieres: LigneMatierePayload[];
  lignes_sous_recettes: LigneSousRecettePayload[];
}
