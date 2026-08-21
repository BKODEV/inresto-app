/**
 * Ce qui reste dû à un serveur sur les pourboires encaissés au comptoir.
 *
 * Un solde qui court à travers les sessions, et non l'instantané d'un service :
 * une dette non réglée doit rester visible tant qu'elle n'est pas éteinte.
 */
export interface SoldePourboire {
  user_id: string;
  serveur: string;
  /** Généré par ses notes, depuis toujours. */
  encaisse: number;
  /** Déjà reçu en reversements. */
  reverse: number;
  /** Ce qu'on lui doit encore. Négatif = il a reçu plus qu'il n'a généré. */
  solde: number;
}

/** Un reversement reçu : ce qu'un serveur vérifie quand il consulte son cumul. */
export interface ReversementRecu {
  montant: number;
  date_heure: string | null;
  notes: string | null;
}

export interface MonSoldePourboire {
  solde: SoldePourboire;
  reversements: ReversementRecu[];
}
