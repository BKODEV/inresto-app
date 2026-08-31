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
import { RouterLink } from '@angular/router';

import { FournisseurService } from '../../../core/api/fournisseur/fournisseur.service';
import { Fournisseur } from '../../../core/api/fournisseur/fournisseur.model';
import { Statut } from '../../../core/api/api.types';
import { apiErrorMessage } from '../../../core/api/api-error.util';
import { AlerteService } from '../../../core/alertes/alerte.service';

@Component({
  selector: 'app-fournisseurs-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './fournisseurs.page.html',
  styleUrl: './fournisseurs.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FournisseursPage implements OnInit {
  private readonly service = inject(FournisseurService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly alertes = inject(AlerteService);

  readonly items = signal<Fournisseur[]>([]);
  readonly loading = signal(true);
  readonly drawerOpen = signal(false);
  readonly editingItem = signal<Fournisseur | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly deletingId = signal<number | null>(null);

  readonly form = this.fb.nonNullable.group({
    nom: ['', [Validators.required, Validators.maxLength(255)]],
    telephone: [''],
    email: ['', [Validators.email]],
    adresse: [''],
    conditions_paiement: [''],
    delai_livraison_jours: [null as number | null, [Validators.min(1)]],
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
    this.form.reset({
      nom: '',
      telephone: '',
      email: '',
      adresse: '',
      conditions_paiement: '',
      delai_livraison_jours: null,
      statut: 'actif',
    });
    this.formError.set(null);
    this.drawerOpen.set(true);
  }

  openEdit(item: Fournisseur): void {
    this.editingItem.set(item);
    this.form.reset({
      nom: item.nom,
      telephone: item.telephone ?? '',
      email: item.email ?? '',
      adresse: item.adresse ?? '',
      conditions_paiement: item.conditions_paiement ?? '',
      delai_livraison_jours: item.delai_livraison_jours,
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
      nom: raw.nom,
      telephone: raw.telephone || null,
      email: raw.email || null,
      adresse: raw.adresse || null,
      conditions_paiement: raw.conditions_paiement || null,
      delai_livraison_jours: raw.delai_livraison_jours || null,
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

  async delete(item: Fournisseur): Promise<void> {
    if (!(await this.alertes.confirmerSuppression(item.nom))) {
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
