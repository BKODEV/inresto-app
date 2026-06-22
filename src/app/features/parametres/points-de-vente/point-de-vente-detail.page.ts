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

import { PointDeVenteService } from '../../../core/api/point-de-vente/point-de-vente.service';
import { PointDeVente } from '../../../core/api/point-de-vente/point-de-vente.model';
import { CaisseService } from '../../../core/api/caisse/caisse.service';
import { Caisse } from '../../../core/api/caisse/caisse.model';
import { Statut } from '../../../core/api/api.types';
import { AuthService } from '../../../core/auth/auth.service';
import { apiErrorMessage } from '../../../core/api/api-error.util';

/**
 * Détail d'un point de vente (Paramètres) : ses informations et ses caisses.
 * Remplace l'ancien onglet « Caisses » global — on ne gère plus que les caisses
 * du PDV courant. Une caisse principale est créée automatiquement à la création
 * du PDV (côté backend) ; l'utilisateur en ajoute/modifie/supprime ici.
 */
@Component({
  selector: 'app-point-de-vente-detail-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './point-de-vente-detail.page.html',
  styleUrl: './point-de-vente-detail.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PointDeVenteDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(PointDeVenteService);
  private readonly caisseService = inject(CaisseService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly pdvId = Number(this.route.snapshot.paramMap.get('id'));

  readonly pdv = signal<PointDeVente | null>(null);
  readonly caisses = signal<Caisse[]>([]);
  readonly loading = signal(true);

  readonly drawerOpen = signal(false);
  readonly editingCaisse = signal<Caisse | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly deletingId = signal<number | null>(null);

  readonly canCreate = computed(() => this.auth.hasPermission('caisse.create'));
  readonly canUpdate = computed(() => this.auth.hasPermission('caisse.update'));
  readonly canDelete = computed(() => this.auth.hasPermission('caisse.delete'));

  readonly form = this.fb.nonNullable.group({
    libelle: ['', [Validators.required, Validators.maxLength(255)]],
    statut: ['actif' as Statut],
  });

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.service
      .get(this.pdvId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (pdv) => {
          this.pdv.set(pdv);
          this.caisses.set(pdv.caisses ?? []);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  /** Une caisse n'est supprimable que sans historique de sessions. */
  caisseSupprimable(caisse: Caisse): boolean {
    return (caisse.sessions_count ?? 0) === 0;
  }

  openCreate(): void {
    this.editingCaisse.set(null);
    this.form.reset({ libelle: '', statut: 'actif' });
    this.formError.set(null);
    this.drawerOpen.set(true);
  }

  openEdit(caisse: Caisse): void {
    this.editingCaisse.set(caisse);
    this.form.reset({ libelle: caisse.libelle, statut: caisse.statut });
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

    const { libelle, statut } = this.form.getRawValue();
    const editing = this.editingCaisse();

    const request$ = editing
      ? this.caisseService.update(editing.id, { libelle, statut })
      : this.caisseService.create({ libelle, statut, point_de_vente_id: this.pdvId });

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (saved) => {
        if (editing) {
          // Le PATCH ne renvoie pas sessions_count : on préserve le compteur connu.
          this.caisses.update((list) =>
            list.map((c) =>
              c.id === saved.id ? { ...saved, sessions_count: c.sessions_count } : c,
            ),
          );
        } else {
          this.caisses.update((list) => [...list, { ...saved, sessions_count: 0 }]);
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

  delete(caisse: Caisse): void {
    if (!confirm(`Supprimer la caisse « ${caisse.libelle} » ?`)) {
      return;
    }
    this.deletingId.set(caisse.id);
    this.caisseService
      .delete(caisse.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.caisses.update((list) => list.filter((c) => c.id !== caisse.id));
          this.deletingId.set(null);
        },
        error: (err: HttpErrorResponse) => {
          this.deletingId.set(null);
          // 409 : caisse porteuse de sessions (historique financier).
          alert(apiErrorMessage(err, 'Suppression impossible.'));
        },
      });
  }
}
