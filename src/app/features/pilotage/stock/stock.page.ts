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
import { forkJoin } from 'rxjs';

import { ReportingService } from '../../../core/api/reporting/reporting.service';
import {
  AlerteStock,
  ConsommationMatiere,
  EcartInventaire,
  ReportingFilter,
  StockValorisation,
} from '../../../core/api/reporting/reporting.model';
import { SelectedSiteService } from '../../../core/site/selected-site.service';
import { ChartComponent } from '../../../shared/chart/chart.component';
import { divergingBar, horizontalBar, stackedBar } from '../../../shared/chart/chart-options';
import { CHART_PALETTE } from '../../../shared/chart/echarts-theme';
import { PeriodeFiltre } from '../shared/periode-filtre';
import { formatMontant, formatNombre, formatPct } from '../shared/reporting-format';

/** Types de sortie affichés en colonnes dans la consommation. */
const TYPES_SORTIE: { key: string; label: string; color: string }[] = [
  { key: 'sortie_vente', label: 'Vente', color: CHART_PALETTE.amber },
  { key: 'perte', label: 'Perte', color: CHART_PALETTE.red },
  { key: 'casse', label: 'Casse', color: CHART_PALETTE.amber2 },
  { key: 'offert', label: 'Offert', color: CHART_PALETTE.blue },
  { key: 'repas_personnel', label: 'Repas pers.', color: CHART_PALETTE.purple },
];

/** Plafond d'items dans les graphes (les plus gros en tête). */
const MAX_ITEMS_CHART = 15;

@Component({
  selector: 'app-stock-reporting-page',
  standalone: true,
  imports: [PeriodeFiltre, ChartComponent],
  templateUrl: './stock.page.html',
  styleUrl: '../shared/reporting-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StockReportingPage {
  private readonly service = inject(ReportingService);
  private readonly selectedSite = inject(SelectedSiteService);
  private readonly destroyRef = inject(DestroyRef);

  readonly perimetreLabel = this.selectedSite.perimetreLabel;
  readonly typesSortie = TYPES_SORTIE;

  readonly filter = signal<ReportingFilter | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly valorisation = signal<StockValorisation | null>(null);
  readonly consommation = signal<ConsommationMatiere[]>([]);
  readonly ecarts = signal<EcartInventaire[]>([]);
  readonly alertes = signal<AlerteStock[]>([]);

  // ── Graphes ────────────────────────────────────────────────────────────────

  /** Valorisation : top matières (toutes sites confondues) par valeur. */
  readonly valorisationChartOptions = computed(() => {
    const matieres = (this.valorisation()?.sites ?? []).flatMap((s) =>
      s.matieres.map((m) => ({ name: m.matiere, value: m.valeur })),
    );
    const top = [...matieres].sort((a, b) => b.value - a.value).slice(0, MAX_ITEMS_CHART);
    return horizontalBar(top);
  });

  /** Consommation : barres empilées par type de mouvement (top matières). */
  readonly consommationChartOptions = computed(() => {
    const top = this.consommation().slice(0, MAX_ITEMS_CHART);
    return stackedBar(
      top.map((m) => m.matiere),
      this.typesSortie.map((t) => ({
        name: t.label,
        color: t.color,
        data: top.map((m) => m.ventilation[t.key]?.valeur ?? 0),
      })),
    );
  });

  /** Écarts d'inventaire : barres divergentes (+/-) en valeur. */
  readonly ecartsChartOptions = computed(() =>
    divergingBar(
      this.ecarts().map((e) => ({ name: `${e.site} — ${e.date}`, value: e.ecart_total_valeur })),
    ),
  );

  readonly fMontant = formatMontant;
  readonly fNombre = formatNombre;
  readonly fPct = formatPct;

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

  ventilationValeur(m: ConsommationMatiere, type: string): number {
    return m.ventilation[type]?.valeur ?? 0;
  }

  private load(filter: ReportingFilter, siteId: number | null): void {
    const scoped: ReportingFilter = siteId ? { ...filter, site_id: siteId } : filter;
    this.loading.set(true);
    this.error.set(null);

    forkJoin({
      valorisation: this.service.stockValorisation(scoped),
      consommation: this.service.stockConsommation(scoped),
      ecarts: this.service.stockEcartsInventaire(scoped),
      alertes: this.service.stockAlertes(scoped),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ valorisation, consommation, ecarts, alertes }) => {
          this.valorisation.set(valorisation);
          this.consommation.set(consommation);
          this.ecarts.set(ecarts);
          this.alertes.set(alertes);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Impossible de charger les rapports de stock.');
          this.loading.set(false);
        },
      });
  }
}
