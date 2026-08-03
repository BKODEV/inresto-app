import { PointDeVente } from '../point-de-vente/point-de-vente.model';

export type StatutTable = 'libre' | 'occupee' | 'reservee' | 'a_debarrasser';

export interface TableSalle {
  id: number;
  point_de_vente_id: number;
  numero: string;
  capacite: number;
  statut: StatutTable;
  /** Jeton opaque encodé dans le QR de la table. Null pour les tables antérieures au backfill. */
  public_token: string | null;
  /** Lien public complet du menu (ce que le QR encode), construit par l'API selon l'instance. */
  menu_url: string | null;
  point_de_vente?: PointDeVente;
}

export interface CreateTablePayload {
  point_de_vente_id: number;
  numero: string;
  capacite: number;
  statut?: StatutTable;
}

export interface UpdateTablePayload {
  numero?: string;
  capacite?: number;
}
