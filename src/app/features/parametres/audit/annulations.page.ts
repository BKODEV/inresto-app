import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
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
import { SelectedSiteService } from '../../../core/site/selected-site.service';

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
  imports: [DatePipe, RouterLink],
  templateUrl: './annulations.page.html',
  styleUrl: './audit.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnnulationsPage implements OnInit {
  private readonly service = inject(AuditService);
  private readonly selectedSite = inject(SelectedSiteService);
  private readonly destroyRef = inject(DestroyRef);

  readonly annulations = signal<AnnulationAudit[]>([]);
  readonly pagination = signal<Pagination | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  private readonly aujourdhui = new Date().toISOString().slice(0, 10);
  readonly dateDebut = signal(this.premierDuMois());
  readonly dateFin = signal(this.aujourdhui);
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
    effect(() => {
      this.selectedSite.epoch();
      this.charger();
    });
  }

  ngOnInit(): void {
    this.charger();
  }

  onDateDebut(valeur: string): void {
    this.dateDebut.set(valeur);
    this.page.set(1);
    this.charger();
  }

  onDateFin(valeur: string): void {
    this.dateFin.set(valeur);
    this.page.set(1);
    this.charger();
  }

  onSort(valeur: string): void {
    this.sort.set(valeur === '' ? null : (valeur as SortAnnulation));
    this.page.set(1);
    this.charger();
  }

  onNature(valeur: string): void {
    this.nature.set(valeur === '' ? null : (valeur as TypeAnnulable));
    this.page.set(1);
    this.charger();
  }

  allerPage(page: number): void {
    this.page.set(page);
    this.charger();
  }

  private premierDuMois(): string {
    const now = new Date();

    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  }

  private charger(): void {
    this.loading.set(true);
    this.error.set(null);
    this.service
      .annulations({
        date_debut: this.dateDebut(),
        date_fin: this.dateFin(),
        sort: this.sort() ?? undefined,
        annulable_type: this.nature() ?? undefined,
        site_id: this.selectedSite.selectedId() ?? undefined,
        page: this.page(),
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
