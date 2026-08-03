import { MatierePremiere } from '../matiere-premiere/matiere-premiere.model';
import { Site } from '../site/site.model';

/**
 * État du stock pour un couple (matière, site). Lecture seule : les quantités
 * et le PMP sont dérivés des mouvements, seul le back les écrit.
 */
export interface Stock {
  id: number;
  matiere_premiere_id: number;
  site_id: number;
  /** Décimaux renvoyés sous forme de chaîne par l'API (cast Laravel). */
  stock_courant: string;
  /** Prix moyen pondéré, propre au site. */
  pmp: string;
  /** stock_courant × pmp, calculé côté serveur. */
  valeur: number;
  /** Seuil d'alerte de la matière ; `0` ou absent désactive l'alerte. */
  seuil_alerte_stock: string | null;
  sous_seuil: boolean;
  matiere_premiere?: MatierePremiere;
  site?: Site;
  updated_at: string;
}
