import { Statut } from '../api.types';

export interface Fournisseur {
  id: number;
  nom: string;
  telephone: string | null;
  email: string | null;
  adresse: string | null;
  conditions_paiement: string | null;
  delai_livraison_jours: number | null;
  statut: Statut;
  created_at: string;
  updated_at: string;
}

export interface CreateFournisseurPayload {
  nom: string;
  telephone?: string | null;
  email?: string | null;
  adresse?: string | null;
  conditions_paiement?: string | null;
  delai_livraison_jours?: number | null;
  statut?: Statut;
}

export interface UpdateFournisseurPayload extends Partial<CreateFournisseurPayload> {}
