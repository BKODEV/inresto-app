// Modèles du module Reporting (lecture seule). L'API renvoie des nombres bruts ;
// le formatage (devise, séparateurs) est fait côté front.

export type PeriodeType = 'jour' | 'semaine' | 'mois' | 'plage';

/** Filtre temporel + périmètre commun à tous les rapports. */
export interface ReportingFilter {
  periode?: PeriodeType;
  /** Date de référence (jour/semaine/mois), format `YYYY-MM-DD`. */
  date?: string;
  /** Requis si `periode = 'plage'`. */
  date_debut?: string;
  date_fin?: string;
  site_id?: number;
  point_de_vente_id?: number;
}

// ── Famille Food cost ───────────────────────────────────────────────────────

export interface FoodCostMetrics {
  quantite_vendue: number;
  ca: number;
  cout_theorique: number;
  cout_reel: number;
  food_cost_theorique_pct: number;
  food_cost_reel_pct: number;
  ecart_food_cost_valeur: number;
  ecart_food_cost_points: number;
  marge_brute_reelle: number;
}

export interface FoodCostProduitLigne extends FoodCostMetrics {
  produit_id: number;
  produit: string;
}

export interface FoodCostPdvLigne extends FoodCostMetrics {
  point_de_vente_id: number;
  point_de_vente: string;
}

export interface LigneNonValorisee {
  produit_id: number;
  produit: string;
  quantite_vendue: number;
  ca: number;
}

export interface LignesNonValorisees {
  nombre_lignes: number;
  ca_concerne: number;
  produits: LigneNonValorisee[];
}

export interface FoodCostProduits {
  produits: FoodCostProduitLigne[];
  lignes_non_valorisees: LignesNonValorisees;
}

export interface FoodCostPointsDeVente {
  points_de_vente: FoodCostPdvLigne[];
  lignes_non_valorisees: LignesNonValorisees;
}

export interface FoodCostSynthese {
  ca_total: number;
  ca_valorise: number;
  cout_theorique_total: number;
  cout_reel_total: number;
  food_cost_theorique_pct: number;
  food_cost_reel_pct: number;
  ecart_global_points: number;
  marge_brute_totale: number;
  part_ca_non_valorise_pct: number;
}

// ── Famille Ventes ──────────────────────────────────────────────────────────

export interface VenteParPdv {
  point_de_vente_id: number;
  point_de_vente: string;
  ca: number;
  nombre_commandes: number;
  panier_moyen: number;
}

export type TriProduit = 'ca' | 'quantite';
export type OrdreTri = 'asc' | 'desc';

export interface VenteProduit {
  produit_id: number;
  produit: string;
  quantite_vendue: number;
  ca: number;
  part_ca_pct: number;
}

export interface VenteModePaiement {
  mode_de_paiement_id: number;
  mode: string;
  montant_total: number;
  nombre_paiements: number;
  part_pct: number;
}

export interface VenteServeur {
  user_id: string;
  serveur: string;
  ca: number;
  nombre_commandes: number;
  panier_moyen: number;
}

export interface EvolutionPoint {
  label: string;
  ca: number;
  nombre_commandes: number;
}

// ── Famille Stock ───────────────────────────────────────────────────────────

export interface StockValorisationMatiere {
  matiere_premiere_id: number;
  matiere: string;
  stock_courant: number;
  pmp: number;
  valeur: number;
  unite: string | null;
}

export interface StockValorisationSite {
  site_id: number;
  site: string;
  matieres: StockValorisationMatiere[];
  total_valorise: number;
}

export interface StockValorisation {
  sites: StockValorisationSite[];
  total_valorise: number;
}

export interface ConsommationVentilation {
  quantite: number;
  valeur: number;
}

export interface ConsommationMatiere {
  matiere_premiere_id: number;
  matiere: string;
  unite: string | null;
  quantite_sortie: number;
  valeur_sortie: number;
  ventilation: Record<string, ConsommationVentilation>;
}

export interface EcartInventaireMatiere {
  matiere_premiere_id: number;
  matiere: string;
  ecart: number;
  pmp: number;
  ecart_valeur: number;
}

export interface EcartInventaire {
  inventaire_id: number;
  site_id: number;
  site: string;
  date: string;
  nb_lignes: number;
  ecart_total_valeur: number;
  demarque_valeur: number;
  taux_couverture: number;
  matieres?: EcartInventaireMatiere[];
}

export interface AlerteStock {
  matiere_premiere_id: number;
  matiere: string;
  site_id: number;
  site: string;
  stock_courant: number;
  seuil: number;
  manquant: number;
  unite: string | null;
}

// ── Famille Budget ──────────────────────────────────────────────────────────

export type DepenseType = 'achat_fournisseur' | 'charge_hors_stock';

export interface DepenseReporting {
  id: number;
  site_id: number;
  budget_id: number;
  reception_id: number | null;
  type: DepenseType;
  libelle: string;
  montant: number;
  date_depense: string;
}

export interface DepensesReport {
  depenses: DepenseReporting[];
  totaux_par_type: Record<DepenseType, number>;
  total: number;
}
