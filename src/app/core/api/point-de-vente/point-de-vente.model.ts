import { Statut } from '../api.types';
import { Site } from '../site/site.model';
import { Caisse } from '../caisse/caisse.model';

export type PointDeVenteType = 'Lounge' | 'Restaurant';

export interface PointDeVente {
  id: number;
  site_id: number;
  nom: string;
  type: PointDeVenteType;
  description: string | null;
  statut: Statut;
  /** Nombre de caisses du point de vente (présent dans le détail d'un site). */
  caisses_count?: number;
  /** Caisses du point de vente (présent dans le détail d'un PDV `GET /points-de-vente/{id}`). */
  caisses?: Caisse[];
  site?: Site;
  created_at: string;
  updated_at: string;
}

export interface CreatePointDeVentePayload {
  site_id: number;
  nom: string;
  type: PointDeVenteType;
  description?: string | null;
  statut?: Statut;
}

export interface UpdatePointDeVentePayload extends Partial<CreatePointDeVentePayload> {}
