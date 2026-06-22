import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { ProduitService } from '../../../core/api/produit/produit.service';
import { Produit } from '../../../core/api/produit/produit.model';
import { FicheTechniqueService } from '../../../core/api/fiche-technique/fiche-technique.service';
import {
  FicheTechnique,
  LigneFicheTechnique,
  LigneFicheTechniqueSousRecette,
} from '../../../core/api/fiche-technique/fiche-technique.model';
import { SousRecetteService } from '../../../core/api/sous-recette/sous-recette.service';
import { SousRecette } from '../../../core/api/sous-recette/sous-recette.model';
import { MatierePremiereService } from '../../../core/api/matiere-premiere/matiere-premiere.service';
import { MatierePremiere } from '../../../core/api/matiere-premiere/matiere-premiere.model';
import { UniteDeMesureService } from '../../../core/api/unite-de-mesure/unite-de-mesure.service';
import { UniteDeMesure } from '../../../core/api/unite-de-mesure/unite-de-mesure.model';
import { AuthService } from '../../../core/auth/auth.service';
import { apiErrorMessage } from '../../../core/api/api-error.util';

/**
 * Détail d'un produit = point d'entrée unique de la recette : informations
 * produit + fiche technique active (lignes matières & sous-recettes) + coût de
 * référence. La création/édition de la fiche (versionnée) se fait ici, depuis le
 * produit ; l'écran « Fiches techniques » ne sert plus qu'à consulter/imprimer.
 */
@Component({
  selector: 'app-produit-detail-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
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
  readonly lignesMatieres = signal<FormGroup[]>([]);
  readonly lignesSousRecettes = signal<FormGroup[]>([]);

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

  print(): void {
    window.print();
  }

  // ── Drawer fiche ──────────────────────────────────────────────────────────

  private matiereGroup(ligne?: LigneFicheTechnique): FormGroup {
    return this.fb.group({
      matiere_premiere_id: [ligne?.matiere_premiere_id ?? null, [Validators.required]],
      unite_id: [ligne?.unite_id ?? null, [Validators.required]],
      quantite: [
        ligne ? Number(ligne.quantite) : null,
        [Validators.required, Validators.min(0.001)],
      ],
    });
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

    if (
      totalLignes === 0 ||
      matieres.some((g) => g.invalid) ||
      sousRecettes.some((g) => g.invalid) ||
      this.saving()
    ) {
      matieres.forEach((g) => g.markAllAsTouched());
      sousRecettes.forEach((g) => g.markAllAsTouched());
      if (totalLignes === 0) {
        this.formError.set('Ajoutez au moins une matière ou une sous-recette.');
      }
      return;
    }
    this.saving.set(true);
    this.formError.set(null);

    const payload = {
      produit_id: this.produitId,
      lignes_matieres: matieres.map((g) => ({
        matiere_premiere_id: g.value.matiere_premiere_id as number,
        unite_id: g.value.unite_id as number,
        quantite: g.value.quantite as number,
      })),
      lignes_sous_recettes: sousRecettes.map((g) => ({
        sous_recette_id: g.value.sous_recette_id as number,
        quantite: g.value.quantite as number,
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
        },
      });
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
