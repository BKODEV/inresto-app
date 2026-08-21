import { Caisse } from '../caisse/caisse.model';

export type StatutSessionCaisse = 'ouverte' | 'fermee';

/**
 * Un manquant est de l'argent parti (erreur de rendu, paiement non saisi) ; un
 * excédent signale plutôt une vente encaissée sans note ouverte. « Toléré » est
 * un écart sous le seuil configuré pour le site — avec de la petite monnaie on
 * ne tombe jamais pile.
 */
export type EcartSens = 'juste' | 'tolere' | 'excedent' | 'manquant';

export interface SessionCaisse {
  id: number;
  caisse_id: number;
  user_id: string;
  ouvert_le: string;
  fonds_initial: string;
  ferme_le: string | null;
  montant_theorique: string | null;
  montant_reel: string | null;
  ecart: string | null;
  /**
   * Sens de l'écart, calculé par l'API : il dépend de la tolérance du site, que
   * le front n'a pas sous la main. Absent tant que la session est ouverte.
   */
  ecart_sens?: EcartSens;
  /**
   * Encaissé sur la session sans passer par le tiroir (virement, chèque, carte).
   * Explique qu'une caisse presque vide puisse afficher un écart nul. Fourni
   * seulement sur les sessions fermées.
   */
  montant_hors_caisse?: string;
  /** Qui a signé la fermeture — pas forcément qui a ouvert (relève d'équipe). */
  ferme_par?: string | null;
  statut: StatutSessionCaisse;
  notes: string | null;
  caisse?: Caisse;
  user?: { id: string; nom: string; prenom: string };
}

export interface OuvrirSessionPayload {
  caisse_id: number;
  fonds_initial?: number;
}

export interface FermerSessionPayload {
  montant_reel: number;
  notes?: string | null;
}
