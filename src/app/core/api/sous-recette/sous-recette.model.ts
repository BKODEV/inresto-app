import { MatierePremiere } from '../matiere-premiere/matiere-premiere.model';
import { UniteDeMesure } from '../unite-de-mesure/unite-de-mesure.model';

export interface LigneSousRecette {
  id: number;
  sous_recette_id: number;
  matiere_premiere_id: number;
  unite_id: number;
  /** Décimal renvoyé sous forme de chaîne par l'API. */
  quantite: string;
  matiere_premiere?: MatierePremiere;
  unite?: UniteDeMesure;
  created_at: string;
  updated_at: string;
}

export interface SousRecette {
  id: number;
  libelle: string;
  quantite_produite: string;
  unite_id: number;
  /** Indicateur recalculé (PMP moyen multi-site), lecture seule. */
  cout_matiere: string;
  unite?: UniteDeMesure;
  lignes?: LigneSousRecette[];
  created_at: string;
  updated_at: string;
}

export interface LigneSousRecettePayload {
  matiere_premiere_id: number;
  // Pas d'unité : le serveur impose l'unité de stockage de la matière.
  quantite: number;
}

export interface SousRecettePayload {
  libelle: string;
  quantite_produite: number;
  unite_id: number;
  lignes: LigneSousRecettePayload[];
}
