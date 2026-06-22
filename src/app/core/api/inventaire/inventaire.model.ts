import { MatierePremiere } from '../matiere-premiere/matiere-premiere.model';
import { Site } from '../site/site.model';

export type StatutInventaire = 'en_cours' | 'cloture';

export interface LigneInventaire {
  id: number;
  inventaire_id: number;
  matiere_premiere_id: number;
  /** Décimaux renvoyés sous forme de chaîne par l'API. */
  quantite_theorique: string;
  quantite_physique: string;
  /** null tant que l'inventaire est en cours (figé à la clôture). */
  ecart: string | null;
  matiere_premiere?: MatierePremiere;
  created_at: string;
  updated_at: string;
}

export interface Inventaire {
  id: number;
  site_id: number;
  user_id: string | null;
  date_inventaire: string | null;
  statut: StatutInventaire;
  /** Figée à la clôture ; 0 tant qu'en cours. */
  valeur_totale_stock: string;
  notes: string | null;
  site?: Site;
  lignes?: LigneInventaire[];
  created_at: string;
  updated_at: string;
}

export interface RapportInventaire {
  inventaire_id: number;
  statut: StatutInventaire;
  nb_matieres_inventoriees: number;
  nb_matieres_site: number;
  taux_couverture: number;
  valeur_totale_stock: string | null;
  lignes: LigneInventaire[];
}

export interface CreateInventairePayload {
  site_id: number;
  date_inventaire?: string | null;
  notes?: string | null;
}

export interface LigneInventairePayload {
  matiere_premiere_id: number;
  quantite_physique: number;
}
