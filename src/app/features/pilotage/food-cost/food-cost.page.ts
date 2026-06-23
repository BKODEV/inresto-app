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
  FoodCostPdvLigne,
  FoodCostProduitLigne,
  FoodCostSynthese,
  LignesNonValorisees,
  ReportingFilter,
} from '../../../core/api/reporting/reporting.model';
import { SelectedSiteService } from '../../../core/site/selected-site.service';
import { PeriodeFiltre } from '../shared/periode-filtre';
import { formatMontant, formatNombre, formatPct } from '../shared/reporting-format';

@Component({
  selector: 'app-food-cost-page',
  standalone: true,
  imports: [PeriodeFiltre],
  templateUrl: './food-cost.page.html',
  styleUrl: '../shared/reporting-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FoodCostPage {
  private readonly service = inject(ReportingService);
  private readonly selectedSite = inject(SelectedSiteService);
  private readonly destroyRef = inject(DestroyRef);

  readonly currentSite = this.selectedSite.selectedSite;

  readonly filter = signal<ReportingFilter | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly synthese = signal<FoodCostSynthese | null>(null);
  readonly produits = signal<FoodCostProduitLigne[]>([]);
  readonly pointsDeVente = signal<FoodCostPdvLigne[]>([]);
  readonly nonValorisees = signal<LignesNonValorisees | null>(null);

  readonly fMontant = formatMontant;
  readonly fNombre = formatNombre;
  readonly fPct = formatPct;

  constructor() {
    effect(() => {
      const filter = this.filter();
      // Dépendance explicite au site global sélectionné.
      const siteId = this.selectedSite.selectedId();
      if (filter) {
        this.load(filter, siteId);
      }
    });
  }

  onFilter(filter: ReportingFilter): void {
    this.filter.set(filter);
  }

  private load(filter: ReportingFilter, siteId: number | null): void {
    const scoped: ReportingFilter = siteId ? { ...filter, site_id: siteId } : filter;
    this.loading.set(true);
    this.error.set(null);

    forkJoin({
      synthese: this.service.foodCostSynthese(scoped),
      produits: this.service.foodCostProduits(scoped),
      pdv: this.service.foodCostPointsDeVente(scoped),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ synthese, produits, pdv }) => {
          this.synthese.set(synthese);
          this.produits.set(produits.produits);
          this.nonValorisees.set(produits.lignes_non_valorisees);
          this.pointsDeVente.set(pdv.points_de_vente);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Impossible de charger le food cost.');
          this.loading.set(false);
        },
      });
  }
}
