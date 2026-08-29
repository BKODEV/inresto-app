import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';

import { MatierePremiereService } from '../../../core/api/matiere-premiere/matiere-premiere.service';
import { MatierePremiere } from '../../../core/api/matiere-premiere/matiere-premiere.model';
import { CategorieMatierePremièreService } from '../../../core/api/categorie-matiere-premiere/categorie-matiere-premiere.service';
import { CategorieMatierePremiere } from '../../../core/api/categorie-matiere-premiere/categorie-matiere-premiere.model';
import { UniteDeMesureService } from '../../../core/api/unite-de-mesure/unite-de-mesure.service';
import { UniteDeMesure } from '../../../core/api/unite-de-mesure/unite-de-mesure.model';
import { Statut } from '../../../core/api/api.types';
import { apiErrorMessage } from '../../../core/api/api-error.util';
import { QuantitePipe, CoutUnitairePipe } from '../../../shared/format/nombre.pipes';

@Component({
  selector: 'app-matieres-premieres-page',
  standalone: true,
  imports: [ReactiveFormsModule, QuantitePipe, CoutUnitairePipe],
  templateUrl: './matieres-premieres.page.html',
  styleUrl: './matieres-premieres.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatieresPremieresPage implements OnInit {
  private readonly service = inject(MatierePremiereService);
  private readonly categorieService = inject(CategorieMatierePremièreService);
  private readonly uniteService = inject(UniteDeMesureService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly items = signal<MatierePremiere[]>([]);
  readonly categories = signal<CategorieMatierePremiere[]>([]);
  readonly unites = signal<UniteDeMesure[]>([]);
  readonly loading = signal(true);
  readonly drawerOpen = signal(false);
  readonly editingItem = signal<MatierePremiere | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly deletingId = signal<number | null>(null);

  readonly form = this.fb.nonNullable.group({
    libelle: ['', [Validators.required, Validators.maxLength(255)]],
    categorie_id: [null as number | null, [Validators.required]],
    unite_de_mesure_id: [null as number | null, [Validators.required]],
    seuil_alerte_stock: [0 as number | null, [Validators.min(0)]],
    gestion_peremption: [false],
    statut: ['actif' as Statut],
  });

  ngOnInit(): void {
    this.load();
    this.categorieService
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((data) => this.categories.set(data));
    this.uniteService
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((data) => this.unites.set(data));
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

  openCreate(): void {
    this.editingItem.set(null);
    this.form.reset({
      libelle: '',
      categorie_id: null,
      unite_de_mesure_id: null,
      seuil_alerte_stock: 0,
      gestion_peremption: false,
      statut: 'actif',
    });
    this.formError.set(null);
    this.drawerOpen.set(true);
  }

  openEdit(item: MatierePremiere): void {
    this.editingItem.set(item);
    this.form.reset({
      libelle: item.libelle,
      categorie_id: item.categorie_id,
      unite_de_mesure_id: item.unite_de_mesure_id,
      seuil_alerte_stock: Number(item.seuil_alerte_stock),
      gestion_peremption: item.gestion_peremption,
      statut: item.statut,
    });
    this.formError.set(null);
    this.drawerOpen.set(true);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
  }

  save(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.formError.set(null);

    const raw = this.form.getRawValue();
    const payload = {
      libelle: raw.libelle,
      categorie_id: raw.categorie_id!,
      unite_de_mesure_id: raw.unite_de_mesure_id!,
      seuil_alerte_stock: raw.seuil_alerte_stock ?? 0,
      gestion_peremption: raw.gestion_peremption,
      statut: raw.statut,
    };
    const editing = this.editingItem();

    const request$ = editing
      ? this.service.update(editing.id, payload)
      : this.service.create(payload);

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
        this.formError.set(apiErrorMessage(err, 'Une erreur est survenue.'));
      },
    });
  }

  delete(item: MatierePremiere): void {
    if (!confirm(`Supprimer « ${item.libelle} » ?`)) {
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
