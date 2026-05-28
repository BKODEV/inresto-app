import { Statut } from '../api.types';

export interface UniteDeMesure {
  id: number;
  libelle: string;
  symbole: string;
  statut: Statut;
  created_at: string;
  updated_at: string;
}

export interface CreateUniteDeMesurePayload {
  libelle: string;
  symbole: string;
  statut?: Statut;
}

export interface UpdateUniteDeMesurePayload extends Partial<CreateUniteDeMesurePayload> {}
