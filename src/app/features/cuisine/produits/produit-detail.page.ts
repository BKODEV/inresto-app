import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { ProduitService } from '../../../core/api/produit/produit.service';
import { Produit } from '../../../core/api/produit/produit.model';
import { FicheTechniqueService } from '../../../core/api/fiche-technique/fiche-technique.service';
import {
  EtapeFicheTechnique,
  FicheTechnique,
  LigneFicheTechnique,
  LigneFicheTechniqueSousRecette,
  PointCritiqueFicheTechnique,
  TypePointCritique,
} from '../../../core/api/fiche-technique/fiche-technique.model';
import { SousRecetteService } from '../../../core/api/sous-recette/sous-recette.service';
import { SousRecette } from '../../../core/api/sous-recette/sous-recette.model';
import { MatierePremiereService } from '../../../core/api/matiere-premiere/matiere-premiere.service';
import { MatierePremiere } from '../../../core/api/matiere-premiere/matiere-premiere.model';
import { UniteDeMesureService } from '../../../core/api/unite-de-mesure/unite-de-mesure.service';
import { UniteDeMesure } from '../../../core/api/unite-de-mesure/unite-de-mesure.model';
import { AuthService } from '../../../core/auth/auth.service';
import { apiErrorMessage } from '../../../core/api/api-error.util';
import { PdfService, ouvrirPdfDansOnglet } from '../../../core/api/pdf/pdf.service';
import { SelectedSiteService } from '../../../core/site/selected-site.service';
import { QuantitePipe } from '../../../shared/format/nombre.pipes';

/**
 * Détail d'un produit = point d'entrée unique de la recette : informations
 * produit + fiche technique active (lignes matières & sous-recettes) + coût de
 * référence. La création/édition de la fiche (versionnée) se fait ici, depuis le
 * produit ; l'écran « Fiches techniques » ne sert plus qu'à consulter/imprimer.
 */
