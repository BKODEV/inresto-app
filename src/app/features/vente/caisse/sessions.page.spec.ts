import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { SessionsPage } from './sessions.page';
import { EcartSens } from '../../../core/api/session-caisse/session-caisse.model';
import { SessionCaisseService } from '../../../core/api/session-caisse/session-caisse.service';
import { CaisseService } from '../../../core/api/caisse/caisse.service';
import { PdfService } from '../../../core/api/pdf/pdf.service';
import { VersementService } from '../../../core/api/versement/versement.service';
import { AuthService } from '../../../core/auth/auth.service';
import { ModeDePaiementService } from '../../../core/api/mode-de-paiement/mode-de-paiement.service';
import { SelectedSiteService } from '../../../core/site/selected-site.service';

/**
 * L'écran de fermeture est un écran de contrôle : ce qu'il affiche décide si un
 * responsable va chercher une erreur ou passe son chemin. Ces tests portent sur
 * ce que les chiffres prétendent dire.
 */
describe('SessionsPage — lecture de l’écart de caisse', () => {
  function creer(options: { fermer?: unknown; peutVerser?: boolean; peutForcer?: boolean } = {}) {
    const rapportFermeture = vi.fn().mockReturnValue(of(new Blob()));
    const creerVersement = vi.fn().mockReturnValue(of({ id: 1, montant: '100000.00' }));

    TestBed.configureTestingModule({
      providers: [
        {
          provide: SessionCaisseService,
          useValue: { list: () => of([]), fermer: options.fermer ?? vi.fn() },
        },
        { provide: PdfService, useValue: { rapportFermeture } },
        {
          provide: ModeDePaiementService,
          useValue: {
            list: () =>
              of([
                { id: 5, libelle: 'Espèces', compte_en_caisse: true, ordre: 1, statut: 'actif' },
                { id: 9, libelle: 'Carte', compte_en_caisse: false, ordre: 2, statut: 'actif' },
              ]),
          },
        },
        { provide: CaisseService, useValue: { list: () => of([]) } },
        {
          provide: VersementService,
          useValue: { list: () => of([]), create: creerVersement },
        },
        {
          provide: AuthService,
          useValue: {
            hasPermission: (p: string) =>
              p === 'session_caisse.forcer_fermeture'
                ? options.peutForcer === true
                : options.peutVerser !== false,
          },
        },
        {
          provide: SelectedSiteService,
          useValue: { selectedSite: () => null, estConsolide: () => false, selectedId: () => 1 },
        },
      ],
    });

    const page = TestBed.runInInjectionContext(() => new SessionsPage());

    return { page, rapportFermeture, creerVersement };
  }

  it('nomme les quatre sens de l’écart', () => {
    const { page } = creer();

    expect(page.libelleEcart).toEqual({
      non_rapproche: 'Non rapproché',
      juste: 'Caisse juste',
      tolere: 'Écart toléré',
      excedent: 'Excédent',
      manquant: 'Manquant',
    });
  });

  it('couvre chaque sens renvoyé par l’API', () => {
    // Un sens sans libellé afficherait une cellule vide sur un écran d'argent.
    const { page } = creer();
    const sens: EcartSens[] = ['non_rapproche', 'juste', 'tolere', 'excedent', 'manquant'];

    for (const s of sens) {
      expect(page.libelleEcart[s]).toBeTruthy();
    }
  });

  /**
   * Le rapport se classe dans le tiroir en le refermant : le sortir à la main
   * après coup serait un geste qu'on oublie le soir où il compte.
   */
  it('imprime le rapport dans la foulée de la fermeture', () => {
    const fermee = { id: 4, statut: 'fermee', ecart: '0.00' };
    const { page, rapportFermeture } = creer({ fermer: vi.fn().mockReturnValue(of(fermee)) });

    page.closingSession.set({ id: 4 } as never);
    page.fermer();

    expect(rapportFermeture).toHaveBeenCalledWith(4);
  });

  it('réimprime le rapport d’une session déjà fermée', () => {
    // Un ticket se perd ; le rapprochement doit rester consultable.
    const { page, rapportFermeture } = creer();

    page.imprimerRapport({ id: 9 } as never);

    expect(rapportFermeture).toHaveBeenCalledWith(9);
  });

  /**
   * Le montant attendu ne doit JAMAIS être proposé avant la saisie : le
   * caissier le recopierait au lieu de compter, et le rapprochement ne
   * vaudrait plus rien.
   */
  it('ouvre la fermeture sur des cases vides, sans souffler aucun théorique', () => {
    const { page } = creer();

    page.openFermer({
      id: 4,
      statut: 'ouverte',
      fonds_initial: '100.00',
      ouvert_le: '2026-08-21T08:00:00Z',
    } as never);

    // Vaut pour le tiroir comme pour le terminal : afficher le montant attendu
    // inviterait à le recopier au lieu de compter.
    expect(page.constats()).toEqual({});
  });

  /**
   * Tout moyen de paiement accepté est vérifiable le soir même. Fermer sans
   * compter reviendrait à clôturer sans avoir contrôlé, et l'écart de ce
   * contenant ne se verrait jamais.
   */
  it('refuse de fermer tant qu’un contenant n’est pas compté', () => {
    const fermer = vi.fn().mockReturnValue(of({ id: 4, statut: 'fermee' }));
    const { page } = creer({ fermer });
    page.ngOnInit();

    page.openFermer({ id: 4 } as never);
    page.onConstat(5, '183500'); // les espèces seulement, la carte manque

    expect(page.contenantsNonComptes().map((m) => m.libelle)).toEqual(['Carte']);

    page.fermer();

    expect(fermer).not.toHaveBeenCalled();
    expect(page.formError()).toContain('Carte');
  });

  it('transmet tous les contenants une fois tous comptés', () => {
    const fermer = vi.fn().mockReturnValue(of({ id: 4, statut: 'fermee' }));
    const { page } = creer({ fermer });
    page.ngOnInit();

    page.openFermer({ id: 4 } as never);
    page.onConstat(5, '183500');
    page.onConstat(9, '80000');
    page.fermer();

    expect(fermer).toHaveBeenCalledWith(4, {
      notes: '',
      rapprochements: [
        { mode_de_paiement_id: 5, montant_constate: 183500 },
        { mode_de_paiement_id: 9, montant_constate: 80000 },
      ],
    });
  });

  it('tient zéro pour un compte, et une case effacée pour une absence', () => {
    const fermer = vi.fn().mockReturnValue(of({ id: 4, statut: 'fermee' }));
    const { page } = creer({ fermer });
    page.ngOnInit();

    page.openFermer({ id: 4 } as never);
    page.onConstat(5, '0');
    page.onConstat(9, '0');

    expect(page.contenantsNonComptes()).toEqual([]);

    page.onConstat(9, '');

    expect(page.contenantsNonComptes().map((m) => m.libelle)).toEqual(['Carte']);
  });

  // ───────────────────────── versements ─────────────────────────

  /**
   * Sortir de l'argent du tiroir est un geste distinct de l'encaissement : sans
   * permission dédiée, tout caissier pourrait vider la caisse du seul fait
   * qu'il sait y encaisser.
   */
  it('cache le versement à qui n’en a pas le droit', () => {
    const { page } = creer({ peutVerser: false });

    expect(page.peutVerser()).toBe(false);
  });

  it('n’envoie que les champs renseignés', () => {
    const { page, creerVersement } = creer();
    page.selectedCaisseId.set(3);

    page.openVerser();
    page.verserForm.patchValue({ montant: 100000, destination: 'coffre', remis_a: 'Aminata D.' });
    page.verser();

    expect(creerVersement).toHaveBeenCalledWith(3, {
      montant: 100000,
      destination: 'coffre',
      remis_a: 'Aminata D.',
      // Les champs laissés vides partent à null plutôt qu'en chaîne vide, qui
      // se lirait comme une référence de bordereau existante mais illisible.
      reference: null,
      notes: null,
    });
  });

  it('refuse un versement sans montant', () => {
    const { page, creerVersement } = creer();
    page.selectedCaisseId.set(3);

    page.openVerser();
    page.verser();

    expect(creerVersement).not.toHaveBeenCalled();
  });

  it('ouvre le versement sur le coffre, destination la plus courante', () => {
    const { page } = creer();

    page.openVerser();

    expect(page.verserForm.getRawValue().destination).toBe('coffre');
    expect(page.verserForm.getRawValue().montant).toBe(0);
  });

  // ───────────────────────── fermeture forcée ─────────────────────────

  /**
   * Exiger un compte par contenant est la bonne règle, mais une règle sans
   * issue immobilise : un terminal en panne et la caisse ne se ferme plus, donc
   * le service suivant ne démarre pas.
   */
  it('laisse passer outre le compte à qui en a la permission', () => {
    const fermer = vi.fn().mockReturnValue(of({ id: 4, statut: 'fermee' }));
    const { page } = creer({ fermer, peutForcer: true });
    page.ngOnInit();

    page.openFermer({ id: 4 } as never);
    page.onConstat(5, '183500'); // la carte reste non comptée
    page.fermerForm.patchValue({ forcer: true, motif_forcage: 'Terminal en panne.' });
    page.fermer();

    expect(fermer).toHaveBeenCalledWith(
      4,
      expect.objectContaining({ forcer: true, motif_forcage: 'Terminal en panne.' }),
    );
  });

  it('exige un motif pour forcer', () => {
    // Un forçage sans explication ne vaut pas mieux qu'un trou.
    const fermer = vi.fn().mockReturnValue(of({ id: 4, statut: 'fermee' }));
    const { page } = creer({ fermer, peutForcer: true });
    page.ngOnInit();

    page.openFermer({ id: 4 } as never);
    page.fermerForm.patchValue({ forcer: true, motif_forcage: '   ' });
    page.fermer();

    expect(fermer).not.toHaveBeenCalled();
    expect(page.formError()).toContain('Expliquez');
  });

  it('ignore la case de forçage sans la permission', () => {
    // Savoir fermer une caisse ne doit pas suffire à contourner le contrôle.
    const fermer = vi.fn().mockReturnValue(of({ id: 4, statut: 'fermee' }));
    const { page } = creer({ fermer, peutForcer: false });
    page.ngOnInit();

    page.openFermer({ id: 4 } as never);
    page.fermerForm.patchValue({ forcer: true, motif_forcage: 'Peu importe.' });
    page.fermer();

    expect(fermer).not.toHaveBeenCalled();
    expect(page.formError()).toContain('Comptez chaque');
  });

  it('ne marque pas forcée une fermeture où tout est compté', () => {
    const fermer = vi.fn().mockReturnValue(of({ id: 4, statut: 'fermee' }));
    const { page } = creer({ fermer, peutForcer: true });
    page.ngOnInit();

    page.openFermer({ id: 4 } as never);
    page.onConstat(5, '100');
    page.onConstat(9, '0');
    page.fermer();

    expect(fermer.mock.calls[0][1]).not.toHaveProperty('forcer');
  });
});

