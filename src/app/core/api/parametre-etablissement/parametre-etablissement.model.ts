/**
 * Paramètres d'établissement d'un site : identité commerciale, logo, coordonnées
 * et mentions légales. Une seule fiche par site. Alimente l'en-tête/pied des
 * documents PDF (aucune donnée d'établissement n'est codée en dur).
 */
export interface ParametreEtablissement {
  id: number;
  site_id: number;
  nom_commercial: string;
  slogan?: string | null;
  logo_path?: string | null;
  /** URL publique du logo (null tant qu'aucun logo n'est chargé). */
  logo_url?: string | null;
  adresse?: string | null;
  telephone?: string | null;
  email?: string | null;
  site_web?: string | null;
  raison_sociale?: string | null;
  ncc?: string | null;
  rccm?: string | null;
  regime_fiscal?: string | null;
  devise: string;
  /**
   * Montant sous lequel un écart de fermeture de caisse est réputé normal.
   * `'0.00'` = règle désactivée, tout écart non nul est signalé.
   */
  tolerance_ecart_caisse: string;
  mentions_pied_page?: string | null;
  created_at?: string;
  updated_at?: string;
}

/** Upsert (PUT) : `nom_commercial` et `devise` requis, le reste optionnel. */
export interface UpsertParametreEtablissementPayload {
  nom_commercial: string;
  devise: string;
  slogan?: string | null;
  adresse?: string | null;
  telephone?: string | null;
  email?: string | null;
  site_web?: string | null;
  raison_sociale?: string | null;
  ncc?: string | null;
  rccm?: string | null;
  regime_fiscal?: string | null;
  mentions_pied_page?: string | null;
}
