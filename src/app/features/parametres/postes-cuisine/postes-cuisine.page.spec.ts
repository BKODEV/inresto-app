import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { PostesCuisinePage } from './postes-cuisine.page';
import { PosteCuisine } from '../../../core/api/poste-cuisine/poste-cuisine.model';
import { CategorieProduit } from '../../../core/api/categorie-produit/categorie-produit.model';
import { PosteCuisineService } from '../../../core/api/poste-cuisine/poste-cuisine.service';
import { CategorieProduitService } from '../../../core/api/categorie-produit/categorie-produit.service';
import { PointDeVenteService } from '../../../core/api/point-de-vente/point-de-vente.service';
import { SessionCuisineService } from '../../../core/api/session-cuisine/session-cuisine.service';

/**
 * Un poste porte les deux moitiés de l'organisation du pass : ce qu'on y
 * produit (catégories) et QUI le tient (membres). C'est ce second rattachement
 * qui permet ensuite de composer une brigade sans dérouler tout le personnel.
 */
describe('PostesCuisinePage — la brigade du poste', () => {
  const PDV = [
    { id: 1, site_id: 1, nom: 'Restaurant' },
    { id: 2, site_id: 1, nom: 'Lounge' },
  ];

  const PERSONNEL: Record<number, { id: string; nom: string }[]> = {
    1: [
      { id: 'uuid-chef', nom: 'Kouassi A.' },
      { id: 'uuid-commis', nom: 'Aminata D.' },
    ],
    2: [{ id: 'uuid-bar', nom: 'Awa T.' }],
  };

  function poste(surcharge: Partial<PosteCuisine> = {}): PosteCuisine {
    return {
      id: 5,
      point_de_vente_id: 1,
      libelle: 'Chaud',
      ordre: 1,
      statut: 'actif',
      categories: [],
      membres: [{ id: 'uuid-chef', nom: 'Kouassi A.' }],
      ...surcharge,
    } as PosteCuisine;
  }

  function creer(items: PosteCuisine[] = [poste()]) {
    const update = vi.fn().mockReturnValue(of(poste()));
    const create = vi.fn().mockReturnValue(of(poste()));
    const personnel = vi.fn().mockImplementation((pdvId: number) => of(PERSONNEL[pdvId] ?? []));

    TestBed.configureTestingModule({
      providers: [
        {
          provide: PosteCuisineService,
          useValue: { list: () => of(items), create, update, delete: vi.fn() },
        },
        { provide: CategorieProduitService, useValue: { list: () => of([]) } },
        { provide: PointDeVenteService, useValue: { list: () => of(PDV) } },
        { provide: SessionCuisineService, useValue: { personnel } },
      ],
    });

    const page = TestBed.runInInjectionContext(() => new PostesCuisinePage());
    page.ngOnInit();

    return { page, create, update, personnel };
  }

  /**
   * Le chef n'a pas `utilisateur.view` : passer par `GET /users` le mettait en
   * 403 sur l'écran qui organise sa propre brigade.
   */
  it('propose le personnel du point de vente, pas la fiche des comptes', () => {
    const { page, personnel } = creer();

    page.openEdit(poste());

    expect(personnel).toHaveBeenCalledWith(1);
    expect(page.personnel().map((u) => u.nom)).toEqual(['Kouassi A.', 'Aminata D.']);
  });

  it('reprend la brigade déjà rattachée à l’ouverture du tiroir', () => {
    const { page } = creer();

    page.openEdit(poste());

    expect(page.estMembre('uuid-chef')).toBe(true);
    expect(page.estMembre('uuid-commis')).toBe(false);
  });

  it('envoie la brigade cochée', () => {
    const { page, update } = creer();
    page.openEdit(poste());

    page.basculerMembre('uuid-commis');
    page.save();

    expect(update).toHaveBeenCalledWith(
      5,
      expect.objectContaining({ membres: ['uuid-chef', 'uuid-commis'] }),
    );
  });

  /**
   * Détacher tout le monde est une intention légitime, distincte de « je ne
   * touche pas à la brigade » : l'API attend un tableau vide, pas une clé
   * absente.
   */
  it('envoie un tableau vide quand on détache tout le monde', () => {
    const { page, update } = creer();
    page.openEdit(poste());

    page.basculerMembre('uuid-chef');
    page.save();

    expect(update).toHaveBeenCalledWith(5, expect.objectContaining({ membres: [] }));
  });

  /**
   * Le personnel dépend du point de vente. Garder les cases d'un autre site
   * enverrait des membres que l'API refuse en 422.
   */
  it('recharge le personnel et vide la sélection au changement de point de vente', () => {
    const { page, personnel } = creer();
    page.openCreate();
    page.basculerMembre('uuid-chef');

    page.onPdvChoisi('2');

    expect(personnel).toHaveBeenLastCalledWith(2);
    expect(page.estMembre('uuid-chef')).toBe(false);
  });

  it('joint les noms de la brigade pour la liste', () => {
    const { page } = creer();

    expect(
      page.libellesMembres(
        poste({
          membres: [
            { id: 'a', nom: 'Kouassi A.' },
            { id: 'b', nom: 'Aminata D.' },
          ],
        }),
      ),
    ).toBe('Kouassi A. · Aminata D.');
  });

  it('n’invente pas de brigade sur un poste qui n’en a pas', () => {
    const { page } = creer();

    expect(page.libellesMembres(poste({ membres: [] }))).toBe('—');
  });

  // ───────────────────────── bons de cuisine ─────────────────────────

  /**
   * Sur un bon, un plat ne va qu'à un poste : une catégorie déjà produite
   * ailleurs sur le même pass ne se coche pas ici.
   */
  it('grise les catégories déjà produites par un autre poste du pass', () => {
    const grill = { id: 30, libelle: 'Grillades' } as CategorieProduit;
    const { page } = creer([
      poste({ id: 5, libelle: 'Chaud', categories: [grill] }),
      poste({ id: 6, libelle: 'Froid', categories: [] }),
      poste({ id: 7, point_de_vente_id: 2, libelle: 'Bar', categories: [] }),
    ]);

    page.openEdit(poste({ id: 6, libelle: 'Froid', categories: [] }));
    expect(page.posteQuiProduit(grill)).toBe('Chaud');

    // Le poste qui la produit peut toujours la reposer.
    page.openEdit(poste({ id: 5, libelle: 'Chaud', categories: [grill] }));
    expect(page.posteQuiProduit(grill)).toBeNull();

    // Un autre pass n'est pas concerné.
    page.openEdit(poste({ id: 7, point_de_vente_id: 2, libelle: 'Bar', categories: [] }));
    expect(page.posteQuiProduit(grill)).toBeNull();
  });

  it('ne demande la charge par défaut que pour la confier', () => {
    const { page, update } = creer([
      poste({ id: 5, par_defaut: true }),
      poste({ id: 6, par_defaut: false }),
    ]);

    page.openEdit(poste({ id: 5, par_defaut: true }));
    expect(page.form.controls.par_defaut.disabled).toBe(true);
    page.save();
    expect(update.mock.calls[0][1]).not.toHaveProperty('par_defaut');

    page.openEdit(poste({ id: 6, par_defaut: false }));
    page.form.controls.par_defaut.setValue(true);
    page.save();
    expect(update.mock.calls[1][1]).toMatchObject({ par_defaut: true });
  });

  it('coche d’office le premier poste d’un point de vente', () => {
    const { page } = creer([]);

    page.openCreate();

    expect(page.form.controls.par_defaut.value).toBe(true);
  });
});
