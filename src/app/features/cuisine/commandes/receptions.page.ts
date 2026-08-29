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
import { RouterLink } from '@angular/router';

import { ReceptionService } from '../../../core/api/reception/reception.service';
import { LigneReception, Reception } from '../../../core/api/reception/reception.model';
import { SelectedSiteService } from '../../../core/site/selected-site.service';
import { SiteRequisComponent } from '../../../shared/site-requis/site-requis.component';
import { AuthService } from '../../../core/auth/auth.service';
import { apiErrorMessage } from '../../../core/api/api-error.util';
import { QuantitePipe } from '../../../shared/format/nombre.pipes';

/**
 * Historique des réceptions du site courant. Une réception est immuable une
 * fois confirmée : cet écran est en lecture seule.
 */
@Component({
  selector: 'app-receptions-page',
  standalone: true,
  imports: [RouterLink, SiteRequisComponent, QuantitePipe],
  templateUrl: './receptions.page.html',
  styleUrl: './receptions.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReceptionsPage {
  private readonly service = inject(ReceptionService);
  private readonly selectedSite = inject(SelectedSiteService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  readonly sites = this.selectedSite.sites;
  readonly currentSite = this.selectedSite.selectedSite;
  readonly siteLoading = this.selectedSite.loading;
  readonly estConsolide = this.selectedSite.estConsolide;

  readonly items = signal<Reception[]>([]);
  readonly loading = signal(true);
  readonly listError = signal<string | null>(null);

  // Détail (lignes reçues) — chargé à la demande, le back ne les renvoie pas en liste.
  readonly detail = signal<Reception | null>(null);
  readonly detailOpen = signal(false);
  readonly detailLoading = signal(false);

  readonly canVoirCommande = computed(() => this.auth.hasPermission('commande-fournisseur.view'));

  private readonly montantFormatter = new Intl.NumberFormat('fr-FR');
  private readonly dateFormatter = new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  constructor() {
    effect(() => {
      const site = this.selectedSite.selectedSite();
      if (site) {
        this.load(site.id);
      } else {
        this.items.set([]);
        this.loading.set(false);
      }
    });
  }

  private load(siteId: number): void {
    this.loading.set(true);
    this.listError.set(null);
    this.service
      .list({ site_id: siteId })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.items.set(page.receptions);
          this.loading.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.loading.set(false);
          this.listError.set(apiErrorMessage(err, 'Chargement des réceptions impossible.'));
        },
      });
  }

  openDetail(item: Reception): void {
    this.detail.set(null);
    this.detailLoading.set(true);
    this.detailOpen.set(true);
    this.service
      .get(item.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (reception) => {
          this.detail.set(reception);
          this.detailLoading.set(false);
        },
        error: () => this.detailLoading.set(false),
      });
  }

  closeDetail(): void {
    this.detailOpen.set(false);
  }

  // ── Helpers d'affichage ─────────────────────────────────────────────────

  numeroCommande(item: Reception): string {
    return item.commande?.numero ?? `#${item.commande_fournisseur_id}`;
  }

  matiereLibelle(ligne: LigneReception): string {
    return ligne.matiere_premiere?.libelle ?? `Matière #${ligne.matiere_premiere_id}`;
  }

  uniteSymbole(ligne: LigneReception): string {
    return ligne.unite?.symbole ?? '—';
  }

  formatMontant(value: string | null): string {
    return value === null ? '—' : this.montantFormatter.format(Number(value));
  }

  formatDate(value: string | null): string {
    return value ? this.dateFormatter.format(new Date(value)) : '—';
  }
}
