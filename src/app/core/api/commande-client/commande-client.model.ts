import { Statut } from '../api.types';
import { ModeDePaiement } from '../mode-de-paiement/mode-de-paiement.model';
import { Produit } from '../produit/produit.model';
import { SessionCaisse } from '../session-caisse/session-caisse.model';
import { TableSalle } from '../table/table.model';

export type StatutCommandeClient =
  'ouverte' | 'envoyee_en_cuisine' | 'servie' | 'encaissee' | 'annulee';

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
  /**
   * Horodatage du départ en cuisine, et identifiant du tour : les lignes d'un
   * même envoi le partagent. Null = encore au brouillon.
   */
  envoyee_le: string | null;
  /** Servie et déstockée. Un second service ne la reprend pas. */
  servie_le: string | null;
  /** Jamais partie en cuisine : se retire sans motif d'annulation. */
  retirable_sans_motif: boolean;
  produit?: Produit;
}

export interface Paiement {
  id: number;
  commande_client_id: number;
  mode_de_paiement_id: number;
  user_id: string;
  /** Ce qui reste en tiroir, et qui compte dans le théorique de la session. */
  montant: string;
  /**
   * Ce que le client a laissé au serveur. Dans le tiroir, mais pas de la
   * recette : le bénéficiaire est le serveur de la note.
   */
  pourboire: string;
  /** Espèces tendues, quand il y a eu de la monnaie à rendre. */
  montant_recu: string | null;
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

/** Ligne du panier, telle qu'envoyée à l'API au moment de l'envoi en cuisine. */
export interface LigneAEnvoyer {
  produit_id: number;
  quantite: number;
  commentaire?: string | null;
}

/**
 * Un ticket de cuisine : les lignes d'une note parties ensemble.
 *
 * `envoyee_le` identifie le tour — les lignes d'un même envoi le partagent. Le
 * temps d'attente se compte depuis lui, et non depuis l'ouverture de la note :
 * c'est la production qui traîne, pas le fait que la table soit installée.
 */
export interface TourKds {
  commande_id: number;
  table: TableSalle | null;
  envoyee_le: string | null;
  lignes: LigneCommandeClient[];
}

export interface CommandeClient {
  id: number;
  table_id: number;
  /**
   * Numéro figé à l'ouverture de la note : un renommage de table ne réécrit pas
   * les documents déjà émis. À préférer à `table.numero` pour tout affichage
   * qui doit rester fidèle à la commande.
   */
  table_numero: string | null;
  session_caisse_id: number;
  user_id: string;
  /** Nom du serveur qui a ouvert la note. Présent quand la relation est chargée. */
  serveur?: string;
  reservation_id: number | null;
  appartement_id: string | null;
  appartement_nom: string | null;
  appartement_a_verifier: boolean;
  date_heure: string;
  statut: StatutCommandeClient;
  /**
   * Depuis quand la table attend son addition. Le seul repère qui distingue un
   * client au comptoir d'un client parti sans payer. Null tant que la note
   * n'est pas servie, et effacé si elle repart en cuisine.
   */
  servie_le: string | null;
  montant_total: string;
  montant_du: string;
  montant_paye: string;
  reste_a_payer: string;
  /** Vrai tant que rien n'a jamais garni la commande : abandon sans motif. */
  peut_etre_liberee: boolean;
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
  /**
   * Espèces tendues. Distinct de `montant`, qui est ce qui demeure en caisse :
   * y inscrire le billet reçu gonflerait le fond théorique de la monnaie
   * rendue, et ferait apparaître un manquant à la fermeture.
   */
  /** Laissé au serveur : dans le tiroir, jamais dans le chiffre d'affaires. */
  pourboire?: number | null;
  montant_recu?: number | null;
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
