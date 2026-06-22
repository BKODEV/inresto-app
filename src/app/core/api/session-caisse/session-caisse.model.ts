import { Caisse } from '../caisse/caisse.model';

export type StatutSessionCaisse = 'ouverte' | 'fermee';

export interface SessionCaisse {
  id: number;
  caisse_id: number;
  user_id: string;
  ouvert_le: string;
  fonds_initial: string;
  ferme_le: string | null;
  montant_theorique: string | null;
  montant_reel: string | null;
  ecart: string | null;
  statut: StatutSessionCaisse;
  notes: string | null;
  caisse?: Caisse;
  user?: { id: string; nom: string; prenom: string };
}

export interface OuvrirSessionPayload {
  caisse_id: number;
  fonds_initial?: number;
}

export interface FermerSessionPayload {
  montant_reel: number;
  notes?: string | null;
}
