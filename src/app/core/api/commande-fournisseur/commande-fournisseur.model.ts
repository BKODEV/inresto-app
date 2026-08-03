import { Fournisseur } from '../fournisseur/fournisseur.model';
import { MatierePremiere } from '../matiere-premiere/matiere-premiere.model';
import { UniteDeMesure } from '../unite-de-mesure/unite-de-mesure.model';

export type StatutCommandeFournisseur =
  'brouillon' | 'envoyee' | 'partiellement_recue' | 'cloturee' | 'annulee';

export interface LigneCommandeFournisseur {
  id: number;
  commande_fournisseur_id: number;
  matiere_premiere_id: number;
  unite_id: number;
  /** Décimaux renvoyés sous forme de chaîne par l'API. */
  quantite_commandee: string;
  prix_unitaire_previsionnel: string;
  sous_total: string;
  /**
   * Dérivés des réceptions (en unité d'achat), calculés côté serveur.
   * Absents des réponses qui n'exposent pas la commande complète.
   */
  quantite_recue?: number;
  quantite_restante?: number;
  matiere_premiere?: MatierePremiere;
  unite?: UniteDeMesure;
  created_at: string;
  updated_at: string;
}

export interface CommandeFournisseur {
  id: number;
  /** Généré côté serveur (CF-AAAAMM-####), lecture seule. */
  numero: string;
  fournisseur_id: number;
  user_id: string;
  date_commande: string | null;
  statut: StatutCommandeFournisseur;
  /** Recalculé à partir des lignes, lecture seule. */
  montant_previsionnel: string;
  notes: string | null;
  fournisseur?: Fournisseur;
  lignes?: LigneCommandeFournisseur[];
  created_at: string;
  updated_at: string;
}

export interface CreateCommandeFournisseurPayload {
  fournisseur_id: number;
  date_commande?: string | null;
  notes?: string | null;
}

export interface UpdateCommandeFournisseurPayload {
  fournisseur_id?: number;
  date_commande?: string;
  notes?: string | null;
}

export interface LigneCommandePayload {
  matiere_premiere_id: number;
  // Pas d'unité : le serveur impose l'unité d'achat du catalogue.
  quantite_commandee: number;
  prix_unitaire_previsionnel: number;
}
