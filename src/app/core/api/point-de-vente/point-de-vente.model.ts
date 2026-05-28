import { Statut } from '../api.types';

export type PointDeVenteType = 'Lounge' | 'Restaurant';

export interface PointDeVente {
  id: number;
  nom: string;
  type: PointDeVenteType;
  description: string | null;
  statut: Statut;
  created_at: string;
  updated_at: string;
}

export interface CreatePointDeVentePayload {
  nom: string;
  type: PointDeVenteType;
  description?: string | null;
  statut?: Statut;
}

export interface UpdatePointDeVentePayload extends Partial<CreatePointDeVentePayload> {}
