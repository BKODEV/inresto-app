import { Site } from '../site/site.model';
import { Depense } from '../depense/depense.model';

export type NiveauAlerte = 'aucun' | 'seuil_75' | 'seuil_90' | 'depassement';

export interface Budget {
  id: number;
  site_id: number;
  /** Date au format `YYYY-MM-DD`, toujours le 1er du mois. */
  mois: string;
  /** Décimaux renvoyés sous forme de chaîne par l'API. */
  montant_alloue: string;
  /** Champs calculés à la volée par l'API. */
  montant_consomme: string;
  montant_restant: string;
  pourcentage_consomme: string;
  niveau_alerte: NiveauAlerte;
  seuil_alerte_75: boolean;
  seuil_alerte_90: boolean;
  seuil_alerte_100: boolean;
  site?: Site;
  /** Présent uniquement sur la vue détaillée d'un mois. */
  depenses?: Depense[];
  created_at: string;
  updated_at: string;
}

export interface CreateBudgetPayload {
  site_id: number;
  mois: string;
  montant_alloue: number;
  seuil_alerte_75?: boolean;
  seuil_alerte_90?: boolean;
  seuil_alerte_100?: boolean;
}

export interface UpdateBudgetPayload extends Partial<CreateBudgetPayload> {}
