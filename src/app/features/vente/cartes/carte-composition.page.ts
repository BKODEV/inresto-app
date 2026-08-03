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
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { CarteService } from '../../../core/api/carte/carte.service';
import { Carte } from '../../../core/api/carte/carte.model';
import { CarteProduitService } from '../../../core/api/carte/carte-produit.service';
import { CarteProduit } from '../../../core/api/carte/carte-produit.model';
import { ProduitService } from '../../../core/api/produit/produit.service';
import { Produit } from '../../../core/api/produit/produit.model';
import { CategorieProduitService } from '../../../core/api/categorie-produit/categorie-produit.service';
import { CategorieProduit } from '../../../core/api/categorie-produit/categorie-produit.model';
import { apiErrorMessage } from '../../../core/api/api-error.util';

@Component({
  selector: 'app-carte-composition-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './carte-composition.page.html',
  styleUrl: './cartes.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CarteCompositionPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly carteService = inject(CarteService);
  private readonly ligneService = inject(CarteProduitService);
  private readonly produitService = inject(ProduitService);
  private readonly categorieService = inject(CategorieProduitService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly carteId = Number(this.route.snapshot.paramMap.get('id'));

  readonly carte = signal<Carte | null>(null);
  readonly lignes = signal<CarteProduit[]>([]);
  readonly produits = signal<Produit[]>([]);
  readonly categories = signal<CategorieProduit[]>([]);
  readonly loading = signal(true);
  readonly drawerOpen = signal(false);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly deletingId = signal<number | null>(null);

  /** Filtre catégorie du drawer d'ajout (0 = toutes). */
  readonly filtreCategorie = signal(0);

  // ── Ajout en lot ──────────────────────────────────────────────────────────
  // Composer une carte produit par produit est impraticable ; l'ajout unitaire
  // reste disponible pour insérer un plat à une position précise.

  readonly lotDrawerOpen = signal(false);
  readonly lotSaving = signal(false);
  readonly lotError = signal<string | null>(null);

  /** Sélection du lot : produit_id → prix de vente saisi. */
  readonly lotSelection = signal<Map<number, number>>(new Map());

  /** Prix à recopier sur toute la sélection, pour éviter la saisie ligne à ligne. */
  readonly lotPrixCommun = signal(0);

  readonly lotCount = computed(() => this.lotSelection().size);
  readonly lotPretAEnvoyer = computed(
    () => this.lotCount() > 0 && [...this.lotSelection().values()].every((prix) => prix > 0),
  );

  /** Produits actifs pas encore présents sur la carte. */
  readonly produitsDisponibles = computed(() => {
    const presents = new Set(this.lignes().map((l) => l.produit_id));
    return this.produits().filter((p) => !presents.has(p.id));
  });

  /** Produits ajoutables, filtrés par la catégorie sélectionnée dans le drawer. */
  readonly produitsFiltres = computed(() => {
    const categorie = this.filtreCategorie();
    const dispo = this.produitsDisponibles();
    return categorie === 0 ? dispo : dispo.filter((p) => p.categorie_id === categorie);
  });

  /**
   * Lignes regroupées par section = catégorie du produit (Entrée / Plat /
   * Dessert…). Sections ordonnées par id de catégorie ; lignes ordonnées par
   * `ordre` au sein de chaque section.
   */
  readonly sections = computed(() => {
    const groupes = new Map<
      number,
      { id: number; libelle: string; ordre: number; lignes: CarteProduit[] }
    >();
    for (const ligne of this.lignes()) {
      const categorie = ligne.produit?.categorie;
      const id = categorie?.id ?? ligne.produit?.categorie_id ?? 0;
      const libelle = categorie?.libelle ?? 'Sans catégorie';
      const ordre = categorie?.ordre ?? 0;
      if (!groupes.has(id)) {
        groupes.set(id, { id, libelle, ordre, lignes: [] });
      }
      groupes.get(id)!.lignes.push(ligne);
    }
    return [...groupes.values()]
      .sort((a, b) => a.ordre - b.ordre || a.id - b.id)
      .map((section) => ({
        ...section,
        lignes: [...section.lignes].sort((a, b) => a.ordre - b.ordre || a.id - b.id),
      }));
  });

  readonly form = this.fb.nonNullable.group({
    produit_id: [0, [Validators.required, Validators.min(1)]],
    prix_vente: [0, [Validators.required, Validators.min(0.01)]],
    ordre: [0, [Validators.required, Validators.min(0)]],
  });

  ngOnInit(): void {
    this.loading.set(true);
    forkJoin({
      carte: this.carteService.get(this.carteId),
      lignes: this.ligneService.list(this.carteId),
      produits: this.produitService.list({ statut: 'actif' }),
      categories: this.categorieService.list(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ carte, lignes, produits, categories }) => {
          this.carte.set(carte);
          this.lignes.set(lignes);
          this.produits.set(produits);
          this.categories.set(categories);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  openAdd(): void {
    this.filtreCategorie.set(0);
    this.form.reset({ produit_id: 0, prix_vente: 0, ordre: 0 });
    this.formError.set(null);
    this.drawerOpen.set(true);
  }

  /** Change le filtre catégorie ; réinitialise le produit s'il sort du filtre. */
  setFiltreCategorie(value: string): void {
    this.filtreCategorie.set(Number(value));
    const produitId = this.form.controls.produit_id.value;
    if (produitId !== 0 && !this.produitsFiltres().some((p) => p.id === produitId)) {
      this.form.controls.produit_id.setValue(0);
    }
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
  }

  // ── Ajout en lot ──────────────────────────────────────────────────────────

  openLot(): void {
    this.filtreCategorie.set(0);
    this.lotSelection.set(new Map());
    this.lotPrixCommun.set(0);
    this.lotError.set(null);
    this.lotDrawerOpen.set(true);
  }

  closeLotDrawer(): void {
    this.lotDrawerOpen.set(false);
  }

  estSelectionne(produitId: number): boolean {
    return this.lotSelection().has(produitId);
  }

  prixDe(produitId: number): number {
    return this.lotSelection().get(produitId) ?? 0;
  }

  toggleLot(produitId: number): void {
    this.lotSelection.update((selection) => {
      const copie = new Map(selection);
      if (copie.has(produitId)) {
        copie.delete(produitId);
      } else {
        // Le prix commun sert de valeur de départ quand il est déjà saisi.
        copie.set(produitId, this.lotPrixCommun());
      }
      return copie;
    });
  }

  setPrixLigne(produitId: number, valeur: string): void {
    this.lotSelection.update((selection) => {
      const copie = new Map(selection);
      copie.set(produitId, Number(valeur));
      return copie;
    });
  }

  /** Sélectionne toute la catégorie affichée d'un coup — le cas d'usage courant. */
  toutSelectionner(): void {
    this.lotSelection.update((selection) => {
      const copie = new Map(selection);
      for (const produit of this.produitsFiltres()) {
        if (!copie.has(produit.id)) {
          copie.set(produit.id, this.lotPrixCommun());
        }
      }
      return copie;
    });
  }

  toutDeselectionner(): void {
    this.lotSelection.set(new Map());
  }

  onPrixCommun(valeur: string): void {
    this.lotPrixCommun.set(Number(valeur));
  }

  /** Recopie le prix commun sur toutes les lignes déjà sélectionnées. */
  appliquerPrixATous(): void {
    const prix = this.lotPrixCommun();
    this.lotSelection.update((selection) => {
      const copie = new Map<number, number>();
      for (const id of selection.keys()) {
        copie.set(id, prix);
      }
      return copie;
    });
  }

  addLot(): void {
    if (!this.lotPretAEnvoyer() || this.lotSaving()) {
      return;
    }

    this.lotSaving.set(true);
    this.lotError.set(null);

    const lignes = [...this.lotSelection().entries()].map(([produit_id, prix_vente]) => ({
      produit_id,
      prix_vente,
    }));

    this.ligneService
      .createLot(this.carteId, lignes)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (creees) => {
          this.lignes.update((list) => [...creees, ...list]);
          this.lotSaving.set(false);
          this.lotDrawerOpen.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.lotSaving.set(false);
          this.lotError.set(apiErrorMessage(err, 'Ajout en lot impossible.'));
        },
      });
  }

  add(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.formError.set(null);

    this.ligneService
      .create(this.carteId, this.form.getRawValue())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (ligne) => {
          this.lignes.update((list) => [ligne, ...list]);
          this.saving.set(false);
          this.drawerOpen.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.saving.set(false);
          this.formError.set(apiErrorMessage(err, 'Ajout impossible.'));
        },
      });
  }

  toggleStatut(ligne: CarteProduit): void {
    const statut = ligne.statut === 'actif' ? 'inactif' : 'actif';
    this.ligneService
      .update(this.carteId, ligne.id, { statut })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) =>
          this.lignes.update((list) => list.map((l) => (l.id === updated.id ? updated : l))),
        error: (err: HttpErrorResponse) => alert(apiErrorMessage(err, 'Modification impossible.')),
      });
  }

  updatePrix(ligne: CarteProduit, value: string): void {
    const prix = Number(value);
    if (!Number.isFinite(prix) || prix <= 0 || prix === Number(ligne.prix_vente)) {
      return;
    }
    this.ligneService
      .update(this.carteId, ligne.id, { prix_vente: prix })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) =>
          this.lignes.update((list) => list.map((l) => (l.id === updated.id ? updated : l))),
        error: (err: HttpErrorResponse) => alert(apiErrorMessage(err, 'Modification impossible.')),
      });
  }

  updateOrdre(ligne: CarteProduit, value: string): void {
    const ordre = Number(value);
    if (!Number.isInteger(ordre) || ordre < 0 || ordre === ligne.ordre) {
      return;
    }
    this.ligneService
      .update(this.carteId, ligne.id, { ordre })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) =>
          this.lignes.update((list) => list.map((l) => (l.id === updated.id ? updated : l))),
        error: (err: HttpErrorResponse) => alert(apiErrorMessage(err, 'Modification impossible.')),
      });
  }

  remove(ligne: CarteProduit): void {
    if (!confirm('Retirer ce produit de la carte ?')) {
      return;
    }
    this.deletingId.set(ligne.id);
    this.ligneService
      .delete(this.carteId, ligne.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.lignes.update((list) => list.filter((l) => l.id !== ligne.id));
          this.deletingId.set(null);
        },
        error: (err: HttpErrorResponse) => {
          this.deletingId.set(null);
          alert(
            apiErrorMessage(err, 'Suppression impossible (carte active : désactivez la ligne).'),
          );
        },
      });
  }

  produitLabel(ligne: CarteProduit): string {
    return (
      ligne.produit?.libelle ??
      this.produits().find((p) => p.id === ligne.produit_id)?.libelle ??
      `#${ligne.produit_id}`
    );
  }
}
