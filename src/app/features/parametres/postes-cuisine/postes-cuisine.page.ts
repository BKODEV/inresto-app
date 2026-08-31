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

import { PosteCuisineService } from '../../../core/api/poste-cuisine/poste-cuisine.service';
import { PosteCuisine } from '../../../core/api/poste-cuisine/poste-cuisine.model';
import { CategorieProduitService } from '../../../core/api/categorie-produit/categorie-produit.service';
import { CategorieProduit } from '../../../core/api/categorie-produit/categorie-produit.model';
import { PointDeVenteService } from '../../../core/api/point-de-vente/point-de-vente.service';
import { SessionCuisineService } from '../../../core/api/session-cuisine/session-cuisine.service';
import { MembreBrigade } from '../../../core/api/session-cuisine/session-cuisine.model';
import { PointDeVente } from '../../../core/api/point-de-vente/point-de-vente.model';
import { apiErrorMessage } from '../../../core/api/api-error.util';
import { AlerteService } from '../../../core/alertes/alerte.service';

/**
 * Paramétrage des postes de production et des catégories qu'ils prennent en
 * charge.
 *
 * Le système ne sait pas ce qu'est une « entrée » : les catégories sont saisies
 * par l'établissement, il ne peut donc pas trier pour la cuisine. C'est cet
 * écran qui fait le pont — le restaurant déclare ses postes une fois et y
 * accroche ses propres catégories, ce qui replie quinze catégories de carte sur
 * trois colonnes de pass.
 */