/**
 * Le tiroir de versement existait, ouvrable par `openVerser()` — mais AUCUN
 * élément du gabarit ne l'appelait, et la liste chargée par `loadSessions()`
 * n'était affichée nulle part. Le code passait les tests unitaires ci-dessus
 * tout en étant inatteignable à la souris.
 *
 * Ces tests rendent l'écran plutôt que la classe : c'est le seul niveau où
 * « il manque le bouton » se voit.
 */
describe('SessionsPage — le versement doit être atteignable', () => {
  const CAISSE = {
    id: 3,
    libelle: 'Caisse principale',
    point_de_vente: { id: 1, nom: 'Bar', site_id: 1 },
  };

  const VERSEMENT = {
    id: 12,
    caisse_id: 3,
    session_caisse_id: 4,
    montant: '200000.00',
    destination: 'coffre',
    destination_libelle: 'Coffre',
    beneficiaire_id: null,
    remis_a: 'Aminata D.',
    reference: 'BD-4417',
    notes: null,
    date_heure: '2026-08-29T19:30:00+00:00',
    en_service: true,
    auteur: 'Kouassi A.',
  };

  function rendre(
    options: { peutVerser?: boolean; versements?: unknown[]; sessions?: unknown[] } = {},
  ) {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: SessionCaisseService,
          useValue: { list: () => of(options.sessions ?? [{ id: 4, statut: 'fermee' }]) },
        },
        { provide: PdfService, useValue: { rapportFermeture: vi.fn() } },
        { provide: ModeDePaiementService, useValue: { list: () => of([]) } },
        { provide: CaisseService, useValue: { list: () => of([CAISSE]) } },
        {
          provide: VersementService,
          useValue: { list: () => of(options.versements ?? []), create: vi.fn() },
        },
        {
          provide: AuthService,
          useValue: { hasPermission: () => options.peutVerser !== false },
        },
        {
          provide: SelectedSiteService,
          useValue: {
            selectedSite: () => ({ id: 1, nom: 'Site principal' }),
            estConsolide: () => false,
            selectedId: () => 1,
            sites: () => [],
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(SessionsPage);
    fixture.detectChanges();

    return fixture;
  }

  function boutons(fixture: ReturnType<typeof rendre>): HTMLButtonElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('button'));
  }

  it('offre un bouton « Verser » qui ouvre le tiroir', () => {
    const fixture = rendre();

    const verser = boutons(fixture).find((b) => b.textContent?.trim() === 'Verser');
    expect(verser).toBeDefined();
    expect(verser!.disabled).toBe(false);

    verser!.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.drawerMode()).toBe('verser');
    expect(fixture.nativeElement.textContent).toContain("Sortir de l'argent du tiroir");
  });

  it('ne propose pas le versement à qui n’en a pas le droit', () => {
    const fixture = rendre({ peutVerser: false });

    expect(boutons(fixture).some((b) => b.textContent?.trim() === 'Verser')).toBe(false);
  });

  /**
   * L'API rattache le versement à la dernière session connue : sans aucune
   * session, elle n'a rien à quoi le rattacher et refuse. Autant ne pas offrir
   * le geste plutôt que de le laisser échouer.
   */
  it('désactive le versement sur une caisse qui n’a jamais servi', () => {
    const fixture = rendre({ sessions: [] });

    const verser = boutons(fixture).find((b) => b.textContent?.trim() === 'Verser');
    expect(verser!.disabled).toBe(true);
  });

  /**
   * Un manquant s'explique en une ligne quand le versement au coffre est
   * affiché à côté des sessions, et se cherche une heure quand il ne l'est pas.
   */
  it('affiche les sorties de tiroir sous les sessions', () => {
    const fixture = rendre({ versements: [VERSEMENT] });

    const texte: string = fixture.nativeElement.textContent;
    expect(texte).toContain('Sorties de tiroir');
    expect(texte).toContain('Coffre');
    expect(texte).toContain('Aminata D.');
    expect(texte).toContain('BD-4417');
    expect(texte).toContain('En service');
    expect(texte).toContain('Kouassi A.');
  });

  it('nomme le bénéficiaire d’un reversement de pourboires', () => {
    // Destination « personnel » : ce n'est pas `remis_a` qui porte le nom, mais
    // le bénéficiaire du solde débité.
    const fixture = rendre({
      versements: [
        {
          ...VERSEMENT,
          destination: 'personnel',
          destination_libelle: 'Personnel',
          beneficiaire_id: 'uuid-kouassi',
          beneficiaire: 'Kouassi A.',
          remis_a: null,
        },
      ],
    });

    expect(fixture.nativeElement.textContent).toContain('Kouassi A.');
  });

  it('n’affiche aucune liste de sorties sans le droit de verser', () => {
    // La liste n'est même pas chargée : l'afficher vide laisserait croire que
    // rien n'est jamais sorti du tiroir.
    const fixture = rendre({ peutVerser: false, versements: [VERSEMENT] });

    expect(fixture.nativeElement.textContent).not.toContain('Sorties de tiroir');
  });
});
