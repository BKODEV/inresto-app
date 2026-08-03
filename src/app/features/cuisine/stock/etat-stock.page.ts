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
import { HttpErrorResponse } from '@angular/common/http';

import { StockService } from '../../../core/api/stock/stock.service';
import { Stock } from '../../../core/api/stock/stock.model';
import { UniteDeMesureService } from '../../../core/api/unite-de-mesure/unite-de-mesure.service';
import { UniteDeMesure } from '../../../core/api/unite-de-mesure/unite-de-mesure.model';
import { SelectedSiteService } from '../../../core/site/selected-site.service';
import { SiteRequisComponent } from '../../../shared/site-requis/site-requis.component';
import { apiErrorMessage } from '../../../core/api/api-error.util';

/**
 * État du stock du site courant : quantité, PMP et valeur par matière, avec
 * signalement des matières retombées sous leur seuil d'alerte.
 *
 * Écran opérationnel (permission `stock.view`), volontairement distinct du
 * rapport `/pilotage/stock` qui agrège sur une période et tous sites confondus.
 */
@Component({
  selector: 'app-etat-stock-page',
  standalone: true,
  imports: [SiteRequisComponent],
  templateUrl: './etat-stock.page.html',
  styleUrl: './etat-stock.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EtatStockPage {
  private readonly service = inject(StockService);
  private readonly uniteService = inject(UniteDeMesureService);
  private readonly selectedSite = inject(SelectedSiteService);
  private readonly destroyRef = inject(DestroyRef);

  // Site piloté par le sélecteur global de la topbar (comme les inventaires).
  readonly sites = this.selectedSite.sites;
  readonly currentSite = this.selectedSite.selectedSite;
  readonly siteLoading = this.selectedSite.loading;
  readonly estConsolide = this.selectedSite.estConsolide;

  readonly items = signal<Stock[]>([]);
  readonly unites = signal<UniteDeMesure[]>([]);
  readonly totalValorise = signal(0);
  readonly loading = signal(true);
  readonly listError = signal<string | null>(null);
  readonly sousSeuilOnly = signal(false);

  readonly nbSousSeuil = computed(() => this.items().filter((s) => s.sous_seuil).length);

  private readonly montantFormatter = new Intl.NumberFormat('fr-FR');
  private readonly quantiteFormatter = new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 3,
  });

  constructor() {
    // Recharge dès que le site global ou le filtre « sous seuil » change.
    effect(() => {
      const site = this.selectedSite.selectedSite();
      const sousSeuil = this.sousSeuilOnly();
      if (site) {
        this.load(site.id, sousSeuil);
      } else {
        this.items.set([]);
        this.totalValorise.set(0);
        this.loading.set(false);
      }
    });

    this.uniteService
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((data) => this.unites.set(data));
  }

  private load(siteId: number, sousSeuil: boolean): void {
    this.loading.set(true);
    this.listError.set(null);
    this.service
      .list({ site_id: siteId, sous_seuil: sousSeuil })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.items.set(page.stocks);
          this.totalValorise.set(page.total_valorise);
          this.loading.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.loading.set(false);
          this.listError.set(apiErrorMessage(err, 'Chargement du stock impossible.'));
        },
      });
  }

  toggleSousSeuil(): void {
    this.sousSeuilOnly.update((value) => !value);
  }

  // ── Helpers d'affichage ─────────────────────────────────────────────────

  matiereLibelle(stock: Stock): string {
    return stock.matiere_premiere?.libelle ?? `Matière #${stock.matiere_premiere_id}`;
  }

  /** Unité de STOCKAGE de la matière (celle dans laquelle le stock est tenu). */
  uniteSymbole(stock: Stock): string {
    const matiere = stock.matiere_premiere;
    if (!matiere) {
      return '—';
    }
    return (
      matiere.unite?.symbole ??
      this.unites().find((u) => u.id === matiere.unite_de_mesure_id)?.symbole ??
      '—'
    );
  }

  formatQuantite(value: string | null): string {
    return value === null ? '—' : this.quantiteFormatter.format(Number(value));
  }

  formatMontant(value: string | number | null): string {
    return value === null ? '—' : this.montantFormatter.format(Number(value));
  }
}
