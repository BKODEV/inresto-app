import { SortAnnulation, TypeRemise } from '../commande-client/commande-client.model';
import { Pagination } from '../api.types';

/** Filtres communs aux deux relectures de contrôle. */
export interface AuditFiltres {
  site_id?: number;
  point_de_vente_id?: number;
  date_debut?: string;
  date_fin?: string;
  per_page?: number;
  page?: number;
}

export interface RemiseFiltres extends AuditFiltres {
  commande_client_id?: number;
  type?: TypeRemise;
}

/**
 * Une remise accordée, telle que la relit un contrôle. `valeur` est un
 * pourcentage ou un montant selon `type` — les deux ne se lisent pas pareil.
 */
export interface RemiseAudit {
  id: number;
  commande_client_id: number;
  user_id: string;
  type: TypeRemise;
  valeur: string;
  motif: string | null;
  date_heure: string;
  /** Nom de qui a accordé la remise. Présent quand la relation est chargée. */
  auteur?: string;
  /** Numéro figé de la table, pour situer la note. */
  table_numero?: string | null;
}

/** Ce que la carte morphologique stocke dans `annulable_type`. */
export type TypeAnnulable = 'commandes_client' | 'lignes_commande_client';

export interface AnnulationFiltres extends AuditFiltres {
  annulable_type?: TypeAnnulable;
  sort?: SortAnnulation;
}

/**
 * Une annulation, commande entière ou ligne. `sort` n'est renseigné que pour
 * une ligne DÉJÀ déstockée : c'est la question du contrôle — la matière est-elle
 * repartie en stock, ou passée en perte.
 */
export interface AnnulationAudit {
  id: number;
  user_id: string;
  annulable_type: TypeAnnulable;
  annulable_id: number;
  sort: SortAnnulation | null;
  motif: string | null;
  date_heure: string;
  auteur?: string;
  /** La note concernée, quelle que soit la nature de l'annulation. */
  commande_client_id?: number | null;
}

export interface PageAudit<T> {
  lignes: T[];
  pagination: Pagination;
}
