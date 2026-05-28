import { PointDeVente } from '../point-de-vente/point-de-vente.model';

export type CarteStatut = 'brouillon' | 'active' | 'archivee';

export interface Carte {
  id: number;
  libelle: string;
  point_de_vente_id: number;
  point_de_vente: PointDeVente;
  statut: CarteStatut;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CreateCartePayload {
  libelle: string;
  point_de_vente_id: number;
  statut?: CarteStatut;
}

export interface UpdateCartePayload extends Partial<CreateCartePayload> {}
