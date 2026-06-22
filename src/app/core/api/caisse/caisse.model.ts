import { Statut } from '../api.types';
import { PointDeVente } from '../point-de-vente/point-de-vente.model';

export interface Caisse {
  id: number;
  libelle: string;
  point_de_vente_id: number;
  point_de_vente?: PointDeVente;
  statut: Statut;
  /** Nombre de sessions : > 0 ⇒ la caisse a un historique et n'est pas supprimable. */
  sessions_count?: number;
  created_at: string;
  updated_at: string;
}

export interface CreateCaissePayload {
  libelle: string;
  point_de_vente_id: number;
  statut?: Statut;
}

export interface UpdateCaissePayload extends Partial<CreateCaissePayload> {}
