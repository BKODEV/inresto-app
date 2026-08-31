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
import { RouterLink } from '@angular/router';

import { SiteService } from '../../../core/api/site/site.service';
import { Site } from '../../../core/api/site/site.model';
import { Statut } from '../../../core/api/api.types';
import { AuthService } from '../../../core/auth/auth.service';
import { apiErrorMessage } from '../../../core/api/api-error.util';
import { AlerteService } from '../../../core/alertes/alerte.service';

@Component({
  selector: 'app-sites-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './sites.page.html',
  styleUrl: './sites.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SitesPage implements OnInit {
  private readonly service = inject(SiteService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly alertes = inject(AlerteService);

  readonly items = signal<Site[]>([]);
  readonly loading = signal(true);
  readonly drawerOpen = signal(false);
  readonly editingItem = signal<Site | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly deletingId = signal<number | null>(null);

  readonly canCreate = computed(() => this.auth.hasPermission('site.create'));
  readonly canUpdate = computed(() => this.auth.hasPermission('site.update'));
  readonly canDelete = computed(() => this.auth.hasPermission('site.delete'));

  readonly form = this.fb.nonNullable.group({
    nom: ['', [Validators.required, Validators.maxLength(255)]],
    code: ['', [Validators.required, Validators.maxLength(20)]],
    adresse: [''],
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
    this.form.reset({ nom: '', code: '', adresse: '', statut: 'actif' });
    this.formError.set(null);
    this.drawerOpen.set(true);
  }

  openEdit(item: Site): void {
    this.editingItem.set(item);
    this.form.reset({
      nom: item.nom,
      code: item.code,
      adresse: item.adresse ?? '',
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

    const { nom, code, adresse, statut } = this.form.getRawValue();
    const payload = { nom, code, adresse: adresse || null, statut };
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

  async delete(item: Site): Promise<void> {
    if (!(await this.alertes.confirmerSuppression(item.nom, { nature: 'le site' }))) {
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
        error: (err: HttpErrorResponse) => {
          this.deletingId.set(null);
          // 409 : site utilisé (points de vente, budgets, stock).
          this.alertes.erreur(apiErrorMessage(err, 'Suppression impossible.'));
        },
      });
  }
}
