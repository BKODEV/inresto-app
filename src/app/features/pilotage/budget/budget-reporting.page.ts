import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';

import { ReportingService } from '../../../core/api/reporting/reporting.service';
import { Budget, NiveauAlerte } from '../../../core/api/budget/budget.model';
import { DepensesReport, ReportingFilter } from '../../../core/api/reporting/reporting.model';
import { SelectedSiteService } from '../../../core/site/selected-site.service';
import { PeriodeFiltre } from '../shared/periode-filtre';
import { formatMontant } from '../shared/reporting-format';

const NIVEAU_LABEL: Record<NiveauAlerte, string> = {
  aucun: 'Sous contrôle',
  seuil_75: 'Seuil 75 %',
  seuil_90: 'Seuil 90 %',
  depassement: 'Dépassement',
};

const NIVEAU_BADGE: Record<NiveauAlerte, string> = {
  aucun: 'badge-success',
  seuil_75: 'badge-warning',
  seuil_90: 'badge-warning',
  depassement: 'badge-danger',
};

const TYPE_LABEL: Record<string, string> = {
  achat_fournisseur: 'Achat fournisseur',
  charge_hors_stock: 'Charge hors stock',
};

@Component({
  selector: 'app-budget-reporting-page',
  standalone: true,
  imports: [PeriodeFiltre],
  templateUrl: './budget-reporting.page.html',
  styleUrls: ['../shared/reporting-page.scss', './budget-reporting.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetReportingPage {
  private readonly service = inject(ReportingService);
  private readonly selectedSite = inject(SelectedSiteService);
  private readonly destroyRef = inject(DestroyRef);

  readonly currentSite = this.selectedSite.selectedSite;

  readonly filter = signal<ReportingFilter | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly budgets = signal<Budget[]>([]);
  readonly depenses = signal<DepensesReport | null>(null);

  readonly fMontant = formatMontant;

  constructor() {
    effect(() => {
      const filter = this.filter();
      const siteId = this.selectedSite.selectedId();
      if (filter) {
        this.load(filter, siteId);
      }
    });
  }

  onFilter(filter: ReportingFilter): void {
    this.filter.set(filter);
  }

  niveauLabel(n: NiveauAlerte): string {
    return NIVEAU_LABEL[n];
  }

  niveauBadge(n: NiveauAlerte): string {
    return NIVEAU_BADGE[n];
  }

  typeLabel(type: string): string {
    return TYPE_LABEL[type] ?? type;
  }

  gaugePct(value: string): number {
    return Math.min(100, Math.max(0, Number(value)));
  }

  formatMois(mois: string): string {
    const label = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(
      new Date(mois),
    );
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  num(value: string): number {
    return Number(value);
  }

  private load(filter: ReportingFilter, siteId: number | null): void {
    const scoped: ReportingFilter = siteId ? { ...filter, site_id: siteId } : filter;
    this.loading.set(true);
    this.error.set(null);

    forkJoin({
      budgets: this.service.budgetConsommation(scoped),
      depenses: this.service.budgetDepenses(scoped),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ budgets, depenses }) => {
          this.budgets.set(budgets);
          this.depenses.set(depenses);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Impossible de charger le suivi budgétaire.');
          this.loading.set(false);
        },
      });
  }
}
