import { CommandeFournisseur } from '../commande-fournisseur/commande-fournisseur.model';
import { MatierePremiere } from '../matiere-premiere/matiere-premiere.model';
import { Site } from '../site/site.model';
import { UniteDeMesure } from '../unite-de-mesure/unite-de-mesure.model';

export interface LigneReception {
  id: number;
  reception_id: number;
  matiere_premiere_id: number;
  unite_id: number;
  /** Décimaux renvoyés sous forme de chaîne par l'API. */
  quantite_recue: string;
  prix_unitaire_reel: string;
  sous_total: string;
  matiere_premiere?: MatierePremiere;
  unite?: UniteDeMesure;
  created_at: string;
  updated_at: string;
}

export interface Reception {
  id: number;
  commande_fournisseur_id: number;
  site_id: number;
  user_id: string;
  date_reception: string | null;
  /** Recalculé à la confirmation (Σ quantité reçue × prix réel), lecture seule. */
  montant_reel: string;
  observations: string | null;
  commande?: CommandeFournisseur;
  site?: Site;
  lignes?: LigneReception[];
  created_at: string;
  updated_at: string;
}

export interface CreateReceptionPayload {
  commande_fournisseur_id: number;
  site_id: number;
  date_reception?: string | null;
  observations?: string | null;
}

export interface LigneReceptionPayload {
  matiere_premiere_id: number;
  unite_id: number;
  quantite_recue: number;
  prix_unitaire_reel: number;
}