@Component({
  selector: 'app-postes-cuisine-page',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './postes-cuisine.page.html',
  styleUrl: './postes-cuisine.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PostesCuisinePage implements OnInit {
  private readonly service = inject(PosteCuisineService);
  private readonly categorieService = inject(CategorieProduitService);
  private readonly pdvService = inject(PointDeVenteService);
  private readonly sessionCuisineService = inject(SessionCuisineService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly alertes = inject(AlerteService);

  readonly items = signal<PosteCuisine[]>([]);
  readonly categories = signal<CategorieProduit[]>([]);
  readonly pdvs = signal<PointDeVente[]>([]);
  readonly loading = signal(true);
  readonly drawerOpen = signal(false);
  readonly editingItem = signal<PosteCuisine | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly deletingId = signal<number | null>(null);

  /** Catégories cochées dans le tiroir, par identifiant. */
  readonly categoriesChoisies = signal<Set<number>>(new Set());

  /**
   * Qui tient le poste. L'autre moitié de l'organisation du pass : les
   * catégories disent ce qu'on y produit, les membres qui le fait. C'est ce
   * rattachement qui permet ensuite de composer une brigade sans dérouler tout
   * le personnel du site.
   */
  readonly membresChoisis = signal<Set<string>>(new Set());
  /** Personnel du site du point de vente en cours d'édition. */
  readonly personnel = signal<MembreBrigade[]>([]);
  readonly personnelLoading = signal(false);

  /**
   * Catégories qu'AUCUN poste ne prend en charge, pour le point de vente en
   * cours d'édition.
   *
   * Affiché parce que c'est l'angle mort du paramétrage : ces plats
   * apparaissent sur TOUS les écrans, ce qui est la bonne dégradation mais se
   * remarque mal. Les nommer évite de croire à un poste mal configuré.
   */
  readonly categoriesNonAffectees = computed(() => {
    const pdvId =
      this.editingItem()?.point_de_vente_id ?? this.form.getRawValue().point_de_vente_id;
    if (!pdvId) {
      return [];
    }
    const affectees = new Set(
      this.items()
        .filter((p) => p.point_de_vente_id === Number(pdvId))
        .flatMap((p) => (p.categories ?? []).map((c) => c.id)),
    );
    return this.categories().filter((c) => !affectees.has(c.id));
  });

  readonly form = this.fb.nonNullable.group({
    point_de_vente_id: [0, [Validators.required, Validators.min(1)]],
    libelle: ['', [Validators.required, Validators.maxLength(255)]],
    ordre: [0, [Validators.required, Validators.min(0)]],
  });

  ngOnInit(): void {
    this.load();

    this.categorieService
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (data) => this.categories.set(data) });

    this.pdvService
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (data) => this.pdvs.set(data) });
  }

  private load(): void {
    this.loading.set(true);
    this.service
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.items.set(data);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  nomPdv(id: number): string {
    return this.pdvs().find((p) => p.id === id)?.nom ?? `#${id}`;
  }

  libellesCategories(poste: PosteCuisine): string {
    const noms = (poste.categories ?? []).map((c) => c.libelle);
    return noms.length > 0 ? noms.join(', ') : '—';
  }

  libellesMembres(poste: PosteCuisine): string {
    const noms = (poste.membres ?? []).map((m) => m.nom);
    return noms.length > 0 ? noms.join(' · ') : '—';
  }

  estMembre(id: string): boolean {
    return this.membresChoisis().has(id);
  }

  basculerMembre(id: string): void {
    this.membresChoisis.update((set) => {
      const copie = new Set(set);
      if (!copie.delete(id)) {
        copie.add(id);
      }
      return copie;
    });
  }

  estChoisie(categorie: CategorieProduit): boolean {
    return this.categoriesChoisies().has(categorie.id);
  }

  basculerCategorie(categorie: CategorieProduit): void {
    this.categoriesChoisies.update((set) => {
      const copie = new Set(set);
      if (copie.has(categorie.id)) {
        copie.delete(categorie.id);
      } else {
        copie.add(categorie.id);
      }
      return copie;
    });
  }

  openCreate(): void {
    this.editingItem.set(null);
    this.form.reset({ point_de_vente_id: this.pdvs()[0]?.id ?? 0, libelle: '', ordre: 0 });
    this.categoriesChoisies.set(new Set());
    this.membresChoisis.set(new Set());
    this.chargerPersonnel(this.pdvs()[0]?.id ?? null);
    this.formError.set(null);
    this.drawerOpen.set(true);
  }

  openEdit(item: PosteCuisine): void {
    this.editingItem.set(item);
    this.form.reset({
      point_de_vente_id: item.point_de_vente_id,
      libelle: item.libelle,
      ordre: item.ordre,
    });
    this.categoriesChoisies.set(new Set((item.categories ?? []).map((c) => c.id)));
    this.membresChoisis.set(new Set((item.membres ?? []).map((m) => m.id)));
    this.chargerPersonnel(item.point_de_vente_id);
    this.formError.set(null);
    this.drawerOpen.set(true);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
  }

  /** Le point de vente change à la création : le personnel proposé aussi. */
  onPdvChoisi(valeur: string): void {
    this.chargerPersonnel(Number(valeur));
    // Un membre du site précédent n'a rien à faire sur ce poste, et l'API le
    // refuserait : on repart d'une brigade vide plutôt que d'un 422.
    this.membresChoisis.set(new Set());
  }

  /**
   * Servi par l'API en lecture minimale plutôt que par `GET /users`, qui exige
   * `utilisateur.view` — une permission d'administration du personnel que le
   * chef de cuisine n'a pas, alors que cet écran est le sien.
   */
  private chargerPersonnel(pointDeVenteId: number | null): void {
    if (pointDeVenteId === null) {
      this.personnel.set([]);
      return;
    }
    this.personnelLoading.set(true);
    this.sessionCuisineService
      .personnel(pointDeVenteId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (liste) => {
          this.personnel.set(liste);
          this.personnelLoading.set(false);
        },
        error: () => {
          this.personnel.set([]);
          this.personnelLoading.set(false);
        },
      });
  }

  save(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.formError.set(null);

    const { point_de_vente_id, libelle, ordre } = this.form.getRawValue();
    const categories = [...this.categoriesChoisies()];
    const membres = [...this.membresChoisis()];
    const editing = this.editingItem();

    // Le point de vente n'est pas modifiable : déplacer un poste d'un pass à
    // l'autre emporterait ses catégories dans un contexte différent.
    const request$ = editing
      ? this.service.update(editing.id, { libelle, ordre, categories, membres })
      : this.service.create({
          point_de_vente_id: Number(point_de_vente_id),
          libelle,
          ordre,
          categories,
          membres,
        });

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (saved) => {
        if (editing) {
          this.items.update((list) => list.map((i) => (i.id === saved.id ? saved : i)));
        } else {
          this.items.update((list) => [...list, saved]);
        }
        this.saving.set(false);
        this.drawerOpen.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.formError.set(apiErrorMessage(err));
      },
    });
  }

  async delete(item: PosteCuisine): Promise<void> {
    // Rien n'est perdu : les plats du poste supprimé reparaissent sur tous les
    // écrans, jamais dans le vide.
    if (!(await this.alertes.confirmerSuppression(item.libelle, { nature: 'le poste' }))) {
      return;
    }
    this.deletingId.set(item.id);
    this.service
      .delete(item.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.items.update((list) => list.filter((i) => i.id !== item.id));
          this.deletingId.set(null);
        },
        error: () => this.deletingId.set(null),
      });
  }
}
