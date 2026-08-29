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

/**
 * Nature d'un point critique. Liste fermée côté API : un contrôle qui ne
 * distingue pas un allergène d'une température de cuisson ne contrôle rien.
 */
export type TypePointCritique =
  'cuisson' | 'refroidissement' | 'conservation' | 'allergene' | 'hygiene' | 'autre';

/** Une étape de production, dans l'ordre où on l'exécute. */
export interface EtapeFicheTechnique {
  id: number;
  ordre: number;
  description: string;
  /** Nulle quand l'étape n'a pas de durée qu'on veuille chiffrer. */
  duree_minutes: number | null;
}

export interface MaterielFicheTechnique {
  id: number;
  ordre: number;
  libelle: string;
}

export interface PointCritiqueFicheTechnique {
  id: number;
  ordre: number;
  type: TypePointCritique;
  type_libelle: string;
  description: string;
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
  /** Méthodologie — versionnée avec la fiche, comme le coût. */
  etapes?: EtapeFicheTechnique[];
  materiels?: MaterielFicheTechnique[];
  points_critiques?: PointCritiqueFicheTechnique[];
  /** Somme des étapes chiffrées ; null si aucune ne l'est. */
  duree_totale_minutes?: number | null;
  created_at: string;
  updated_at: string;
}

export interface LigneMatierePayload {
  matiere_premiere_id: number;
  // Pas d'unité : le serveur impose l'unité de stockage de la matière.
  quantite: number;
}

export interface LigneSousRecettePayload {
  sous_recette_id: number;
  quantite: number;
}

/** L'ordre vient de la position dans le tableau : le serveur numérote. */
export interface EtapePayload {
  description: string;
  duree_minutes?: number | null;
}

export interface PointCritiquePayload {
  type: TypePointCritique;
  description: string;
}

export interface FicheTechniquePayload {
  produit_id: number;
  lignes_matieres: LigneMatierePayload[];
  lignes_sous_recettes: LigneSousRecettePayload[];
  etapes?: EtapePayload[];
  materiels?: string[];
  points_critiques?: PointCritiquePayload[];
}
