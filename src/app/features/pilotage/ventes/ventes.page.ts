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
  EvolutionPoint,
  ReportingFilter,
  TriProduit,
  VenteModePaiement,
  VenteParPdv,
  VenteProduit,
  VenteServeur,
} from '../../../core/api/reporting/reporting.model';
import { SelectedSiteService } from '../../../core/site/selected-site.service';
import { ChartComponent } from '../../../shared/chart/chart.component';
import {
  caEvolutionLine,
  chartFormat,
  donutChart,
  horizontalBar,
  verticalBar,
} from '../../../shared/chart/chart-options';
import { PeriodeFiltre } from '../shared/periode-filtre';
import { formatMontant, formatNombre, formatPct } from '../shared/reporting-format';

@Component({
  selector: 'app-ventes-page',
  standalone: true,
  imports: [PeriodeFiltre, ChartComponent],
  templateUrl: './ventes.page.html',
  styleUrl: '../shared/reporting-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VentesPage {
  private readonly service = inject(ReportingService);
  private readonly selectedSite = inject(SelectedSiteService);
  private readonly destroyRef = inject(DestroyRef);

  readonly currentSite = this.selectedSite.selectedSite;

  readonly filter = signal<ReportingFilter | null>(null);
  readonly tri = signal<TriProduit>('ca');
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly parPdv = signal<VenteParPdv[]>([]);
  readonly produits = signal<VenteProduit[]>([]);
  readonly modesPaiement = signal<VenteModePaiement[]>([]);
  readonly serveurs = signal<VenteServeur[]>([]);
  readonly evolution = signal<EvolutionPoint[]>([]);

  /** CA total de la période (somme des PDV) pour la carte de tête. */
  readonly caTotal = computed(() => this.parPdv().reduce((acc, p) => acc + p.ca, 0));
  readonly nbCommandes = computed(() =>
    this.parPdv().reduce((acc, p) => acc + p.nombre_commandes, 0),
  );
  readonly panierMoyen = computed(() => {
    const nb = this.nbCommandes();
    return nb > 0 ? this.caTotal() / nb : 0;
  });
  readonly nbPdv = computed(() => this.parPdv().length);

  // ── Options des graphes ECharts ────────────────────────────────────────────

  readonly evolutionOptions = computed(() => caEvolutionLine(this.evolution()));

  readonly pdvOptions = computed(() =>
    verticalBar(this.parPdv().map((p) => ({ name: p.point_de_vente, value: p.ca }))),
  );

  readonly produitsOptions = computed(() => {
    const parQuantite = this.tri() === 'quantite';
    return horizontalBar(
      this.produits().map((p) => ({
        name: p.produit,
        value: parQuantite ? p.quantite_vendue : p.ca,
      })),
      parQuantite ? { valueFormatter: chartFormat.nombre } : {},
    );
  });

  readonly modesOptions = computed(() =>
    donutChart(this.modesPaiement().map((m) => ({ name: m.mode, value: m.montant_total }))),
  );

  readonly serveursOptions = computed(() =>
    horizontalBar(this.serveurs().map((s) => ({ name: s.serveur, value: s.ca }))),
  );

  readonly fMontant = formatMontant;
  readonly fNombre = formatNombre;
  readonly fPct = formatPct;

  constructor() {
    effect(() => {
      const filter = this.filter();
      const siteId = this.selectedSite.selectedId();
      const tri = this.tri();
      if (filter) {
        this.load(filter, siteId, tri);
      }
    });
  }

  onFilter(filter: ReportingFilter): void {
    this.filter.set(filter);
  }

  setTri(value: string): void {
    this.tri.set(value as TriProduit);
  }

  private load(filter: ReportingFilter, siteId: number | null, tri: TriProduit): void {
    const scoped: ReportingFilter = siteId ? { ...filter, site_id: siteId } : filter;
    this.loading.set(true);
    this.error.set(null);

    forkJoin({
      parPdv: this.service.ventesParPointDeVente(scoped),
      produits: this.service.ventesProduits(scoped, { tri, ordre: 'desc', limit: 20 }),
      modes: this.service.ventesModesPaiement(scoped),
      serveurs: this.service.ventesServeurs(scoped),
      evolution: this.service.ventesEvolution(scoped),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ parPdv, produits, modes, serveurs, evolution }) => {
          this.parPdv.set(parPdv);
          this.produits.set(produits);
          this.modesPaiement.set(modes);
          this.serveurs.set(serveurs);
          this.evolution.set(evolution);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Impossible de charger les ventes.');
          this.loading.set(false);
        },
      });
  }
}
