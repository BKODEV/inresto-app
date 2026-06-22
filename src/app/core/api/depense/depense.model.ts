export type TypeDepense = 'achat_fournisseur' | 'charge_hors_stock';

export interface Depense {
  id: number;
  budget_id: number;
  type: TypeDepense;
  libelle: string;
  /** Décimal renvoyé sous forme de chaîne par l'API. */
  montant: string;
  date_depense: string;
  /** null pour une charge manuelle ; renseigné pour une dépense issue d'une réception. */
  reception_id: number | null;
  created_at: string;
  updated_at: string;
}

/** Charge hors stock saisie manuellement (le type et reception_id sont forcés serveur). */
export interface CreateDepensePayload {
  libelle: string;
  montant: number;
  date_depense: string;
}
