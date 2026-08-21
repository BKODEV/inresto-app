import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { PourboiresPage } from './pourboires.page';
import { SoldePourboire } from '../../../core/api/pourboire/pourboire.model';
import { PourboireService } from '../../../core/api/pourboire/pourboire.service';
import { VersementService } from '../../../core/api/versement/versement.service';
import { CaisseService } from '../../../core/api/caisse/caisse.service';
import { AuthService } from '../../../core/auth/auth.service';
import { SelectedSiteService } from '../../../core/site/selected-site.service';

/**
 * Le solde est une DETTE : elle court à travers les sessions et ne s'éteint
 * qu'au reversement. Ces tests portent sur ce que l'écran promet de ce
 * côté-là — à qui, combien, et ce qu'il reste après.
 */
describe('PourboiresPage — ce qui reste dû au personnel', () => {
  function solde(surcharge: Partial<SoldePourboire> = {}): SoldePourboire {
    return {
      user_id: 'uuid-kouassi',
      serveur: 'Kouassi A.',
      encaisse: 1500,
      reverse: 0,
      solde: 1500,
      ...surcharge,
    };
  }

  function creer(options: { soldes?: SoldePourboire[]; peutReverser?: boolean } = {}) {
    const creerVersement = vi.fn().mockReturnValue(of({ id: 1 }));

    TestBed.configureTestingModule({
      providers: [
        { provide: PourboireService, useValue: { soldes: () => of(options.soldes ?? [solde()]) } },
        { provide: VersementService, useValue: { create: creerVersement } },
        { provide: CaisseService, useValue: { list: () => of([]) } },
        {
          provide: AuthService,
          useValue: { hasPermission: () => options.peutReverser !== false },
        },
        {
          provide: SelectedSiteService,
          useValue: { selectedSite: () => null, estConsolide: () => false, selectedId: () => 1 },
        },
      ],
    });

    const page = TestBed.runInInjectionContext(() => new PourboiresPage());
    page.ngOnInit();

    return { page, creerVersement };
  }

  it('additionne ce que l’établissement doit, tous serveurs confondus', () => {
    const { page } = creer({
      soldes: [solde({ user_id: 'a', solde: 1500 }), solde({ user_id: 'b', solde: 800 })],
    });

    expect(page.totalDu()).toBe(2300);
  });

  it('ouvre le reversement prérempli au solde', () => {
    // Reverser en totalité est le geste courant ; le partiel reste possible.
    const { page } = creer();

    page.ouvrirReversement(solde({ solde: 1200 }));

    expect(page.reverserForm.getRawValue().montant).toBe(1200);
  });

  it('impute le reversement au serveur de la ligne, pas à un nom saisi', () => {
    const { page, creerVersement } = creer();
    page.selectedCaisseId.set(7);

    page.ouvrirReversement(solde({ user_id: 'uuid-kouassi', solde: 1500 }));
    page.reverser();

    expect(creerVersement).toHaveBeenCalledWith(7, {
      montant: 1500,
      destination: 'personnel',
      beneficiaire_id: 'uuid-kouassi',
      notes: null,
    });
  });

  it('accepte un reversement partiel', () => {
    const { page, creerVersement } = creer();
    page.selectedCaisseId.set(7);

    page.ouvrirReversement(solde({ solde: 1500 }));
    page.reverserForm.patchValue({ montant: 800 });
    page.reverser();

    expect(creerVersement.mock.calls[0][1].montant).toBe(800);
  });

  it('ne reverse rien sans caisse à débiter', () => {
    // L'argent sort forcément d'un tiroir : sans caisse, la sortie n'a pas
    // d'origine et le rapprochement ne saurait pas quoi retrancher.
    const { page, creerVersement } = creer();

    page.ouvrirReversement(solde());
    page.reverser();

    expect(creerVersement).not.toHaveBeenCalled();
  });

  it('cache le reversement à qui n’en a pas le droit', () => {
    const { page } = creer({ peutReverser: false });

    expect(page.peutReverser()).toBe(false);
  });
});
