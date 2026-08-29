import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { StockReportingPage } from './stock.page';
import { EcartInventaire } from '../../../core/api/reporting/reporting.model';
import { ReportingService } from '../../../core/api/reporting/reporting.service';
import { SelectedSiteService } from '../../../core/site/selected-site.service';

/**
 * `?detail=true` fait servir à l'API le ligne à ligne de chaque inventaire —
 * les matières qui EXPLIQUENT l'écart. Le paramètre n'était jamais envoyé : le
 * rapport annonçait un manquant sans jamais dire d'où il venait.
 */
describe('StockReportingPage — détail des écarts d’inventaire', () => {
  function ecart(matieres: EcartInventaire['matieres']): EcartInventaire {
    return {
      inventaire_id: 7,
      site_id: 1,
      site: 'Site principal',
      date: '2026-08-20',
      nb_lignes: 40,
      ecart_total_valeur: -12000,
      demarque_valeur: 12000,
      taux_couverture: 80,
      matieres,
    };
  }

  function creer() {
    const stockEcartsInventaire = vi.fn().mockReturnValue(of([]));

    TestBed.configureTestingModule({
      providers: [
        {
          provide: ReportingService,
          useValue: {
            stockEcartsInventaire,
            stockValorisation: () => of(null),
            stockConsommation: () => of([]),
            stockAlertes: () => of([]),
          },
        },
        {
          provide: SelectedSiteService,
          useValue: { perimetreLabel: () => 'Site principal', selectedId: () => 1 },
        },
      ],
    });

    const page = TestBed.runInInjectionContext(() => new StockReportingPage());
    page.onFilter({ date_debut: '2026-08-01', date_fin: '2026-08-31' });
    TestBed.tick();

    return { page, stockEcartsInventaire };
  }

  it('n’alourdit pas le rapport tant que le détail n’est pas demandé', () => {
    // Sur une période large, c'est une ligne par matière comptée et par
    // inventaire : pas de quoi charger par défaut.
    const { stockEcartsInventaire } = creer();

    expect(stockEcartsInventaire).toHaveBeenCalledWith(expect.anything(), false);
  });

  it('redemande le rapport avec le détail quand on l’active', () => {
    const { page, stockEcartsInventaire } = creer();

    page.basculerDetail(true);
    TestBed.tick();

    expect(stockEcartsInventaire).toHaveBeenLastCalledWith(expect.anything(), true);
  });

  /**
   * Une ligne comptée juste vaut zéro et n'explique rien : la garder noierait
   * les trois matières qui comptent sous les quarante qui ne disent rien.
   */
  it('ne retient que les matières qui expliquent l’écart, la plus lourde d’abord', () => {
    const { page } = creer();
    const e = ecart([
      { matiere_premiere_id: 1, matiere: 'Riz', ecart: 0, pmp: 500, ecart_valeur: 0 },
      { matiere_premiere_id: 2, matiere: 'Huile', ecart: -2, pmp: 1000, ecart_valeur: -2000 },
      { matiere_premiere_id: 3, matiere: 'Bœuf', ecart: -2, pmp: 5000, ecart_valeur: -10000 },
    ]);

    expect(page.matieresEnEcart(e).map((m) => m.matiere)).toEqual(['Bœuf', 'Huile']);
  });

  it('classe un excédent au même rang qu’un manquant de même poids', () => {
    // Le tri porte sur la VALEUR ABSOLUE : un excédent de 10 000 appelle autant
    // de vérifications qu'un manquant de 10 000.
    const { page } = creer();
    const e = ecart([
      { matiere_premiere_id: 1, matiere: 'Riz', ecart: 4, pmp: 2500, ecart_valeur: 10000 },
      { matiere_premiere_id: 2, matiere: 'Huile', ecart: -2, pmp: 1000, ecart_valeur: -2000 },
    ]);

    expect(page.matieresEnEcart(e).map((m) => m.matiere)).toEqual(['Riz', 'Huile']);
  });

  it('supporte un inventaire servi sans détail', () => {
    // Le champ est absent tant que `detail` n'a pas été demandé.
    const { page } = creer();

    expect(page.matieresEnEcart(ecart(undefined))).toEqual([]);
  });

  it('referme les lignes dépliées en coupant le détail', () => {
    // Sans cela, réactiver le détail rouvrirait des inventaires que
    // l'utilisateur croyait avoir refermés.
    const { page } = creer();
    page.basculerDetail(true);
    page.basculerInventaire(7);

    expect(page.estOuvert(7)).toBe(true);

    page.basculerDetail(false);

    expect(page.estOuvert(7)).toBe(false);
  });
});
