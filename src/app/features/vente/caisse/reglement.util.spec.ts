import {
  SaisieReglement,
  monnaieARendre,
  payloadPaiement,
  pourboireApresAvoirGardeLaMonnaie,
  recuInsuffisant,
} from './reglement.util';

function saisie(surcharge: Partial<SaisieReglement> = {}): SaisieReglement {
  return { montant: 7500, pourboire: 0, recu: 0, ...surcharge };
}

/**
 * L'arithmétique du comptoir, partagée par les deux tiroirs qui encaissent.
 * Elle décide de ce qui entre en base — donc de ce que la caisse annoncera le
 * soir venu — et se trompe silencieusement si on la laisse dériver.
 */
describe('monnaieARendre', () => {
  it('ne rend rien tant qu’aucun billet n’est saisi', () => {
    // Carte, virement, appoint exact : il n'y a pas de billet sur le comptoir.
    expect(monnaieARendre(saisie())).toBe(0);
  });

  it('rend la différence entre le billet et la vente', () => {
    expect(monnaieARendre(saisie({ recu: 10000 }))).toBe(2500);
  });

  it('retranche le pourboire : le client l’a laissé', () => {
    expect(monnaieARendre(saisie({ recu: 10000, pourboire: 1000 }))).toBe(1500);
  });

  it('ne rend plus rien quand toute la monnaie devient pourboire', () => {
    expect(monnaieARendre(saisie({ recu: 10000, pourboire: 2500 }))).toBe(0);
  });

  it('reste juste au centime', () => {
    expect(monnaieARendre({ montant: 10.1, pourboire: 0.2, recu: 20 })).toBe(9.7);
  });
});

describe('recuInsuffisant', () => {
  it('laisse passer un billet qui couvre la vente et le pourboire', () => {
    expect(recuInsuffisant(saisie({ recu: 8500, pourboire: 1000 }))).toBe(false);
  });

  it('accepte le compte exact', () => {
    expect(recuInsuffisant(saisie({ recu: 8500, pourboire: 1000 }))).toBe(false);
  });

  it('refuse un billet trop court pour la vente et le pourboire', () => {
    // 8 000 ne peuvent pas couvrir 7 500 de vente ET 1 000 de pourboire.
    expect(recuInsuffisant(saisie({ recu: 8000, pourboire: 1000 }))).toBe(true);
  });

  it('ne juge rien en l’absence de billet', () => {
    expect(recuInsuffisant(saisie({ pourboire: 1000 }))).toBe(false);
  });
});

describe('pourboireApresAvoirGardeLaMonnaie', () => {
  it('bascule la monnaie restante', () => {
    expect(pourboireApresAvoirGardeLaMonnaie(saisie({ recu: 10000 }))).toBe(2500);
  });

  it('s’ajoute à un pourboire déjà saisi', () => {
    expect(pourboireApresAvoirGardeLaMonnaie(saisie({ recu: 10000, pourboire: 500 }))).toBe(2500);
  });
});

describe('payloadPaiement', () => {
  it('n’envoie ni pourboire ni billet quand le compte est juste', () => {
    expect(payloadPaiement(5, saisie())).toEqual({
      mode_de_paiement_id: 5,
      montant: 7500,
      pourboire: null,
      montant_recu: null,
    });
  });

  it('envoie le billet seulement s’il reste à rendre', () => {
    expect(payloadPaiement(5, saisie({ recu: 10000 })).montant_recu).toBe(10000);
    // Monnaie entièrement laissée : plus rien à rendre, donc rien à mémoriser.
    expect(payloadPaiement(5, saisie({ recu: 10000, pourboire: 2500 })).montant_recu).toBeNull();
  });

  it('transmet le pourboire dès qu’il existe', () => {
    expect(payloadPaiement(5, saisie({ recu: 10000, pourboire: 1000 })).pourboire).toBe(1000);
  });
});
