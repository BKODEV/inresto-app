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

import { CaisseService } from '../../../core/api/caisse/caisse.service';
import { Caisse } from '../../../core/api/caisse/caisse.model';
import { PointDeVenteService } from '../../../core/api/point-de-vente/point-de-vente.service';
import { PointDeVente } from '../../../core/api/point-de-vente/point-de-vente.model';
import { Statut } from '../../../core/api/api.types';

@Component({
  selector: 'app-caisses-page',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './caisses.page.html',
  styleUrl: './caisses.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CaissesPage implements OnInit {
  private readonly caisseService = inject(CaisseService);
  private readonly pdvService = inject(PointDeVenteService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly items = signal<Caisse[]>([]);
  readonly pointsDeVente = signal<PointDeVente[]>([]);
  readonly loading = signal(true);
  readonly drawerOpen = signal(false);
  readonly editingItem = signal<Caisse | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly deletingId = signal<number | null>(null);

  readonly form = this.fb.nonNullable.group({
    libelle: ['', [Validators.required, Validators.maxLength(255)]],
    point_de_vente_id: [0, [Validators.required, Validators.min(1)]],
    statut: ['actif' as Statut],
  });

  ngOnInit(): void {
    this.loading.set(true);
    forkJoin({
      caisses: this.caisseService.list(),
      pdv: this.pdvService.list(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ caisses, pdv }) => {
          this.items.set(caisses);
          this.pointsDeVente.set(pdv);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  openCreate(): void {
    this.editingItem.set(null);
    this.form.reset({ libelle: '', point_de_vente_id: 0, statut: 'actif' });
    this.formError.set(null);
    this.drawerOpen.set(true);
  }

  openEdit(item: Caisse): void {
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
      ? this.caisseService.update(editing.id, payload)
      : this.caisseService.create(payload);

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

  delete(item: Caisse): void {
    if (!confirm(`Supprimer la caisse « ${item.libelle} » ?`)) { return; }
    this.deletingId.set(item.id);
    this.caisseService
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
