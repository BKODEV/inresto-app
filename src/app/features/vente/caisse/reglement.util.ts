import { StorePaiementPayload } from '../../../core/api/commande-client/commande-client.model';

/**
 * Les trois montants qu'un caissier pose sur un règlement.
 *
 * `montant` solde la note — c'est la vente. `pourboire` reste en tiroir sans
 * appartenir à l'établissement. `recu` est le billet tendu, dont se déduit la
 * monnaie. Seul le billet ne part jamais tel quel en base : l'y enregistrer
 * gonflerait le fond de caisse théorique de l'argent déjà rendu.
 */
export interface SaisieReglement {
  montant: number;
  pourboire: number;
  recu: number;
}

/** Arrondi au centime, pour que les comparaisons ne butent pas sur un flottant. */
function auCentime(valeur: number): number {
  return Math.round(valeur * 100) / 100;
}

/**
 * Ce qu'il reste à rendre au client.
 *
 * Le pourboire se retranche : le client l'a laissé, on ne le lui rend pas.
 * Zéro tant qu'aucun billet n'est saisi — une carte ou un compte juste ne
 * rendent rien.
 */
export function monnaieARendre(saisie: SaisieReglement): number {
  if (saisie.recu <= 0) {
    return 0;
  }

  return auCentime(saisie.recu - saisie.montant - saisie.pourboire);
}

/**
 * Le billet ne couvre pas ce qu'on prétend encaisser. Sans ce garde-fou on
 * rendrait une monnaie jamais reçue — l'API refuse d'ailleurs la saisie.
 */
export function recuInsuffisant(saisie: SaisieReglement): boolean {
  return saisie.recu > 0 && saisie.recu < auCentime(saisie.montant + saisie.pourboire);
}

/** « Gardez la monnaie » : tout ce qui restait à rendre devient pourboire. */
export function pourboireApresAvoirGardeLaMonnaie(saisie: SaisieReglement): number {
  return auCentime(saisie.pourboire + monnaieARendre(saisie));
}

/**
 * Payload d'un paiement.
 *
 * `montant_recu` n'est transmis que s'il reste quelque chose à rendre : une
 * carte, un compte juste ou une monnaie entièrement laissée en pourboire n'ont
 * aucun billet à mémoriser, et le champ resterait un chiffre sans usage.
 */
export function payloadPaiement(
  modeDePaiementId: number,
  saisie: SaisieReglement,
): StorePaiementPayload {
  return {
    mode_de_paiement_id: modeDePaiementId,
    montant: saisie.montant,
    pourboire: saisie.pourboire > 0 ? saisie.pourboire : null,
    montant_recu: monnaieARendre(saisie) > 0 ? saisie.recu : null,
  };
}
