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
import { Router } from '@angular/router';

import { ReportingService } from '../../core/api/reporting/reporting.service';
import { DashboardData, NiveauAlerteBudget } from '../../core/api/reporting/reporting.model';
import { SelectedSiteService } from '../../core/site/selected-site.service';
import { ChartComponent } from '../../shared/chart/chart.component';
import { caEvolutionLine, donutChart, horizontalBar } from '../../shared/chart/chart-options';
import { CHART_PALETTE } from '../../shared/chart/echarts-theme';

/** Couleur d'accent par niveau d'alerte budgétaire (vert → rouge). */
const COULEUR_ALERTE: Record<NiveauAlerteBudget, string> = {
  aucun: CHART_PALETTE.green,
  seuil_75: CHART_PALETTE.amber,
  seuil_90: CHART_PALETTE.amber2,
  depassement: CHART_PALETTE.red,
};

const MONTANT = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [ChartComponent],
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage {
  private readonly service = inject(ReportingService);
  private readonly selectedSite = inject(SelectedSiteService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly perimetreLabel = this.selectedSite.perimetreLabel;

  readonly data = signal<DashboardData | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  // ── Indicateurs dérivés (formatés, états vides propres) ────────────────────

  readonly caJour = computed(() => this.data()?.ca.jour ?? null);
  readonly caMois = computed(() => this.data()?.ca.mois ?? null);
  readonly foodCost = computed(() => this.data()?.food_cost ?? null);
  readonly budget = computed(() => this.data()?.budget ?? null);
  readonly alertes = computed(() => this.data()?.alertes_stock ?? null);

  readonly budgetColor = computed(() =>
    this.budget() ? COULEUR_ALERTE[this.budget()!.niveau_alerte] : CHART_PALETTE.green,
  );

  // ── Options des graphes ────────────────────────────────────────────────────

  readonly hasEvolution = computed(() => (this.data()?.evolution_ca ?? []).some((p) => p.ca > 0));
  readonly hasModes = computed(() => (this.data()?.modes_paiement ?? []).length > 0);
  readonly hasTopProduits = computed(() => (this.data()?.top_produits ?? []).length > 0);

  readonly evolutionOptions = computed(() => caEvolutionLine(this.data()?.evolution_ca ?? []));

  readonly modesOptions = computed(() =>
    donutChart(
      (this.data()?.modes_paiement ?? []).map((m) => ({ name: m.mode, value: m.montant })),
    ),
  );

  readonly topProduitsOptions = computed(() =>
    horizontalBar((this.data()?.top_produits ?? []).map((p) => ({ name: p.produit, value: p.ca }))),
  );

  constructor() {
    effect(() => {
      // Recharge à chaque changement de site sélectionné (périmètre).
      const siteId = this.selectedSite.selectedId();
      this.load(siteId);
    });
  }

  goToStock(): void {
    this.router.navigate(['/pilotage/stock']);
  }

  /** Montant formaté, ou tiret si aucune activité (évite les « 0,00 » orphelins). */
  montantOuTiret(montant: number | undefined, actif: boolean): string {
    return actif ? MONTANT.format(montant ?? 0) : '—';
  }

  pct(value: number | undefined): string {
    return `${MONTANT.format(value ?? 0)} %`;
  }

  private load(siteId: number | null): void {
    this.loading.set(true);
    this.error.set(null);

    this.service
      .dashboard(siteId ? { site_id: siteId } : {})
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.data.set(data);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Impossible de charger le tableau de bord.');
          this.loading.set(false);
        },
      });
  }
}
