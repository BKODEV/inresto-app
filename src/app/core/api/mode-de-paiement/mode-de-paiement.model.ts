import { Statut } from '../api.types';

export interface ModeDePaiement {
  id: number;
  libelle: string;
  statut: Statut;
  created_at: string;
  updated_at: string;
}

export interface CreateModeDePaiementPayload {
  libelle: string;
  statut?: Statut;
}

export interface UpdateModeDePaiementPayload extends Partial<CreateModeDePaiementPayload> {}
