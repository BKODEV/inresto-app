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
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';

import { AuditService } from '../../../core/api/audit/audit.service';
import { AnnulationAudit, TypeAnnulable } from '../../../core/api/audit/audit.model';
import { SortAnnulation } from '../../../core/api/commande-client/commande-client.model';
import { Pagination } from '../../../core/api/api.types';
import { ReportingFilter } from '../../../core/api/reporting/reporting.model';
import { SelectedSiteService } from '../../../core/site/selected-site.service';
import { PeriodeFiltre } from '../shared/periode-filtre';
import { plageDeReporting } from '../shared/periode-plage';

/**
 * Relecture des annulations — lecture seule.
 *
 * La question de contrôle est le `sort` : une ligne annulée APRÈS service a
 * déjà été déstockée. Est-elle repartie en stock, ou passée en perte ? Une
 * perte récurrente sur un même produit est un signal, pas un accident.
 */
@Component({
  selector: 'app-annulations-page',
  standalone: true,
  imports: [DatePipe, RouterLink, PeriodeFiltre],
  templateUrl: './annulations.page.html',
  styleUrl: './audit.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnnulationsPage {
  private readonly service = inject(AuditService);
  private readonly selectedSite = inject(SelectedSiteService);
  private readonly destroyRef = inject(DestroyRef);

  readonly annulations = signal<AnnulationAudit[]>([]);
  readonly pagination = signal<Pagination | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  /**
   * Posé par la barre de période, qui émet dès son initialisation : c'est cette
   * première émission qui déclenche le chargement, d'où l'absence de `ngOnInit`.
   */
  readonly filtre = signal<ReportingFilter | null>(null);
  readonly sort = signal<SortAnnulation | null>(null);
  readonly nature = signal<TypeAnnulable | null>(null);
  readonly page = signal(1);

  readonly sortLabel: Record<SortAnnulation, string> = {
    remise_en_stock: 'Remise en stock',
    perte: 'Perte',
  };

  readonly natureLabel: Record<TypeAnnulable, string> = {
    commandes_client: 'Note entière',
    lignes_commande_client: 'Ligne',
  };

  /**
   * Le compte des pertes sur la page. C'est le chiffre qu'un responsable vient
   * chercher : une matière déjà déchargée et jetée ne revient jamais au stock.
   */
  readonly nbPertes = computed(() => this.annulations().filter((a) => a.sort === 'perte').length);

  constructor() {
    // Une seule source de chargement : la période, les deux filtres, la page et
    // le périmètre décrivent ensemble la question posée. Les gestes de l'écran
    // ne font que poser un signal — les appeler ET laisser l'effet réagir,
    // comme auparavant, lançait deux fois la même requête.
    effect(() => {
      this.selectedSite.epoch();
      const filtre = this.filtre();
      const sort = this.sort();
      const nature = this.nature();
      const page = this.page();

      if (filtre) {
        this.charger(filtre, sort, nature, page);
      }
    });
  }

  onPeriode(filtre: ReportingFilter): void {
    this.page.set(1);
    this.filtre.set(filtre);
  }

  onSort(valeur: string): void {
    this.page.set(1);
    this.sort.set(valeur === '' ? null : (valeur as SortAnnulation));
  }

  onNature(valeur: string): void {
    this.page.set(1);
    this.nature.set(valeur === '' ? null : (valeur as TypeAnnulable));
  }

  allerPage(page: number): void {
    this.page.set(page);
  }

  private charger(
    filtre: ReportingFilter,
    sort: SortAnnulation | null,
    nature: TypeAnnulable | null,
    page: number,
  ): void {
    this.loading.set(true);
    this.error.set(null);
    this.service
      .annulations({
        ...plageDeReporting(filtre),
        sort: sort ?? undefined,
        annulable_type: nature ?? undefined,
        site_id: this.selectedSite.selectedId() ?? undefined,
        page,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ lignes, pagination }) => {
          this.annulations.set(lignes);
          this.pagination.set(pagination);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Impossible de charger les annulations.');
          this.loading.set(false);
        },
      });
  }
}
