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

import { ReportingService } from '../../../core/api/reporting/reporting.service';
import { TresoreriePosition } from '../../../core/api/reporting/reporting.model';
import { SelectedSiteService } from '../../../core/site/selected-site.service';
import { formatMontant } from '../shared/reporting-format';

/**
 * Où en est l'argent, par opposition à où en est la marge.
 *
 * Photo instantanée, donc PAS de filtre de période : « combien avons-nous, là,
 * maintenant » ne se demande pas sur un mois. Seul le périmètre de sites
 * s'applique, comme partout dans le pilotage.
 *
 * Cet écran n'enfreint pas la règle « on ne souffle jamais le montant attendu » :
 * celle-ci vise l'acte de COMPTAGE — un caissier devant son tiroir — et c'est
 * l'API qui la tient, en refusant la position au porteur d'une session ouverte.
 * Ici on lit un consolidé, derrière `reporting.tresorerie`.
 */
@Component({
  selector: 'app-tresorerie-page',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './tresorerie.page.html',
  styleUrl: '../shared/reporting-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TresoreriePage {
  private readonly service = inject(ReportingService);
  private readonly selectedSite = inject(SelectedSiteService);
  private readonly destroyRef = inject(DestroyRef);

  readonly perimetreLabel = this.selectedSite.perimetreLabel;

  readonly position = signal<TresoreriePosition | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly caissesOuvertes = computed(() => this.position()?.caisses_ouvertes ?? []);
  readonly caissesAuRepos = computed(() => this.position()?.caisses_au_repos ?? []);
  readonly nonComptees = computed(() => this.position()?.non_comptees ?? []);
  readonly totaux = computed(() => this.position()?.totaux ?? null);

  readonly fMontant = formatMontant;

  constructor() {
    effect(() => {
      this.load(this.selectedSite.selectedId());
    });
  }

  private load(siteId: number | null): void {
    this.loading.set(true);
    this.error.set(null);

    this.service
      .tresoreriePosition(siteId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (position) => {
          this.position.set(position);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Impossible de charger la position de trésorerie.');
          this.loading.set(false);
        },
      });
  }
}
