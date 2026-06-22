import { Statut } from '../api.types';
import { ModeDePaiement } from '../mode-de-paiement/mode-de-paiement.model';
import { Produit } from '../produit/produit.model';
import { SessionCaisse } from '../session-caisse/session-caisse.model';
import { TableSalle } from '../table/table.model';

export type StatutCommandeClient =
  | 'ouverte'
  | 'envoyee_en_cuisine'
  | 'servie'
  | 'encaissee'
  | 'annulee';

export type TypeRemise = 'pourcentage' | 'montant_fixe';
export type SortAnnulation = 'remise_en_stock' | 'perte';

export interface LigneCommandeClient {
  id: number;
  commande_client_id: number;
  produit_id: number;
  fiche_technique_id: number | null;
  quantite: number;
  prix_unitaire: string;
  commentaire: string | null;
  statut: Statut;
  produit?: Produit;
}

export interface Paiement {
  id: number;
  commande_client_id: number;
  mode_de_paiement_id: number;
  user_id: string;
  montant: string;
  date_heure: string;
  reference_externe: string | null;
  mode_de_paiement?: ModeDePaiement;
}

export interface Remise {
  id: number;
  commande_client_id: number;
  user_id: string;
  type: TypeRemise;
  valeur: string;
  motif: string | null;
  date_heure: string;
}

export interface CommandeClient {
  id: number;
  table_id: number;
  session_caisse_id: number;
  user_id: string;
  reservation_id: number | null;
  appartement_id: string | null;
  appartement_nom: string | null;
  appartement_a_verifier: boolean;
  date_heure: string;
  statut: StatutCommandeClient;
  montant_total: string;
  montant_du: string;
  montant_paye: string;
  reste_a_payer: string;
  notes: string | null;
  table?: TableSalle;
  session_caisse?: SessionCaisse;
  lignes?: LigneCommandeClient[];
  paiements?: Paiement[];
  remises?: Remise[];
}

export interface CreateCommandePayload {
  table_id: number;
  session_caisse_id: number;
  reservation_id?: number | null;
  appartement_id?: string | null;
  appartement_nom?: string | null;
  appartement_a_verifier?: boolean;
  notes?: string | null;
}

export interface AjouterLignePayload {
  produit_id: number;
  quantite: number;
  commentaire?: string | null;
}

export interface StorePaiementPayload {
  mode_de_paiement_id: number;
  montant: number;
  reference_externe?: string | null;
}

export interface StoreRemisePayload {
  type: TypeRemise;
  valeur: number;
  motif?: string | null;
}

export interface AnnulerLignePayload {
  motif: string;
  sort?: SortAnnulation;
}

export interface AnnulerCommandePayload {
  motif: string;
}
