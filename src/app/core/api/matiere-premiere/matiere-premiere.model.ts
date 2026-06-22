import { Statut } from '../api.types';
import { CategorieMatierePremiere } from '../categorie-matiere-premiere/categorie-matiere-premiere.model';
import { UniteDeMesure } from '../unite-de-mesure/unite-de-mesure.model';

export interface MatierePremiere {
  id: number;
  categorie_id: number;
  unite_de_mesure_id: number;
  libelle: string;
  /** Décimaux renvoyés sous forme de chaîne par l'API (cast Laravel). */
  seuil_alerte_stock: string;
  gestion_peremption: boolean;
  /** Lecture seule — alimenté par le StockService, jamais modifiable via le CRUD. */
  stock_courant: string;
  /** Lecture seule — prix moyen pondéré. */
  pmp: string;
  statut: Statut;
  categorie?: CategorieMatierePremiere;
  unite?: UniteDeMesure;
  created_at: string;
  updated_at: string;
}

export interface CreateMatierePremierePayload {
  categorie_id: number;
  unite_de_mesure_id: number;
  libelle: string;
  seuil_alerte_stock?: number | null;
  gestion_peremption?: boolean;
  statut?: Statut;
}

export interface UpdateMatierePremierePayload extends Partial<CreateMatierePremierePayload> {}
