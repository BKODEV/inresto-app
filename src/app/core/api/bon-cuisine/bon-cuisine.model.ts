/**
 * Ce qu'un bon demande au poste. `ajout` : la table mange déjà ;
 * `annulation` : il faut arrêter ce qui a été lancé.
 */
export type TypeBonCuisine = 'envoi' | 'ajout' | 'annulation';

export interface LigneBonCuisine {
  id: number;
  ligne_commande_client_id: number;
  produit_libelle: string;
  quantite: number;
  commentaire: string | null;
  /** Servi ou annulé avant l'impression : ne sortira pas sur le papier. */
  sans_objet: boolean;
}

/**
 * Bon de cuisine : une note × un poste × un envoi. Figé à l'émission — libellés
 * et quantités y sont recopiés — et sans aucun prix.
 */
export interface BonCuisine {
  id: number;
  /** Repart à 1 chaque jour, par point de vente. */
  numero: number;
  jour: string;
  type: TypeBonCuisine;
  type_libelle: string;
  commande_id: number;
  point_de_vente_id: number;
  poste_cuisine_id: number | null;
  poste_libelle: string;
  /** Rang de ce bon parmi ceux du même envoi (« 2/3 »). */
  partie: number;
  parties: number;
  emis_le: string;
  /** Vide = le bon attend encore à la caisse. */
  imprime_le: string | null;
  nombre_impressions: number;
  a_imprimer: boolean;
  /**
   * Devenu inutile avant d'être imprimé : ses plats ont été servis ou annulés
   * sans lui. Il a quitté la file et ne s'imprime plus.
   */
  sans_objet: boolean;
  sans_objet_le: string | null;
  table_numero?: string | null;
  serveur?: string | null;
  emis_par?: string | null;
  lignes?: LigneBonCuisine[];
}
