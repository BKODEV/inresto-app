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
import { forkJoin } from 'rxjs';

import { CarteService } from '../../../core/api/carte/carte.service';
import { Carte, CarteStatut } from '../../../core/api/carte/carte.model';
import { PointDeVenteService } from '../../../core/api/point-de-vente/point-de-vente.service';
import { PointDeVente } from '../../../core/api/point-de-vente/point-de-vente.model';

@Component({
  selector: 'app-cartes-page',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './cartes.page.html',
  styleUrl: './cartes.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CartesPage implements OnInit {
  private readonly carteService = inject(CarteService);
  private readonly pdvService = inject(PointDeVenteService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly items = signal<Carte[]>([]);
  readonly pointsDeVente = signal<PointDeVente[]>([]);
  readonly loading = signal(true);
  readonly drawerOpen = signal(false);
  readonly editingItem = signal<Carte | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly deletingId = signal<number | null>(null);

  readonly form = this.fb.nonNullable.group({
    libelle: ['', [Validators.required, Validators.maxLength(255)]],
    point_de_vente_id: [0, [Validators.required, Validators.min(1)]],
    statut: ['brouillon' as CarteStatut],
  });

  ngOnInit(): void {
    this.loading.set(true);
    forkJoin({
      cartes: this.carteService.list(),
      pdv: this.pdvService.list(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ cartes, pdv }) => {
          this.items.set(cartes);
          this.pointsDeVente.set(pdv);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  openCreate(): void {
    this.editingItem.set(null);
    this.form.reset({ libelle: '', point_de_vente_id: 0, statut: 'brouillon' });
    this.formError.set(null);
    this.drawerOpen.set(true);
  }

  openEdit(item: Carte): void {
    this.editingItem.set(item);
    this.form.reset({
      libelle: item.libelle,
      point_de_vente_id: item.point_de_vente_id,
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

    const payload = this.form.getRawValue();
    const editing = this.editingItem();

    const request$ = editing
      ? this.carteService.update(editing.id, payload)
      : this.carteService.create(payload);

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

  delete(item: Carte): void {
    if (!confirm(`Supprimer la carte « ${item.libelle} » ?`)) { return; }
    this.deletingId.set(item.id);
    this.carteService
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

  readonly statutLabel: Record<CarteStatut, string> = {
    brouillon: 'Brouillon',
    active: 'Active',
    archivee: 'Archivée',
  };
}
