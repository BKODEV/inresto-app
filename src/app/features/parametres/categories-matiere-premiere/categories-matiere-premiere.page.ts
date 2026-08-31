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

import { CategorieMatierePremièreService } from '../../../core/api/categorie-matiere-premiere/categorie-matiere-premiere.service';
import { CategorieMatierePremiere } from '../../../core/api/categorie-matiere-premiere/categorie-matiere-premiere.model';
import { apiErrorMessage } from '../../../core/api/api-error.util';
import { AlerteService } from '../../../core/alertes/alerte.service';

@Component({
  selector: 'app-categories-matiere-premiere-page',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './categories-matiere-premiere.page.html',
  styleUrl: './categories-matiere-premiere.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoriesMatierePremierePage implements OnInit {
  private readonly service = inject(CategorieMatierePremièreService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly alertes = inject(AlerteService);

  readonly items = signal<CategorieMatierePremiere[]>([]);
  readonly loading = signal(true);
  readonly drawerOpen = signal(false);
  readonly editingItem = signal<CategorieMatierePremiere | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly deletingId = signal<number | null>(null);

  readonly form = this.fb.nonNullable.group({
    libelle: ['', [Validators.required, Validators.maxLength(255)]],
    description: [''],
  });

  ngOnInit(): void {
    this.load();
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
    this.form.reset({ libelle: '', description: '' });
    this.formError.set(null);
    this.drawerOpen.set(true);
  }

  openEdit(item: CategorieMatierePremiere): void {
    this.editingItem.set(item);
    this.form.reset({ libelle: item.libelle, description: item.description ?? '' });
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

    const { libelle, description } = this.form.getRawValue();
    const payload = { libelle, description: description || null };
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

  async delete(item: CategorieMatierePremiere): Promise<void> {
    if (!(await this.alertes.confirmerSuppression(item.libelle))) {
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
