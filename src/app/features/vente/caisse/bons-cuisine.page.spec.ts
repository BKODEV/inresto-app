import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';

import { BonsCuisinePage } from './bons-cuisine.page';
import { BonCuisine } from '../../../core/api/bon-cuisine/bon-cuisine.model';
import { BonCuisineService } from '../../../core/api/bon-cuisine/bon-cuisine.service';
import { PointDeVenteService } from '../../../core/api/point-de-vente/point-de-vente.service';
import { SelectedSiteService } from '../../../core/site/selected-site.service';
import { AlerteService } from '../../../core/alertes/alerte.service';

/**
 * Sans écran en cuisine, cette file est la seule garantie qu'un envoi atteint
 * les postes : ce qui part à l'impression, et ce qui reste, doit être exact.
 */
describe('BonsCuisinePage — file d’impression de la caisse', () => {
  function bon(id: number, surcharge: Partial<BonCuisine> = {}): BonCuisine {
    return {
      id,
      numero: id,
      jour: '2026-11-09',
      type: 'envoi',
      type_libelle: 'Envoi',
      commande_id: 1,
      point_de_vente_id: 3,
      poste_cuisine_id: null,
      poste_libelle: 'Cuisine',
      partie: 1,
      parties: 1,
      emis_le: new Date().toISOString(),
      imprime_le: null,
      nombre_impressions: 0,
      a_imprimer: true,
      lignes: [],
      ...surcharge,
    };
  }

  function configurer(options: {
    enAttente?: BonCuisine[];
    duJour?: BonCuisine[];
    imprimer?: ReturnType<typeof vi.fn>;
    alertes?: { info: ReturnType<typeof vi.fn>; erreur: ReturnType<typeof vi.fn> };
  }) {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: BonCuisineService,
          useValue: {
            aImprimer: () => of(options.enAttente ?? []),
            duJour: () => of(options.duJour ?? []),
            imprimer: options.imprimer ?? vi.fn().mockReturnValue(of(new Blob())),
          },
        },
        { provide: PointDeVenteService, useValue: { list: () => of([]) } },
        {
          provide: SelectedSiteService,
          useValue: {
            selectedSite: signal(null),
            sites: signal([]),
            selectedId: signal(null),
            selectSite: () => undefined,
          },
        },
        {
          provide: AlerteService,
          useValue: options.alertes ?? { info: vi.fn(), erreur: vi.fn() },
        },
      ],
    });

    const page = TestBed.runInInjectionContext(() => new BonsCuisinePage());
    page.selectedPdvId.set(3);
    return page;
  }

  beforeEach(() => {
    vi.stubGlobal('open', vi.fn().mockReturnValue({}));
    URL.createObjectURL = vi.fn().mockReturnValue('blob:bon');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('sépare ce qui attend de ce qui est déjà sorti', () => {
    const page = configurer({
      enAttente: [bon(3)],
      duJour: [bon(1, { a_imprimer: false }), bon(2, { a_imprimer: false }), bon(3)],
    });

    page.refresh();

    expect(page.enAttente().map((b) => b.id)).toEqual([3]);
    // Le plus récent en tête : c'est lui qu'on réimprime le plus souvent.
    expect(page.imprimes().map((b) => b.id)).toEqual([2, 1]);
  });

  /**
   * « Imprimer tout » n'envoie aucun identifiant : c'est l'API qui prend la
   * file sous verrou et la vide. Envoyer la liste affichée ressortirait en
   * duplicata ce qu'une autre caisse vient d'imprimer.
   */
  it('imprime toute la file sans lister les bons', () => {
    const imprimer = vi.fn().mockReturnValue(of(new Blob()));
    const page = configurer({ enAttente: [bon(1), bon(2)], imprimer });
    page.refresh();

    page.imprimerTout();

    expect(imprimer).toHaveBeenCalledWith(3, undefined);
  });

  it('imprime un bon seul par son identifiant', () => {
    const imprimer = vi.fn().mockReturnValue(of(new Blob()));
    const page = configurer({ imprimer });

    page.imprimerBon(bon(7, { point_de_vente_id: 3 }));

    expect(imprimer).toHaveBeenCalledWith(3, [7]);
  });

  it('ne lance rien quand la file est vide', () => {
    const imprimer = vi.fn();
    const page = configurer({ enAttente: [], imprimer });
    page.refresh();

    page.imprimerTout();

    expect(imprimer).not.toHaveBeenCalled();
  });

  /** Une autre caisse a vidé la file entre-temps : rien de perdu, on le dit. */
  it('signale une file déjà vidée sans parler d’erreur', () => {
    const alertes = { info: vi.fn(), erreur: vi.fn() };
    const imprimer = vi
      .fn()
      .mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409 })));
    const page = configurer({ enAttente: [bon(1)], imprimer, alertes });
    page.refresh();

    page.imprimerTout();

    expect(alertes.info).toHaveBeenCalled();
    expect(alertes.erreur).not.toHaveBeenCalled();
    expect(page.impressionEnCours()).toBeNull();
  });
});
