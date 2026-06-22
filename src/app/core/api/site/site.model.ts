import { Statut } from '../api.types';
import { PointDeVente } from '../point-de-vente/point-de-vente.model';

/**
 * Site d'exploitation (cuisine/stock/budget propres). Regroupe plusieurs points
 * de vente. Les opérations rattachées à un site (réception, inventaire, budget,
 * dépense) portent son `id`.
 */
export interface Site {
  id: number;
  nom: string;
  code: string;
  statut: Statut;
  adresse?: string | null;
  /** Présent dans le détail d'un site (`GET /sites/{id}`) : ses points de vente, chacun avec `caisses_count`. */
  points_de_vente?: PointDeVente[];
  /** Nombre de points de vente rattachés (liste de gestion et détail). */
  points_de_vente_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface CreateSitePayload {
  nom: string;
  code: string;
  adresse?: string | null;
  statut?: Statut;
}

export interface UpdateSitePayload extends Partial<CreateSitePayload> {}
