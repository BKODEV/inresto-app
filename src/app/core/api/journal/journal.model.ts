/**
 * Les six sources agrégées par l'API. `versement` en fait partie : les sorties
 * de tiroir remontaient déjà dans les résultats, sans que le type existe ici —
 * elles s'affichaient donc avec un libellé vide.
 */
export type TypeEvenementJournal =
  'annulation' | 'remise' | 'paiement' | 'encaissement' | 'versement' | 'impression';

/**
 * Un geste sensible du service. Forme commune à toutes les sources agrégées par
 * l'API : chacune remplit ce qu'elle a, les champs sans objet restent nuls.
 */
export interface EvenementJournal {
  type: TypeEvenementJournal;
  date_heure: string | null;
  /** Null si le compte auteur a été supprimé. */
  auteur: string | null;
  libelle: string;
  reference: string | null;
  montant: number | null;
  motif: string | null;
  detail: string | null;
}

/** Ce que l'API renvoie : les événements, et la fenêtre qu'elle a réellement lue. */
export interface JournalIndex {
  evenements: EvenementJournal[];
  /**
   * La période effectivement retenue. Sans date fournie, l'API la ramène à la
   * journée courante : sans ce retour, l'écran affirmerait une plage qu'il n'a
   * pas obtenue.
   */
  periode: { debut: string; fin: string };
  /** Nombre d'événements retenus, chaque source étant plafonnée côté API. */
  total: number;
}

export interface JournalFiltres {
  site_id?: number;
  point_de_vente_id?: number;
  date_debut?: string;
  date_fin?: string;
  type?: TypeEvenementJournal[];
}
