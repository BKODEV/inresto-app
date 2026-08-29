import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

import { SessionsCuisinePage } from './sessions-cuisine.page';
import { SessionCuisine } from '../../../core/api/session-cuisine/session-cuisine.model';
import { SessionCuisineService } from '../../../core/api/session-cuisine/session-cuisine.service';
import { PointDeVenteService } from '../../../core/api/point-de-vente/point-de-vente.service';
import { UserService } from '../../../core/api/user/user.service';
import { AuthService } from '../../../core/auth/auth.service';
import { SelectedSiteService } from '../../../core/site/selected-site.service';

/**
 * Le service de cuisine répond à « quelle équipe a produit quoi ». Il est
 * INDÉPENDANT de la session de caisse : un point de vente porte plusieurs
 * caisses pour une seule cuisine, et la brigade travaille avant la première
 * ouverture de caisse comme après la dernière fermeture.
 */
describe('SessionsCuisinePage — le service de la brigade', () => {
  const PDV = [
    { id: 1, site_id: 1, nom: 'Restaurant' },
    { id: 2, site_id: 1, nom: 'Lounge' },
    { id: 9, site_id: 7, nom: 'Autre site' },
  ];

  const PERSONNEL = [
    { id: 'uuid-chef', prenom: 'Kouassi', nom: 'A.' },
    { id: 'uuid-commis', prenom: 'Aminata', nom: 'D.' },
  ];

  function session(surcharge: Partial<SessionCuisine> = {}): SessionCuisine {
    return {
      id: 4,
      point_de_vente_id: 1,
      libelle: 'Midi',
      statut: 'ouverte',
      ouvert_le: '2026-08-29T08:30:00Z',
      ferme_le: null,
      notes: null,
      ouvert_par: 'Kouassi A.',
      brigade: [{ id: 'uuid-chef', nom: 'Kouassi A.' }],
      lignes_count: 12,
      ...surcharge,
    };
  }

  function creer(
    options: {
      sessions?: SessionCuisine[];
      peutOuvrir?: boolean;
      peutFermer?: boolean;
      erreurFermeture?: string;
    } = {},
  ) {
    const ouvrir = vi.fn().mockReturnValue(of(session()));
    const fermer = options.erreurFermeture
      ? vi.fn().mockReturnValue(
          throwError(
            () =>
              new HttpErrorResponse({
                status: 409,
                error: { message: options.erreurFermeture },
              }),
          ),
        )
      : vi.fn().mockReturnValue(of(session({ statut: 'fermee' })));
    const production = vi.fn().mockReturnValue(
      of({
        session: session(),
        production: [
          { produit_id: 1, produit: 'Poulet braisé', categorie: 'Plats', quantite: 5, ca: 15000 },
          { produit_id: 2, produit: 'Attiéké', categorie: 'Plats', quantite: 3, ca: 3000 },
        ],
      }),
    );
    const list = vi
      .fn()
      .mockReturnValue(of({ sessions: options.sessions ?? [session()], pagination: {} }));

    TestBed.configureTestingModule({
      providers: [
        {
          provide: SessionCuisineService,
          useValue: { list, ouvrir, fermer, production },
        },
        { provide: PointDeVenteService, useValue: { list: () => of(PDV) } },
        { provide: UserService, useValue: { list: () => of(PERSONNEL) } },
        {
          provide: AuthService,
          useValue: {
            hasPermission: (p: string) =>
              p === 'session_cuisine.ouvrir'
                ? options.peutOuvrir !== false
                : options.peutFermer !== false,
          },
        },
        {
          provide: SelectedSiteService,
          useValue: {
            selectedSite: () => ({ id: 1, nom: 'Site principal' }),
            estConsolide: () => false,
            selectedId: () => 1,
          },
        },
      ],
    });

    const page = TestBed.runInInjectionContext(() => new SessionsCuisinePage());
    page.ngOnInit();
    TestBed.tick();

    return { page, ouvrir, fermer, production, list };
  }

  it('ne propose que les points de vente du site courant', () => {
    // Une cuisine appartient à un point de vente : proposer ceux d'un autre
    // site imputerait un service à une brigade qui n'y était pas.
    const { page } = creer();

    expect(page.pointsDeVente().map((p) => p.nom)).toEqual(['Restaurant', 'Lounge']);
  });

  /**
   * Qui ouvre fait partie de l'équipe — l'API l'ajoute d'office. L'écran n'a
   * donc pas à le cocher, mais il ne doit pas non plus l'empêcher.
   */
  it('ouvre un service avec la brigade cochée', () => {
    const { page, ouvrir } = creer();
    page.openOuvrir();
    page.ouvrirForm.patchValue({ libelle: 'Soir' });
    page.basculerMembre('uuid-commis');

    page.ouvrir();

    expect(ouvrir).toHaveBeenCalledWith({
      point_de_vente_id: 1,
      libelle: 'Soir',
      notes: null,
      brigade: ['uuid-commis'],
    });
  });

  it('cache l’ouverture à qui n’en a pas le droit', () => {
    const { page } = creer({ peutOuvrir: false });

    expect(page.peutOuvrir()).toBe(false);
  });

  /**
   * Un seul service ouvert par point de vente, même règle que la caisse : deux
   * services ouverts rendraient le rattachement des plats ambigu.
   */
  it('reconnaît le service ouvert', () => {
    const { page } = creer({
      sessions: [session({ id: 9, statut: 'fermee' }), session({ id: 4, statut: 'ouverte' })],
    });

    expect(page.sessionOuverte()?.id).toBe(4);
  });

  it('ne voit aucun service ouvert quand tous sont clos', () => {
    const { page } = creer({ sessions: [session({ statut: 'fermee' })] });

    expect(page.sessionOuverte()).toBeNull();
  });

  /**
   * La fermeture sert à CORRIGER l'équipe, pas à la ressaisir : repartir d'une
   * liste vide ferait perdre la brigade au moindre oubli.
   */
  it('repart de la brigade déclarée à la fermeture', () => {
    const { page } = creer();

    page.openFermer(session());

    expect(page.estDansBrigade('uuid-chef')).toBe(true);
    expect(page.estDansBrigade('uuid-commis')).toBe(false);
  });

  it('envoie l’équipe corrigée à la fermeture', () => {
    const { page, fermer } = creer();
    page.openFermer(session());

    page.basculerMembre('uuid-commis');
    page.fermer();

    expect(fermer).toHaveBeenCalledWith(4, {
      notes: null,
      brigade: ['uuid-chef', 'uuid-commis'],
    });
  });

  /**
   * Le refus le plus fréquent de cet écran nomme les plats encore en
   * production : c'est une consigne, pas une panne. L'écraser d'un message
   * générique perdrait la seule information utile.
   */
  it('relaie le refus de fermer tant que des plats sont en production', () => {
    const { page } = creer({
      erreurFermeture: 'Le service de cuisine #4 porte encore 3 plat(s) non annoncés au pass.',
    });
    page.openFermer(session());

    page.fermer();

    expect(page.formError()).toContain('3 plat(s) non annoncés au pass');
  });

  it('charge la production et en fait les totaux', () => {
    const { page, production } = creer();

    page.openProduction(session());

    expect(production).toHaveBeenCalledWith(4);
    expect(page.totalProduit()).toBe(8);
    expect(page.caProduit()).toBe(18000);
  });

  it('nomme l’équipe, et non seulement qui a ouvert', () => {
    // Un service se tient à plusieurs : n'afficher que `ouvert_par` ne dirait
    // que qui a tourné la clé.
    const { page } = creer();

    expect(
      page.brigadeLibelle(
        session({
          brigade: [
            { id: 'a', nom: 'Kouassi A.' },
            { id: 'b', nom: 'Aminata D.' },
          ],
        }),
      ),
    ).toBe('Kouassi A. · Aminata D.');
  });

  it('n’invente pas d’équipe quand il n’y en a pas', () => {
    const { page } = creer();

    expect(page.brigadeLibelle(session({ brigade: [] }))).toBe('—');
  });
});
