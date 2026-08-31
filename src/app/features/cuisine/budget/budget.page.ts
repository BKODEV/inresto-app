import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';

import { BudgetService } from '../../../core/api/budget/budget.service';
import { Budget, NiveauAlerte } from '../../../core/api/budget/budget.model';
import { DepenseService } from '../../../core/api/depense/depense.service';
import { SelectedSiteService } from '../../../core/site/selected-site.service';
import { SiteRequisComponent } from '../../../shared/site-requis/site-requis.component';
import { AuthService } from '../../../core/auth/auth.service';
import { apiErrorMessage } from '../../../core/api/api-error.util';
import { AlerteService } from '../../../core/alertes/alerte.service';

const NIVEAU_LABEL: Record<NiveauAlerte, string> = {
  aucun: 'Sous contrôle',
  seuil_75: 'Seuil 75 % atteint',
  seuil_90: 'Seuil 90 % atteint',
  depassement: 'Dépassement',
};

const NIVEAU_BADGE: Record<NiveauAlerte, string> = {
  aucun: 'badge-success',
  seuil_75: 'badge-warning',
  seuil_90: 'badge-warning',
  depassement: 'badge-danger',
};

@Component({
  selector: 'app-budget-page',
  standalone: true,
  imports: [ReactiveFormsModule, SiteRequisComponent],
  templateUrl: './budget.page.html',
  styleUrl: './budget.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetPage {
  private readonly service = inject(BudgetService);
  private readonly depenseService = inject(DepenseService);
  private readonly selectedSite = inject(SelectedSiteService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly alertes = inject(AlerteService);

  // Sites + sélection pilotés par le sélecteur global de la topbar.
  readonly sites = this.selectedSite.sites;
  readonly selectedSiteId = this.selectedSite.selectedId;
  readonly currentSite = this.selectedSite.selectedSite;
  readonly siteLoading = this.selectedSite.loading;
  readonly estConsolide = this.selectedSite.estConsolide;
  readonly items = signal<Budget[]>([]);
  readonly loading = signal(true);

  readonly drawerOpen = signal(false);
  readonly editingItem = signal<Budget | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly deletingId = signal<number | null>(null);

  // Détail mois (dépenses + jauge)
  readonly detailOpen = signal(false);
  readonly detail = signal<Budget | null>(null);
  readonly detailLoading = signal(false);
  readonly chargeSaving = signal(false);
  readonly chargeError = signal<string | null>(null);

  readonly canManage = computed(() => this.auth.hasPermission('budget.create'));
  readonly canAddCharge = computed(() => this.auth.hasPermission('depense.create'));

  private readonly moisFormatter = new Intl.DateTimeFormat('fr-FR', {
    month: 'long',
    year: 'numeric',
  });
  private readonly montantFormatter = new Intl.NumberFormat('fr-FR');
  private readonly dateFormatter = new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  readonly form = this.fb.nonNullable.group({
    mois: ['', [Validators.required]],
    montant_alloue: [null as number | null, [Validators.required, Validators.min(0)]],
    seuil_alerte_75: [true],
    seuil_alerte_90: [true],
    seuil_alerte_100: [true],
  });

  readonly chargeForm = this.fb.nonNullable.group({
    libelle: ['', [Validators.required, Validators.maxLength(255)]],
    montant: [null as number | null, [Validators.required, Validators.min(0.01)]],
    date_depense: ['', [Validators.required]],
  });

  constructor() {
    // Le contenu du tiroir appartient au site quitté : changer de périmètre le
    // ferme plutôt que d'enregistrer une saisie sur le mauvais site.
    effect(() => {
      this.selectedSite.epoch();
      this.drawerOpen.set(false);
    });

    // Recharge les budgets dès que le site global change (ou au premier chargement).
    effect(() => {
      const site = this.selectedSite.selectedSite();
      if (site) {
        this.loadBudgets(site.id);
      } else {
        this.items.set([]);
        this.loading.set(false);
      }
    });
  }

  private loadBudgets(siteId: number): void {
    this.loading.set(true);
    this.service
      .listForSite(siteId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.items.set(data);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  formatMois(mois: string): string {
    const label = this.moisFormatter.format(new Date(mois));
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  formatMontant(value: string): string {
    return this.montantFormatter.format(Number(value));
  }

  formatDate(value: string): string {
    return this.dateFormatter.format(new Date(value));
  }

  niveauLabel(n: NiveauAlerte): string {
    return NIVEAU_LABEL[n];
  }

  niveauBadge(n: NiveauAlerte): string {
    return NIVEAU_BADGE[n];
  }

  /** Largeur de jauge bornée à 100 % pour l'affichage. */
  gaugePct(value: string): number {
    return Math.min(100, Math.max(0, Number(value)));
  }

  isNeg(value: string): boolean {
    return Number(value) < 0;
  }

  // ── CRUD budget ─────────────────────────────────────────────────────────

  openCreate(): void {
    this.editingItem.set(null);
    this.form.reset({
      mois: '',
      montant_alloue: null,
      seuil_alerte_75: true,
      seuil_alerte_90: true,
      seuil_alerte_100: true,
    });
    this.formError.set(null);
    this.drawerOpen.set(true);
  }

  openEdit(item: Budget): void {
    this.editingItem.set(item);
    this.form.reset({
      mois: item.mois.substring(0, 7),
      montant_alloue: Number(item.montant_alloue),
      seuil_alerte_75: item.seuil_alerte_75,
      seuil_alerte_90: item.seuil_alerte_90,
      seuil_alerte_100: item.seuil_alerte_100,
    });
    this.formError.set(null);
    this.drawerOpen.set(true);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
  }

  save(): void {
    const siteId = this.selectedSiteId();
    if (this.form.invalid || this.saving() || !siteId) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.formError.set(null);

    const raw = this.form.getRawValue();
    const payload = {
      site_id: siteId,
      mois: `${raw.mois}-01`,
      montant_alloue: raw.montant_alloue!,
      seuil_alerte_75: raw.seuil_alerte_75,
      seuil_alerte_90: raw.seuil_alerte_90,
      seuil_alerte_100: raw.seuil_alerte_100,
    };
    const editing = this.editingItem();
    const request$ = editing
      ? this.service.update(editing.id, payload)
      : this.service.create(payload);

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.saving.set(false);
        this.drawerOpen.set(false);
        this.loadBudgets(siteId);
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.formError.set(apiErrorMessage(err, 'Une erreur est survenue.'));
      },
    });
  }

  async delete(item: Budget): Promise<void> {
    const siteId = this.selectedSiteId();
    if (!siteId) {
      return;
    }

    const confirme = await this.alertes.confirmerSuppression(this.formatMois(item.mois), {
      nature: 'le budget de',
    });
    if (!confirme) {
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

  // ── Détail mois + charges ───────────────────────────────────────────────

  openDetail(item: Budget): void {
    const siteId = this.selectedSiteId();
    if (!siteId) {
      return;
    }
    this.detail.set(null);
    this.detailLoading.set(true);
    this.detailOpen.set(true);
    this.chargeError.set(null);
    this.chargeForm.reset({ libelle: '', montant: null, date_depense: '' });
    this.service
      .showForMonth(siteId, item.mois.substring(0, 7))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (budget) => {
          this.detail.set(budget);
          this.detailLoading.set(false);
        },
        error: () => this.detailLoading.set(false),
      });
  }

  closeDetail(): void {
    this.detailOpen.set(false);
  }

  addCharge(): void {
    const budget = this.detail();
    if (this.chargeForm.invalid || this.chargeSaving() || !budget) {
      this.chargeForm.markAllAsTouched();
      return;
    }
    this.chargeSaving.set(true);
    this.chargeError.set(null);
    const raw = this.chargeForm.getRawValue();
    this.depenseService
      .create(budget.id, {
        libelle: raw.libelle,
        montant: raw.montant!,
        date_depense: raw.date_depense,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.chargeSaving.set(false);
          this.chargeForm.reset({ libelle: '', montant: null, date_depense: '' });
          // Recharge le détail (montants + liste) et la liste des budgets.
          this.openDetail(budget);
          const siteId = this.selectedSiteId();
          if (siteId) {
            this.loadBudgets(siteId);
          }
        },
        error: (err: HttpErrorResponse) => {
          this.chargeSaving.set(false);
          this.chargeError.set(apiErrorMessage(err, 'Une erreur est survenue.'));
        },
      });
  }
}
