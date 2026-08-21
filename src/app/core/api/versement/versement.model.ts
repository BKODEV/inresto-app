/**
 * Où part l'argent sorti du tiroir. Liste fermée côté API : un texte libre
 * donnerait « coffre », « Coffre » et « au coffre » au bout d'un mois.
 */
export type DestinationVersement = 'coffre' | 'banque' | 'direction' | 'autre';

/**
 * Argent SORTI du tiroir — versement au coffre, à la banque, à la direction.
 *
 * `en_service` distingue les deux moments, qui ne comptent pas au même endroit :
 * pendant le service le versement se retranche du théorique de la session, après
 * la clôture il explique l'écart d'ouverture de la suivante.
 */
export interface Versement {
  id: number;
  caisse_id: number;
  session_caisse_id: number;
  montant: string;
  destination: DestinationVersement;
  destination_libelle: string;
  /** À qui l'argent a été remis. Un coffre ne signe pas de reçu, une personne si. */
  remis_a: string | null;
  /** Bordereau de dépôt, pour un versement en banque. */
  reference: string | null;
  notes: string | null;
  date_heure: string;
  en_service?: boolean;
  auteur?: string;
}

export interface CreateVersementPayload {
  montant: number;
  destination: DestinationVersement;
  remis_a?: string | null;
  reference?: string | null;
  notes?: string | null;
}
