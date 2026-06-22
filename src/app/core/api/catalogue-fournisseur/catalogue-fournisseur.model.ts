import { Fournisseur } from '../fournisseur/fournisseur.model';
import { MatierePremiere } from '../matiere-premiere/matiere-premiere.model';
import { UniteDeMesure } from '../unite-de-mesure/unite-de-mesure.model';

export interface CatalogueFournisseur {
  id: number;
  fournisseur_id: number;
  matiere_premiere_id: number;
  /** Décimal renvoyé sous forme de chaîne par l'API. */
  prix_unitaire: string;
  unite_achat_id: number;
  /** Nombre d'unités de stockage contenues dans 1 unité d'achat (diviseur à la réception). */
  qte_par_unite_achat: string;
  fournisseur?: Fournisseur;
  matiere_premiere?: MatierePremiere;
  unite_achat?: UniteDeMesure;
  created_at: string;
  updated_at: string;
}

export interface CreateCatalogueFournisseurPayload {
  fournisseur_id: number;
  matiere_premiere_id: number;
  prix_unitaire: number;
  unite_achat_id: number;
  qte_par_unite_achat: number;
}

export interface UpdateCatalogueFournisseurPayload extends Partial<CreateCatalogueFournisseurPayload> {}

/** Une ligne envoyée lors de la synchronisation complète du catalogue d'un fournisseur. */
export interface SyncCatalogueLine {
  matiere_premiere_id: number;
  prix_unitaire: number;
  unite_achat_id: number;
  qte_par_unite_achat: number;
}
