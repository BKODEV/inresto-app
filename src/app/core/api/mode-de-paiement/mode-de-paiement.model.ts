import { Statut } from '../api.types';

export interface ModeDePaiement {
  id: number;
  libelle: string;
  /**
   * Cet argent finit-il dans le tiroir qu'on compte à la fermeture ?
   *
   * Seuls les modes marqués entrent dans le montant théorique de la session :
   * un virement est bien encaissé, mais personne ne le retrouve en comptant la
   * caisse.
   */
  compte_en_caisse: boolean;
  /** Ordre des boutons à la caisse, et départage pour la présélection. */
  ordre: number;
  statut: Statut;
  created_at: string;
  updated_at: string;
}

export interface CreateModeDePaiementPayload {
  libelle: string;
  compte_en_caisse?: boolean;
  ordre?: number;
  statut?: Statut;
}

export interface UpdateModeDePaiementPayload extends Partial<CreateModeDePaiementPayload> {}
