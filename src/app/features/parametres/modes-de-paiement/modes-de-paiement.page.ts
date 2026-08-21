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

import { ModeDePaiementService } from '../../../core/api/mode-de-paiement/mode-de-paiement.service';
import { ModeDePaiement } from '../../../core/api/mode-de-paiement/mode-de-paiement.model';
import { Statut } from '../../../core/api/api.types';
import { apiErrorMessage } from '../../../core/api/api-error.util';

@Component({
  selector: 'app-modes-de-paiement-page',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './modes-de-paiement.page.html',
  styleUrl: './modes-de-paiement.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModesDePaiementPage implements OnInit {
  private readonly service = inject(ModeDePaiementService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly items = signal<ModeDePaiement[]>([]);
  readonly loading = signal(true);
  readonly drawerOpen = signal(false);
  readonly editingItem = signal<ModeDePaiement | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly deletingId = signal<number | null>(null);

  readonly form = this.fb.nonNullable.group({
    libelle: ['', [Validators.required, Validators.maxLength(255)]],
    compte_en_caisse: [true],
    ordre: [0, [Validators.min(0)]],
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
    this.form.reset({ libelle: '', compte_en_caisse: true, ordre: 0, statut: 'actif' });
    this.formError.set(null);
    this.drawerOpen.set(true);
  }

  openEdit(item: ModeDePaiement): void {
    this.editingItem.set(item);
    this.form.reset({
      libelle: item.libelle,
      compte_en_caisse: item.compte_en_caisse,
      ordre: item.ordre,
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
      ? this.service.update(editing.id, payload)
      : this.service.create(payload);

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.saving.set(false);
        this.drawerOpen.set(false);
        // Rechargement plutôt que mutation locale : poser un mode à une place
        // occupée décale ses voisins côté serveur, et la liste en mémoire
        // ignorerait ces décalages.
        this.load();
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.formError.set(apiErrorMessage(err, 'Une erreur est survenue.'));
      },
    });
  }

  delete(item: ModeDePaiement): void {
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