@Component({
  selector: 'app-produit-detail-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, QuantitePipe],
  templateUrl: './produit-detail.page.html',
  styleUrl: './produit-detail.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProduitDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly produitService = inject(ProduitService);
  private readonly ficheService = inject(FicheTechniqueService);
  private readonly sousRecetteService = inject(SousRecetteService);
  private readonly matiereService = inject(MatierePremiereService);
  private readonly uniteService = inject(UniteDeMesureService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly pdfService = inject(PdfService);
  private readonly selectedSite = inject(SelectedSiteService);
  private readonly destroyRef = inject(DestroyRef);

  readonly produitId = Number(this.route.snapshot.paramMap.get('id'));

  readonly produit = signal<Produit | null>(null);
  readonly loading = signal(true);

  readonly sousRecettes = signal<SousRecette[]>([]);
  readonly matieres = signal<MatierePremiere[]>([]);
  readonly unites = signal<UniteDeMesure[]>([]);

  // Drawer fiche technique (création / nouvelle version)
  readonly drawerOpen = signal(false);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  private readonly ficheDrawerBody = viewChild<ElementRef<HTMLElement>>('ficheDrawerBody');
  readonly lignesMatieres = signal<FormGroup[]>([]);
  readonly lignesSousRecettes = signal<FormGroup[]>([]);

  /**
   * Méthodologie. L'ordre est celui des tableaux : le serveur numérote d'après
   * la position, il n'y a donc aucun champ `ordre` à saisir — mais déplacer une
   * ligne change réellement la recette, d'où `monter` / `descendre`.
   */
  readonly etapes = signal<FormGroup[]>([]);
  readonly materiels = signal<FormGroup[]>([]);
  readonly pointsCritiques = signal<FormGroup[]>([]);

  readonly typesPointCritique: { valeur: TypePointCritique; libelle: string }[] = [
    { valeur: 'cuisson', libelle: 'Cuisson' },
    { valeur: 'refroidissement', libelle: 'Refroidissement' },
    { valeur: 'conservation', libelle: 'Conservation' },
    { valeur: 'allergene', libelle: 'Allergène' },
    { valeur: 'hygiene', libelle: 'Hygiène' },
    { valeur: 'autre', libelle: 'Autre' },
  ];

  // Impression de la fiche (PDF servi par le back)
  readonly pdfBusy = signal(false);
  readonly pdfError = signal<string | null>(null);
  /** En vue consolidée il n'y a pas de site, donc pas d'en-tête à imprimer. */
  readonly estConsolide = this.selectedSite.estConsolide;

  // Historique
  readonly historiqueOpen = signal(false);
  readonly historique = signal<FicheTechnique[]>([]);
  readonly historiqueLoading = signal(false);

  /** Fiche technique active embarquée dans le produit (null si absente). */
  readonly fiche = computed(() => this.produit()?.fiche_technique ?? null);

  readonly canManage = computed(() => this.auth.hasPermission('fichetechnique.create'));

  private readonly montantFormatter = new Intl.NumberFormat('fr-FR');

  ngOnInit(): void {
    this.load();
    this.sousRecetteService
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((data) => this.sousRecettes.set(data));
    this.matiereService
      .list({ statut: 'actif' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((data) => this.matieres.set(data));
    this.uniteService
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((data) => this.unites.set(data));
  }

  private load(): void {
    this.loading.set(true);
    this.produitService
      .get(this.produitId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (produit) => {
          this.produit.set(produit);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  formatMontant(value: string | null | undefined): string {
    return this.montantFormatter.format(Number(value ?? 0));
  }

  matiereLibelle(ligne: LigneFicheTechnique): string {
    return (
      ligne.matiere_premiere?.libelle ??
      this.matieres().find((m) => m.id === ligne.matiere_premiere_id)?.libelle ??
      `Matière #${ligne.matiere_premiere_id}`
    );
  }

  uniteSymbole(ligne: LigneFicheTechnique): string {
    return (
      ligne.unite?.symbole ?? this.unites().find((u) => u.id === ligne.unite_id)?.symbole ?? ''
    );
  }

  sousRecetteLibelle(ligne: LigneFicheTechniqueSousRecette): string {
    return (
      ligne.sous_recette?.libelle ??
      this.sousRecettes().find((s) => s.id === ligne.sous_recette_id)?.libelle ??
      `Sous-recette #${ligne.sous_recette_id}`
    );
  }

  statutBadge(statut: string): string {
    return statut === 'active' ? 'badge-success' : 'badge-neutral';
  }

  /**
   * Ouvre la fiche technique mise en page par le back (`fiches-techniques/{id}/pdf`).
   *
   * Cet écran appelait `window.print()`, qui imprimait la page de l'application
   * — barre latérale et chrome compris — au lieu du document de production
   * attendu en atelier. Le gabarit PDF existait déjà et sert la liste des
   * fiches ; on emprunte le même chemin.
   */
  imprimerFiche(): void {
    const fiche = this.fiche();
    if (this.pdfBusy() || fiche === null) {
      return;
    }

    this.pdfBusy.set(true);
    this.pdfError.set(null);
    this.pdfService
      .ficheTechnique(fiche.id, this.selectedSite.selectedId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          ouvrirPdfDansOnglet(blob, `fiche-technique-${fiche.id}.pdf`);
          this.pdfBusy.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.pdfBusy.set(false);
          this.pdfError.set(apiErrorMessage(err, 'Génération de la fiche PDF impossible.'));
        },
      });
  }

  // ── Drawer fiche ──────────────────────────────────────────────────────────

  private matiereGroup(ligne?: LigneFicheTechnique): FormGroup {
    return this.fb.group({
      matiere_premiere_id: [ligne?.matiere_premiere_id ?? null, [Validators.required]],
      quantite: [
        ligne ? Number(ligne.quantite) : null,
        [Validators.required, Validators.min(0.001)],
      ],
    });
  }

  /**
   * Symbole de l'unité de STOCKAGE de la matière sélectionnée sur la ligne.
   * L'unité d'une ligne de fiche n'est jamais choisie : elle est imposée par la
   * matière (aucune conversion dimensionnelle côté serveur). Affichée en lecture
   * seule pour guider la saisie de la quantité.
   */
  uniteStockageSymbole(group: FormGroup): string {
    const matiereId = group.get('matiere_premiere_id')?.value as number | null;
    if (matiereId === null) {
      return '—';
    }
    const matiere = this.matieres().find((m) => m.id === matiereId);
    if (!matiere) {
      return '—';
    }
    return (
      matiere.unite?.symbole ??
      this.unites().find((u) => u.id === matiere.unite_de_mesure_id)?.symbole ??
      '—'
    );
  }

  private sousRecetteGroup(ligne?: LigneFicheTechniqueSousRecette): FormGroup {
    return this.fb.group({
      sous_recette_id: [ligne?.sous_recette_id ?? null, [Validators.required]],
      quantite: [
        ligne ? Number(ligne.quantite) : null,
        [Validators.required, Validators.min(0.001)],
      ],
    });
  }

  private etapeGroup(etape?: EtapeFicheTechnique): FormGroup {
    return this.fb.group({
      description: [etape?.description ?? '', [Validators.required, Validators.maxLength(1000)]],
      // Facultative : « laisser reposer » n'a pas toujours une durée qu'on
      // veuille chiffrer, et un zéro imposé se lirait comme « immédiat ».
      duree_minutes: [etape?.duree_minutes ?? null, [Validators.min(1), Validators.max(1440)]],
    });
  }

  private materielGroup(libelle = ''): FormGroup {
    return this.fb.group({
      libelle: [libelle, [Validators.required, Validators.maxLength(120)]],
    });
  }

  private pointCritiqueGroup(point?: PointCritiqueFicheTechnique): FormGroup {
    return this.fb.group({
      type: [point?.type ?? ('cuisson' as TypePointCritique), [Validators.required]],
      description: [point?.description ?? '', [Validators.required, Validators.maxLength(500)]],
    });
  }

  /** Le matériel se lit d'un trait, pas en liste à puces sur trois lignes. */
  materielLibelles(fiche: FicheTechnique): string {
    return (fiche.materiels ?? []).map((m) => m.libelle).join(' · ');
  }

  addEtape(): void {
    this.etapes.update((list) => [...list, this.etapeGroup()]);
  }

  removeEtape(group: FormGroup): void {
    this.etapes.update((list) => list.filter((g) => g !== group));
  }

  /**
   * Déplacer une étape n'est pas cosmétique : l'ordre EST la recette. Mariner
   * après avoir servi n'est pas la même chose que mariner avant.
   */
  deplacerEtape(group: FormGroup, sens: -1 | 1): void {
    this.etapes.update((list) => {
      const index = list.indexOf(group);
      const cible = index + sens;
      if (index === -1 || cible < 0 || cible >= list.length) {
        return list;
      }
      const suivant = [...list];
      [suivant[index], suivant[cible]] = [suivant[cible], suivant[index]];

      return suivant;
    });
  }

  addMateriel(): void {
    this.materiels.update((list) => [...list, this.materielGroup()]);
  }

  removeMateriel(group: FormGroup): void {
    this.materiels.update((list) => list.filter((g) => g !== group));
  }

  addPointCritique(): void {
    this.pointsCritiques.update((list) => [...list, this.pointCritiqueGroup()]);
  }

  removePointCritique(group: FormGroup): void {
    this.pointsCritiques.update((list) => list.filter((g) => g !== group));
  }

  addMatiere(): void {
    this.lignesMatieres.update((list) => [...list, this.matiereGroup()]);
  }

  removeMatiere(group: FormGroup): void {
    this.lignesMatieres.update((list) => list.filter((g) => g !== group));
  }

  addSousRecette(): void {
    this.lignesSousRecettes.update((list) => [...list, this.sousRecetteGroup()]);
  }

  removeSousRecette(group: FormGroup): void {
    this.lignesSousRecettes.update((list) => list.filter((g) => g !== group));
  }

  openFicheDrawer(): void {
    const fiche = this.fiche();
    this.lignesMatieres.set((fiche?.lignes_matieres ?? []).map((l) => this.matiereGroup(l)));
    this.lignesSousRecettes.set(
      (fiche?.lignes_sous_recettes ?? []).map((l) => this.sousRecetteGroup(l)),
    );
    if (this.lignesMatieres().length === 0 && this.lignesSousRecettes().length === 0) {
      this.lignesMatieres.set([this.matiereGroup()]);
    }
    // Reprise de la méthodologie de la version active : une nouvelle version
    // part de la précédente, sinon corriger une quantité effacerait la recette.
    this.etapes.set((fiche?.etapes ?? []).map((e) => this.etapeGroup(e)));
    this.materiels.set((fiche?.materiels ?? []).map((m) => this.materielGroup(m.libelle)));
    this.pointsCritiques.set(
      (fiche?.points_critiques ?? []).map((p) => this.pointCritiqueGroup(p)),
    );
    this.formError.set(null);
    this.drawerOpen.set(true);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
  }

  save(): void {
    const matieres = this.lignesMatieres();
    const sousRecettes = this.lignesSousRecettes();
    const totalLignes = matieres.length + sousRecettes.length;

    const methodologie = [...this.etapes(), ...this.materiels(), ...this.pointsCritiques()];

    if (
      totalLignes === 0 ||
      matieres.some((g) => g.invalid) ||
      sousRecettes.some((g) => g.invalid) ||
      methodologie.some((g) => g.invalid) ||
      this.saving()
    ) {
      matieres.forEach((g) => g.markAllAsTouched());
      sousRecettes.forEach((g) => g.markAllAsTouched());
      methodologie.forEach((g) => g.markAllAsTouched());
      if (totalLignes === 0) {
        this.formError.set('Ajoutez au moins une matière ou une sous-recette.');
        this.revelerErreurFormulaire();
      }
      return;
    }
    this.saving.set(true);
    this.formError.set(null);

    const payload = {
      produit_id: this.produitId,
      lignes_matieres: matieres.map((g) => ({
        matiere_premiere_id: g.value.matiere_premiere_id as number,
        quantite: g.value.quantite as number,
      })),
      lignes_sous_recettes: sousRecettes.map((g) => ({
        sous_recette_id: g.value.sous_recette_id as number,
        quantite: g.value.quantite as number,
      })),
      // Aucun `ordre` envoyé : le serveur numérote d'après la position, ce qui
      // interdit deux lignes au même rang et rend la fiche imprimée
      // déterministe.
      etapes: this.etapes().map((g) => ({
        description: (g.value.description as string).trim(),
        duree_minutes: (g.value.duree_minutes as number | null) || null,
      })),
      materiels: this.materiels().map((g) => (g.value.libelle as string).trim()),
      points_critiques: this.pointsCritiques().map((g) => ({
        type: g.value.type as TypePointCritique,
        description: (g.value.description as string).trim(),
      })),
    };

    // create() crée la v1 ou archive l'active et crée la suivante (versioning).
    this.ficheService
      .create(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.drawerOpen.set(false);
          this.load();
        },
        error: (err: HttpErrorResponse) => {
          this.saving.set(false);
          this.formError.set(apiErrorMessage(err));
          this.revelerErreurFormulaire();
        },
      });
  }

  /**
   * L'alerte vit en tête du corps défilant, or on enregistre depuis le pied
   * fixe — donc en pratique depuis le bas des étapes. Sans ce recentrage, un
   * refus du serveur (422 sur une étape, par exemple) s'affiche hors écran et
   * l'enregistrement paraît muet.
   */
  private revelerErreurFormulaire(): void {
    this.ficheDrawerBody()?.nativeElement.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ── Historique ──────────────────────────────────────────────────────────

  openHistorique(): void {
    this.historique.set([]);
    this.historiqueLoading.set(true);
    this.historiqueOpen.set(true);
    this.ficheService
      .historique(this.produitId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.historique.set(data);
          this.historiqueLoading.set(false);
        },
        error: () => this.historiqueLoading.set(false),
      });
  }

  closeHistorique(): void {
    this.historiqueOpen.set(false);
  }
}
