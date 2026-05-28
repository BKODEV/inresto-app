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

import { PointDeVenteService } from '../../core/api/point-de-vente/point-de-vente.service';
import { PointDeVente, PointDeVenteType } from '../../core/api/point-de-vente/point-de-vente.model';
import { Statut } from '../../core/api/api.types';

@Component({
  selector: 'app-points-de-vente-page',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './points-de-vente.page.html',
  styleUrl: './points-de-vente.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PointsDeVentePage implements OnInit {
  private readonly service = inject(PointDeVenteService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly items = signal<PointDeVente[]>([]);
  readonly loading = signal(true);
  readonly drawerOpen = signal(false);
  readonly editingItem = signal<PointDeVente | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly deletingId = signal<number | null>(null);

  readonly form = this.fb.nonNullable.group({
    nom: ['', [Validators.required, Validators.maxLength(255)]],
    type: ['Restaurant' as PointDeVenteType, [Validators.required]],
    description: [''],
    statut: ['actif' as Statut],
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
    this.form.reset({ nom: '', type: 'Restaurant', description: '', statut: 'actif' });
    this.formError.set(null);
    this.drawerOpen.set(true);
  }

  openEdit(item: PointDeVente): void {
    this.editingItem.set(item);
    this.form.reset({
      nom: item.nom,
      type: item.type,
      description: item.description ?? '',
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

    const { nom, type, description, statut } = this.form.getRawValue();
    const payload = { nom, type, description: description || null, statut };
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
        this.formError.set(err.error?.message ?? 'Une erreur est survenue.');
      },
    });
  }

  delete(item: PointDeVente): void {
    if (!confirm(`Supprimer « ${item.nom} » ?`)) { return; }
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
