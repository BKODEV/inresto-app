import { Caisse } from '../caisse/caisse.model';

export type StatutSessionCaisse = 'ouverte' | 'fermee';

/**
 * Un manquant est de l'argent parti (erreur de rendu, paiement non saisi) ; un
 * excédent signale plutôt une vente encaissée sans note ouverte. « Toléré » est
 * un écart sous le seuil configuré pour le site — avec de la petite monnaie on
 * ne tombe jamais pile.
 */
export type EcartSens = 'non_rapproche' | 'juste' | 'tolere' | 'excedent' | 'manquant';

/**
 * Un contenant et son verdict : ce que le système attendait, ce qu'on y a
 * constaté, l'écart.
 *
 * Un mode de paiement désigne un endroit où l'argent s'accumule — le tiroir
 * pour les espèces, le terminal pour la carte, la pochette pour les chèques.
 * `montant_constate` est nul tant que personne ne l'a déclaré : tous les
 * contenants ne sont pas vérifiables le soir même.
 */
export interface RapprochementCaisse {
  id: number;
  mode_de_paiement_id: number;
  mode?: string;
  compte_en_caisse?: boolean;
  montant_theorique: string;
  montant_constate: string | null;
  ecart: string | null;
  ecart_sens: EcartSens;
}

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
  /** Un par mode de paiement actif, figé à la fermeture. */
  rapprochements?: RapprochementCaisse[];
  statut: StatutSessionCaisse;
  notes: string | null;
  caisse?: Caisse;
  user?: { id: string; nom: string; prenom: string };
}

export interface OuvrirSessionPayload {
  caisse_id: number;
  fonds_initial?: number;
}

/** Ce qu'on a constaté dans un contenant. Absent = non rapproché. */
export interface ConstatParMode {
  mode_de_paiement_id: number;
  montant_constate: number | null;
}

export interface FermerSessionPayload {
  rapprochements: ConstatParMode[];
  notes?: string | null;
}
