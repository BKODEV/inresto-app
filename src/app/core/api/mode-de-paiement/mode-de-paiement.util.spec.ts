import { ModeDePaiement } from './mode-de-paiement.model';
import { modeParDefaut, modesProposables } from './mode-de-paiement.util';

function mode(surcharge: Partial<ModeDePaiement>): ModeDePaiement {
  return {
    id: 1,
    libelle: 'Espèces',
    compte_en_caisse: true,
    ordre: 1,
    statut: 'actif',
    ...surcharge,
  } as ModeDePaiement;
}

/**
 * Le mode présélectionné décide dans quelle colonne l'argent est compté à la
 * fermeture. Il valait `modes()[0]` sur une liste que l'API renvoyait sans
 * `orderBy` : le défaut pouvait basculer sans que personne ne touche à rien.
 */
describe('modeParDefaut', () => {
  it('retient le premier mode qui alimente le tiroir', () => {
    const id = modeParDefaut([
      mode({ id: 7, libelle: 'Virement', compte_en_caisse: false, ordre: 1 }),
      mode({ id: 3, libelle: 'Espèces', compte_en_caisse: true, ordre: 2 }),
    ]);

    // Virement est premier à l'affichage : le défaut suit le sens, pas la place.
    expect(id).toBe(3);
  });

  it('départage plusieurs modes en tiroir par leur ordre', () => {
    const id = modeParDefaut([
      mode({ id: 9, libelle: 'Caisse annexe', ordre: 4 }),
      mode({ id: 2, libelle: 'Espèces', ordre: 2 }),
    ]);

    expect(id).toBe(2);
  });

  it('ignore les modes désactivés', () => {
    const id = modeParDefaut([
      mode({ id: 5, libelle: 'Espèces', ordre: 1, statut: 'inactif' }),
      mode({ id: 6, libelle: 'Wave', ordre: 2 }),
    ]);

    expect(id).toBe(6);
  });

  it('retombe sur le premier actif quand aucun mode n’alimente le tiroir', () => {
    // Établissement 100 % dématérialisé : mieux vaut proposer que rien afficher.
    const id = modeParDefaut([
      mode({ id: 8, libelle: 'Carte', compte_en_caisse: false, ordre: 2 }),
      mode({ id: 4, libelle: 'Wave', compte_en_caisse: false, ordre: 1 }),
    ]);

    expect(id).toBe(4);
  });

  it('rend 0 sur une liste vide, ce que le formulaire refuse', () => {
    expect(modeParDefaut([])).toBe(0);
  });
});

describe('modesProposables', () => {
  it('trie par ordre et écarte les modes désactivés', () => {
    const libelles = modesProposables([
      mode({ id: 1, libelle: 'Virement', ordre: 3 }),
      mode({ id: 2, libelle: 'Retiré', ordre: 1, statut: 'inactif' }),
      mode({ id: 3, libelle: 'Espèces', ordre: 2 }),
    ]).map((m) => m.libelle);

    expect(libelles).toEqual(['Espèces', 'Virement']);
  });

  it('départage par identifiant deux modes de même ordre', () => {
    // Cas des lignes jamais rangées : toutes à 0, l'ordre doit rester stable.
    const ids = modesProposables([mode({ id: 9, ordre: 0 }), mode({ id: 2, ordre: 0 })]).map(
      (m) => m.id,
    );

    expect(ids).toEqual([2, 9]);
  });
});
