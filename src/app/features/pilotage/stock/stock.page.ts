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
import {
  AlerteStock,
  ConsommationMatiere,
  EcartInventaire,
  ReportingFilter,
  StockValorisation,
} from '../../../core/api/reporting/reporting.model';
import { SelectedSiteService } from '../../../core/site/selected-site.service';
import { PeriodeFiltre } from '../shared/periode-filtre';
import { formatMontant, formatNombre, formatPct } from '../shared/reporting-format';

/** Types de sortie affichés en colonnes dans la consommation. */
const TYPES_SORTIE: { key: string; label: string }[] = [
  { key: 'sortie_vente', label: 'Vente' },
  { key: 'perte', label: 'Perte' },
  { key: 'casse', label: 'Casse' },
  { key: 'offert', label: 'Offert' },
  { key: 'repas_personnel', label: 'Repas pers.' },
];

@Component({
  selector: 'app-stock-reporting-page',
  standalone: true,
  imports: [PeriodeFiltre],
  templateUrl: './stock.page.html',
  styleUrl: '../shared/reporting-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StockReportingPage {
  private readonly service = inject(ReportingService);
  private readonly selectedSite = inject(SelectedSiteService);
  private readonly destroyRef = inject(DestroyRef);

  readonly currentSite = this.selectedSite.selectedSite;
  readonly typesSortie = TYPES_SORTIE;

  readonly filter = signal<ReportingFilter | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly valorisation = signal<StockValorisation | null>(null);
  readonly consommation = signal<ConsommationMatiere[]>([]);
  readonly ecarts = signal<EcartInventaire[]>([]);
  readonly alertes = signal<AlerteStock[]>([]);

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
