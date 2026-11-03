import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { ProduitDetailPage } from './produit-detail.page';
import { FicheTechnique } from '../../../core/api/fiche-technique/fiche-technique.model';
import { FicheTechniqueService } from '../../../core/api/fiche-technique/fiche-technique.service';
import { MatierePremiereService } from '../../../core/api/matiere-premiere/matiere-premiere.service';
import { PdfService } from '../../../core/api/pdf/pdf.service';
import { ProduitService } from '../../../core/api/produit/produit.service';
import { SousRecetteService } from '../../../core/api/sous-recette/sous-recette.service';
import { UniteDeMesureService } from '../../../core/api/unite-de-mesure/unite-de-mesure.service';
import { AuthService } from '../../../core/auth/auth.service';
import { SelectedSiteService } from '../../../core/site/selected-site.service';

/**
 * Une fiche qui liste les matières sans dire quoi en faire n'est pas
 * exécutable : un extra tient la liste des courses, pas la recette. Ces tests
 * portent sur ce que le tiroir envoie à l'API — l'ordre au premier chef, car
 * c'est lui qui EST la recette.
 */
describe('ProduitDetailPage — méthodologie de la fiche', () => {
  function fiche(surcharge: Partial<FicheTechnique> = {}): FicheTechnique {
    return {
      id: 3,
      produit_id: 7,
      version: 1,
      statut: 'active',
      cout_matiere: '1500.00',
      updated_by: null,
      lignes_matieres: [
        { id: 1, fiche_technique_id: 3, matiere_premiere_id: 4, unite_id: 1, quantite: '2.000' },
      ],
      lignes_sous_recettes: [],
      etapes: [
        { id: 11, ordre: 1, description: 'Désosser', duree_minutes: 10 },
        { id: 12, ordre: 2, description: 'Mariner', duree_minutes: 120 },
        { id: 13, ordre: 3, description: 'Dresser', duree_minutes: null },
      ],
      materiels: [
        { id: 21, ordre: 1, libelle: 'Braisière' },
        { id: 22, ordre: 2, libelle: 'Sonde' },
      ],
      points_critiques: [
        { id: 31, ordre: 1, type: 'cuisson', type_libelle: 'Cuisson', description: '74 °C' },
      ],
      duree_totale_minutes: 130,
      created_at: '2026-08-01T10:00:00Z',
      updated_at: '2026-08-01T10:00:00Z',
      ...surcharge,
    };
  }

  function creer(
    ficheActive: FicheTechnique | null = fiche(),
    create = vi.fn().mockReturnValue(of({})),
  ) {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ProduitService,
          useValue: {
            get: () => of({ id: 7, libelle: 'Poulet braisé', fiche_technique: ficheActive }),
          },
        },
        { provide: FicheTechniqueService, useValue: { create, historique: () => of([]) } },
        { provide: SousRecetteService, useValue: { list: () => of([]) } },
        { provide: MatierePremiereService, useValue: { list: () => of([]) } },
        { provide: UniteDeMesureService, useValue: { list: () => of([]) } },
        { provide: PdfService, useValue: { ficheTechnique: () => of(new Blob()) } },
        { provide: AuthService, useValue: { hasPermission: () => true } },
        provideRouter([]),
        {
          provide: SelectedSiteService,
          useValue: { estConsolide: () => false, selectedId: () => 1 },
        },
      ],
    });

    const page = TestBed.runInInjectionContext(() => new ProduitDetailPage());
    page.ngOnInit();

    return { page, create };
  }

  /**
   * Même jeu de doubles, mais avec le template rendu : nécessaire dès que le
   * comportement porte sur le DOM (ici le recentrage sur l'alerte).
   */
  function rendre(create: Parameters<typeof creer>[1]) {
    creer(fiche(), create);

    const fixture = TestBed.createComponent(ProduitDetailPage);
    fixture.detectChanges();

    return fixture;
  }

  /**
   * Une nouvelle version part de la précédente : sans reprise, corriger une
   * quantité effacerait tout le mode opératoire au passage.
   */
  it('reprend la méthodologie de la version active à l’ouverture du tiroir', () => {
    const { page } = creer();

    page.openFicheDrawer();

    expect(page.etapes().map((g) => g.value.description)).toEqual([
      'Désosser',
      'Mariner',
      'Dresser',
    ]);
    expect(page.materiels().map((g) => g.value.libelle)).toEqual(['Braisière', 'Sonde']);
    expect(page.pointsCritiques()[0].value.type).toBe('cuisson');
  });

  /**
   * L'ordre EST la recette : mariner après avoir servi n'est pas la même chose
   * que mariner avant. Aucun `ordre` n'est envoyé — le serveur numérote d'après
   * la position, ce qui interdit deux étapes au même rang.
   */
  it('envoie les étapes dans l’ordre de la liste, sans champ d’ordre', () => {
    const { page, create } = creer();
    page.openFicheDrawer();

    page.save();

    const payload = create.mock.calls[0][0];
    expect(payload.etapes).toEqual([
      { description: 'Désosser', duree_minutes: 10 },
      { description: 'Mariner', duree_minutes: 120 },
      { description: 'Dresser', duree_minutes: null },
    ]);
  });

  it('réordonne réellement la recette', () => {
    const { page, create } = creer();
    page.openFicheDrawer();

    page.deplacerEtape(page.etapes()[2], -1);
    page.save();

    expect(
      create.mock.calls[0][0].etapes.map((e: { description: string }) => e.description),
    ).toEqual(['Désosser', 'Dresser', 'Mariner']);
  });

  it('ne déplace rien au-delà des bornes', () => {
    const { page } = creer();
    page.openFicheDrawer();
    const avant = page.etapes().map((g) => g.value.description);

    page.deplacerEtape(page.etapes()[0], -1);
    page.deplacerEtape(page.etapes()[2], 1);

    expect(page.etapes().map((g) => g.value.description)).toEqual(avant);
  });

  it('envoie le matériel comme une simple liste de libellés', () => {
    const { page, create } = creer();
    page.openFicheDrawer();

    page.save();

    expect(create.mock.calls[0][0].materiels).toEqual(['Braisière', 'Sonde']);
  });

  /**
   * Une durée vide part à `null` et non à `0` : « 0 min » se lirait comme un
   * geste instantané sur la fiche imprimée.
   */
  it('envoie une durée absente à null', () => {
    const { page, create } = creer();
    page.openFicheDrawer();
    page.addEtape();
    page.etapes()[3].patchValue({ description: 'Reposer', duree_minutes: null });

    page.save();

    expect(create.mock.calls[0][0].etapes[3]).toEqual({
      description: 'Reposer',
      duree_minutes: null,
    });
  });

  it('refuse d’enregistrer une étape sans description', () => {
    // Une étape vide s'imprimerait comme un numéro suivi de rien.
    const { page, create } = creer();
    page.openFicheDrawer();
    page.addEtape();

    page.save();

    expect(create).not.toHaveBeenCalled();
  });

  it('accepte une fiche sans aucune méthodologie', () => {
    // Les fiches existantes n'en ont pas, et un plat d'assemblage n'a pas de
    // mode opératoire : l'exiger casserait la saisie.
    const { page, create } = creer(fiche({ etapes: [], materiels: [], points_critiques: [] }));
    page.openFicheDrawer();

    page.save();

    expect(create).toHaveBeenCalled();
    expect(create.mock.calls[0][0].etapes).toEqual([]);
  });

  /**
   * Un refus du serveur doit se lire. Le détail d'un 422 vit dans `errors`, pas
   * dans le `message` générique : sans cette reprise, l'écran resterait muet
   * alors que c'est l'étape 2 qui est en cause.
   */
  it('affiche l’erreur de champ d’un 422 sur une étape', () => {
    const create = vi.fn().mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: {
              status: 'error',
              message: 'Les données fournies sont invalides.',
              errors: {
                'etapes.1.duree_minutes': ['La durée ne peut pas dépasser 1440 minutes.'],
              },
            },
          }),
      ),
    );
    const { page } = creer(fiche(), create);
    page.openFicheDrawer();

    page.save();

    expect(page.formError()).toBe('La durée ne peut pas dépasser 1440 minutes.');
    expect(page.saving()).toBe(false);
  });

  /**
   * L'alerte est en tête du corps défilant et on enregistre depuis le pied
   * fixe, donc depuis le bas des étapes : sans recentrage, le refus s'affiche
   * hors écran et l'enregistrement paraît muet — le symptôme signalé.
   */
  it('ramène le tiroir sur l’alerte quand le serveur refuse', () => {
    const create = vi.fn().mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: { status: 'error', message: 'Les données fournies sont invalides.' },
          }),
      ),
    );
    const fixture = rendre(create);
    const page = fixture.componentInstance;

    page.openFicheDrawer();
    fixture.detectChanges();

    const corps = fixture.nativeElement.querySelector('.drawer-body') as HTMLElement;
    const scrollTo = vi.fn();
    corps.scrollTo = scrollTo;

    page.save();

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });

  it('joint le matériel d’un trait pour l’affichage', () => {
    const { page } = creer();

    expect(page.materielLibelles(fiche())).toBe('Braisière · Sonde');
  });
});
