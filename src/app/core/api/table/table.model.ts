import { PointDeVente } from '../point-de-vente/point-de-vente.model';

export type StatutTable = 'libre' | 'occupee' | 'reservee' | 'a_debarrasser';

export interface TableSalle {
  id: number;
  point_de_vente_id: number;
  numero: string;
  capacite: number;
  statut: StatutTable;
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
