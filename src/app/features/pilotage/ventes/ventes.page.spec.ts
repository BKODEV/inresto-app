import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { VentesPage } from './ventes.page';
import { ReportingService } from '../../../core/api/reporting/reporting.service';
import { SelectedSiteService } from '../../../core/site/selected-site.service';

/**
 * L'API classe les produits dans les deux sens depuis toujours — le contrôleur
 * s'appelle « Top/flop produits ». L'écran figeait `ordre: 'desc'` : la moitié
 * flop, celle qui dit quoi retirer de la carte, était inatteignable.
 */
describe('VentesPage — top et flop produits', () => {
  function creer() {
    const ventesProduits = vi.fn().mockReturnValue(of([]));

    TestBed.configureTestingModule({
      providers: [
        {
          provide: ReportingService,
          useValue: {
            ventesProduits,
            ventesParPointDeVente: () => of([]),
            ventesModesPaiement: () => of([]),
            ventesServeurs: () => of([]),
            ventesEvolution: () => of([]),
          },
        },
        {
          provide: SelectedSiteService,
          useValue: { perimetreLabel: () => 'Site principal', selectedId: () => 1 },
        },
      ],
    });

    const page = TestBed.runInInjectionContext(() => new VentesPage());
    page.onFilter({ date_debut: '2026-08-01', date_fin: '2026-08-31' });
    TestBed.tick();

    return { page, ventesProduits };
  }

  it('demande le classement décroissant par défaut', () => {
    const { page, ventesProduits } = creer();

    expect(page.sens()).toBe('desc');
    expect(ventesProduits).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ ordre: 'desc' }),
    );
  });

  it('demande le flop quand on inverse le sens', () => {
    const { page, ventesProduits } = creer();

    page.setSens('asc');
    TestBed.tick();

    expect(ventesProduits).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ ordre: 'asc' }),
    );
  });

  it('croise le sens avec le critère de tri', () => {
    // Les moins vendus EN QUANTITÉ et les moins rentables ne sont pas la même
    // liste : les deux axes doivent rester indépendants.
    const { page, ventesProduits } = creer();

    page.setSens('asc');
    page.setTri('quantite');
    TestBed.tick();

    expect(ventesProduits).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ ordre: 'asc', tri: 'quantite' }),
    );
  });

  /** Un panneau qui s'intitulerait « Top » en montrant le flop tromperait. */
  it('nomme le panneau d’après le sens demandé', () => {
    const { page } = creer();

    expect(page.titreProduits()).toBe('Top produits');

    page.setSens('asc');

    expect(page.titreProduits()).toBe('Flop produits');
  });
});
