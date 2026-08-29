import { StorePaiementPayload } from '../../../core/api/commande-client/commande-client.model';

/**
 * Les trois montants qu'un caissier pose sur un règlement, et la nature du mode
 * choisi.
 *
 * `montant` solde la note — c'est la vente. `pourboire` reste en tiroir sans
 * appartenir à l'établissement. `recu` est le billet tendu, dont se déduit la
 * monnaie. Seul le billet ne part jamais tel quel en base : l'y enregistrer
 * gonflerait le fond de caisse théorique de l'argent déjà rendu.
 *
 * `enTiroir` dit si le mode fait entrer des espèces dans le tiroir. Il décide à
 * lui seul si le billet est une donnée obligatoire ou une notion sans objet :
 * une carte ne pose rien sur le comptoir.
 */
export interface SaisieReglement {
  montant: number;
  pourboire: number;
  recu: number;
  enTiroir: boolean;
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

/**
 * Espèces tendues non saisies alors que l'argent passe par le tiroir.
 *
 * Sans le billet, la monnaie rendue ne se déduit pas : le reçu retombait sur le
 * montant encaissé et affirmait un appoint juste que personne n'avait constaté.
 * L'API le refuse désormais ; l'annoncer ici évite au caissier un aller-retour.
 */
export function recuManquant(saisie: SaisieReglement): boolean {
  return saisie.enTiroir && saisie.recu <= 0;
}

/** « Gardez la monnaie » : tout ce qui restait à rendre devient pourboire. */
export function pourboireApresAvoirGardeLaMonnaie(saisie: SaisieReglement): number {
  return auCentime(saisie.pourboire + monnaieARendre(saisie));
}

/**
 * Payload d'un paiement.
 *
 * `montant_recu` accompagne tout encaissement en tiroir, monnaie ou pas : un
 * appoint juste est une information — le billet valait exactement la note —
 * alors que l'absence de champ laissait le reçu la supposer. Hors tiroir, aucun
 * billet n'a été tendu : le champ resterait un chiffre inventé.
 */
export function payloadPaiement(
  modeDePaiementId: number,
  saisie: SaisieReglement,
): StorePaiementPayload {
  return {
    mode_de_paiement_id: modeDePaiementId,
    montant: saisie.montant,
    pourboire: saisie.pourboire > 0 ? saisie.pourboire : null,
    montant_recu: saisie.enTiroir ? saisie.recu : null,
  };
}
