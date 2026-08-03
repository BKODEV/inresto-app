import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';

import { CommandeClientService } from '../../../core/api/commande-client/commande-client.service';
import { CommandeClient } from '../../../core/api/commande-client/commande-client.model';
import { PointDeVenteService } from '../../../core/api/point-de-vente/point-de-vente.service';
import { PointDeVente } from '../../../core/api/point-de-vente/point-de-vente.model';
import { SelectedSiteService } from '../../../core/site/selected-site.service';
import { SiteRequisComponent } from '../../../shared/site-requis/site-requis.component';
import { apiErrorMessage } from '../../../core/api/api-error.util';

@Component({
  selector: 'app-kds-page',
  standalone: true,
  imports: [SiteRequisComponent],
  templateUrl: './kds.page.html',
  styleUrl: './caisse.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KdsPage implements OnInit {
  private readonly commandeService = inject(CommandeClientService);
  private readonly pdvService = inject(PointDeVenteService);
  private readonly selectedSite = inject(SelectedSiteService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly allPdvs = signal<PointDeVente[]>([]);
  readonly currentSite = this.selectedSite.selectedSite;
  readonly estConsolide = this.selectedSite.estConsolide;
  readonly pdvs = computed(() => {
    const siteId = this.selectedSite.selectedId();
    return siteId === null ? [] : this.allPdvs().filter((p) => p.site_id === siteId);
  });
  readonly selectedPdvId = signal<number | null>(null);
  readonly commandes = signal<CommandeClient[]>([]);
  readonly loading = signal(true);
  readonly refreshing = signal(false);
  readonly servingId = signal<number | null>(null);

  constructor() {
    // Aligne le PDV sur le site global et rafraîchit la file cuisine.
    effect(() => {
      const list = this.pdvs();
      const current = untracked(() => this.selectedPdvId());
      if (current !== null && list.some((p) => p.id === current)) {
        return;
      }
      const next = list[0]?.id ?? null;
      this.selectedPdvId.set(next);
      if (next !== null) {
        this.refresh();
      } else {
        this.commandes.set([]);
      }
    });
  }

  ngOnInit(): void {
    this.pdvService
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (pdvs) => {
          this.allPdvs.set(pdvs);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  selectPdv(id: number): void {
    this.selectedPdvId.set(id);
    this.refresh();
  }

  onPdvChange(value: string): void {
    this.selectPdv(Number(value));
  }

  refresh(): void {
    const pdvId = this.selectedPdvId();
    if (pdvId === null) {
      return;
    }
    this.refreshing.set(true);
    this.commandeService
      .kds(pdvId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (commandes) => {
          this.commandes.set(commandes);
          this.refreshing.set(false);
        },
        error: () => this.refreshing.set(false),
      });
  }

  lignesActives(c: CommandeClient) {
    return c.lignes?.filter((l) => l.statut === 'actif') ?? [];
  }

  servir(c: CommandeClient): void {
    this.servingId.set(c.id);
    this.commandeService
      .servir(c.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.commandes.update((list) => list.filter((x) => x.id !== c.id));
          this.servingId.set(null);
        },
        error: (err: HttpErrorResponse) => {
          this.servingId.set(null);
          alert(apiErrorMessage(err, 'Service impossible.'));
        },
      });
  }
}
