export type TypeEvenementJournal =
  'annulation' | 'remise' | 'paiement' | 'encaissement' | 'impression';

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

export interface JournalFiltres {
  site_id?: number;
  point_de_vente_id?: number;
  date_debut?: string;
  date_fin?: string;
  type?: TypeEvenementJournal[];
}
