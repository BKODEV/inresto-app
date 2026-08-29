import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { JournalPage } from './journal.page';
import { JournalService } from '../../../core/api/journal/journal.service';
import { PointDeVenteService } from '../../../core/api/point-de-vente/point-de-vente.service';
import { SelectedSiteService } from '../../../core/site/selected-site.service';

/**
 * Le journal assemble six sources côté API. L'écran n'en connaissait que cinq,
 * et lisait la réponse en jetant la fenêtre réellement lue.
 */
describe('JournalPage — ce que l’écran sait demander et dire', () => {
  const PDV = [
    { id: 1, site_id: 1, nom: 'Bar' },
    { id: 2, site_id: 1, nom: 'Restaurant' },
    { id: 3, site_id: 9, nom: 'Autre site' },
  ];

  function creer(index?: Partial<{ evenements: unknown[]; periode: unknown; total: number }>) {
    const list = vi.fn().mockReturnValue(
      of({
        evenements: index?.evenements ?? [],
        periode: index?.periode ?? {
          debut: '2026-08-29T00:00:00+00:00',
          fin: '2026-08-29T23:59:59+00:00',
        },
        total: index?.total ?? 0,
      }),
    );

    TestBed.configureTestingModule({
      providers: [
        { provide: JournalService, useValue: { list } },
        { provide: PointDeVenteService, useValue: { list: () => of(PDV) } },
        {
          provide: SelectedSiteService,
          useValue: { epoch: () => 0, selectedId: () => 1 },
        },
      ],
    });

    const page = TestBed.runInInjectionContext(() => new JournalPage());
    page.ngOnInit();

    return { page, list };
  }

  /**
   * Les versements remontaient déjà dans les résultats sans filtre, mais le
   * type n'existait pas côté écran : leur badge s'affichait vide, et on ne
   * pouvait pas isoler les sorties de tiroir.
   */
  it('connaît les six sources de l’API, versements compris', () => {
    const { page } = creer();

    expect(page.types.map((t) => t.value)).toEqual([
      'annulation',
      'remise',
      'paiement',
      'encaissement',
      'versement',
      'impression',
    ]);
    expect(page.typeLabel.versement).toBe('Versement');
  });

  it('n’a aucun type sans libellé', () => {
    // Un type sans libellé s'affiche en badge vide sur un écran d'audit.
    const { page } = creer();

    for (const t of page.types) {
      expect(page.typeLabel[t.value]).toBeTruthy();
    }
  });

  it('filtre sur un point de vente', () => {
    const { page, list } = creer();

    page.onPointDeVente('2');

    expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ point_de_vente_id: 2 }));
  });

  it('retire le filtre de comptoir quand on choisit « Tous »', () => {
    const { page, list } = creer();
    page.onPointDeVente('2');

    page.onPointDeVente('');

    expect(list).toHaveBeenLastCalledWith(
      expect.objectContaining({ point_de_vente_id: undefined }),
    );
  });

  it('ne propose que les comptoirs du site courant', () => {
    // Ceux des autres sites ne sont pas dans le périmètre lu : les proposer ne
    // filtrerait que sur du vide.
    const { page } = creer();

    expect(page.pointsDeVente().map((p) => p.nom)).toEqual(['Bar', 'Restaurant']);
  });

  /**
   * Sans dates fournies, l'API ramène la fenêtre à la journée courante et
   * plafonne chaque source. L'écran jetait ces deux informations : il laissait
   * croire qu'il montrait tout.
   */
  it('retient la fenêtre réellement lue et le volume retenu', () => {
    const { page } = creer({ total: 3, periode: { debut: 'D', fin: 'F' } });

    expect(page.total()).toBe(3);
    expect(page.periode()).toEqual({ debut: 'D', fin: 'F' });
  });

  it('signale un filtre actif même sans type coché', () => {
    // Un comptoir choisi restreint autant qu'un type : le message de liste vide
    // doit inviter à l'élargir.
    const { page } = creer();

    expect(page.aDesFiltres()).toBe(false);

    page.onPointDeVente('2');

    expect(page.aDesFiltres()).toBe(true);
  });
});
