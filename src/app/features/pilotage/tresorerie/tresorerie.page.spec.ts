import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { TresoreriePage } from './tresorerie.page';
import { TresoreriePosition } from '../../../core/api/reporting/reporting.model';
import { ReportingService } from '../../../core/api/reporting/reporting.service';
import { SelectedSiteService } from '../../../core/site/selected-site.service';

/**
 * Le reste du pilotage répond à « qu'avons-nous vendu ». Cet écran répond à
 * « qu'avons-nous », ce qu'aucun écran ne savait dire : le théorique d'une
 * caisse n'existait qu'à sa fermeture et rien n'agrégeait les tiroirs.
 */
describe('TresoreriePage — position des tiroirs', () => {
  function position(surcharge: Partial<TresoreriePosition> = {}): TresoreriePosition {
    return {
      caisses_ouvertes: [
        {
          session_caisse_id: 4,
          caisse_id: 1,
          caisse: 'Caisse 1',
          point_de_vente: 'Restaurant',
          site_id: 1,
          ouverte_le: '2026-09-21T08:00:00Z',
          caissier: 'Aminata D.',
          en_tiroir: 170000,
          hors_tiroir: 300000,
          pourboires_dus: 7000,
        },
      ],
      caisses_au_repos: [
        {
          session_caisse_id: 2,
          caisse_id: 2,
          caisse: 'Caisse 2',
          point_de_vente: 'Terrasse',
          site_id: 1,
          fermee_le: '2026-09-20T23:30:00Z',
          reste_en_tiroir: 30000,
        },
      ],
      totaux: {
        en_service: 170000,
        au_repos: 30000,
        en_caisse: 200000,
        hors_tiroir_en_service: 300000,
        pourboires_dus: 7000,
        disponible: 193000,
      },
      non_comptees: [],
      ...surcharge,
    };
  }

  function creer(data: TresoreriePosition = position(), siteId: number | null = 1) {
    const tresoreriePosition = vi.fn().mockReturnValue(of(data));

    TestBed.configureTestingModule({
      providers: [
        { provide: ReportingService, useValue: { tresoreriePosition } },
        {
          provide: SelectedSiteService,
          useValue: { perimetreLabel: () => 'Site principal', selectedId: () => siteId },
        },
      ],
    });

    const page = TestBed.runInInjectionContext(() => new TresoreriePage());
    TestBed.tick();

    return { page, tresoreriePosition };
  }

  /**
   * Une position est une photo, pas un cumul : la demander sur une période
   * n'aurait pas de sens. Seul le périmètre de sites est transmis.
   */
  it('demande la position du site courant, sans filtre de période', () => {
    const { tresoreriePosition } = creer();

    expect(tresoreriePosition).toHaveBeenCalledWith(1);
  });

  it('demande le consolidé quand aucun site n’est sélectionné', () => {
    const { tresoreriePosition } = creer(position(), null);

    expect(tresoreriePosition).toHaveBeenCalledWith(null);
  });

  it('expose les deux sources de trésorerie et leurs totaux', () => {
    const { page } = creer();

    expect(page.caissesOuvertes()).toHaveLength(1);
    expect(page.caissesAuRepos()).toHaveLength(1);
    // Ce qui est en service plus ce qui dort : 170 000 + 30 000.
    expect(page.totaux()?.en_caisse).toBe(200000);
    expect(page.loading()).toBe(false);
  });

  /**
   * Un tiroir fermé sans comptage n'a pas de reliquat CONNU, ce qui n'est pas
   * la même chose que zéro : le compter pour rien annoncerait une caisse vide
   * là où personne n'a regardé. Il doit donc se voir, hors des totaux.
   */
  it('sort les tiroirs jamais comptés des totaux, sans les taire', () => {
    const { page } = creer(
      position({
        non_comptees: [
          {
            session_caisse_id: 9,
            caisse_id: 3,
            caisse: 'Caisse 3',
            point_de_vente: 'Bar',
            site_id: 1,
            fermee_le: '2026-09-19T23:00:00Z',
          },
        ],
      }),
    );

    expect(page.nonComptees()).toHaveLength(1);
    expect(page.totaux()?.au_repos).toBe(30000);
  });

  it('signale une position illisible plutôt que d’afficher zéro', () => {
    // Zéro en caisse et « je n'ai pas pu lire » ne se confondent pas sur un
    // écran d'argent.
    const tresoreriePosition = vi.fn().mockReturnValue(throwError(() => new Error('boom')));

    TestBed.configureTestingModule({
      providers: [
        { provide: ReportingService, useValue: { tresoreriePosition } },
        {
          provide: SelectedSiteService,
          useValue: { perimetreLabel: () => 'Site principal', selectedId: () => 1 },
        },
      ],
    });

    const page = TestBed.runInInjectionContext(() => new TresoreriePage());
    TestBed.tick();

    expect(page.error()).toBe('Impossible de charger la position de trésorerie.');
    expect(page.totaux()).toBeNull();
    expect(page.loading()).toBe(false);
  });
});
