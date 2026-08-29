import { PointDeVente } from '../point-de-vente/point-de-vente.model';

export type StatutSessionCuisine = 'ouverte' | 'fermee';

/** Un membre de la brigade, tel que l'API le nomme. */
export interface MembreBrigade {
  id: string;
  nom: string;
}

/**
 * Le service d'une brigade — pendant cuisine de la session de caisse, et
 * INDÉPENDANT d'elle : un point de vente porte plusieurs caisses pour une seule
 * cuisine, et la brigade travaille avant la première ouverture de caisse comme
 * après la dernière fermeture.
 */
export interface SessionCuisine {
  id: number;
  point_de_vente_id: number;
  /** « Midi », « Soir » — la même brigade tient rarement les deux. */
  libelle: string | null;
  statut: StatutSessionCuisine;
  ouvert_le: string;
  ferme_le: string | null;
  notes: string | null;
  point_de_vente?: PointDeVente;
  /** Qui a lancé le service, et qui l'a clos : un service traverse les relèves. */
  ouvert_par?: string;
  ferme_par?: string | null;
  brigade?: MembreBrigade[];
  /** Nombre de lignes parties en cuisine pendant ce service. */
  lignes_count?: number;
}

/** Ce que la brigade a produit, par produit. */
export interface LigneProduction {
  produit_id: number;
  produit: string;
  categorie: string | null;
  quantite: number;
  ca: number;
}

export interface ProductionSession {
  session: SessionCuisine;
  production: LigneProduction[];
}

export interface OuvrirSessionCuisinePayload {
  point_de_vente_id: number;
  libelle?: string | null;
  notes?: string | null;
  brigade?: string[];
}

export interface FermerSessionCuisinePayload {
  notes?: string | null;
  brigade?: string[];
}

export interface SessionCuisineFiltres {
  point_de_vente_id?: number;
  statut?: StatutSessionCuisine;
  date_debut?: string;
  date_fin?: string;
  per_page?: number;
  page?: number;
}
