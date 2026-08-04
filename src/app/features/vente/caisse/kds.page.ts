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
import { rafraichissementAuto } from '../../../core/temps/rafraichissement-auto';
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

  /**
   * Horloge d'affichage : les minutes écoulées sont recalculées à chaque tic.
   * C'est le signal principal d'un écran de cuisine — sans lui, on ne sait pas
   * quelle commande traîne.
   */
  private readonly maintenant = signal(Date.now());

  /** Minutes au-delà desquelles la carte s'alarme. */
  private readonly SEUIL_ATTENTION = 10;
  private readonly SEUIL_RETARD = 20;

  constructor() {
    // Un écran de cuisine reste affiché sans qu'on le touche : il doit se tenir
    // à jour seul. En pause pendant qu'une commande part au service, pour ne
    // pas la faire disparaître sous le doigt du cuisinier.
    rafraichissementAuto(
      15_000,
      () => this.refresh(),
      () => this.servingId() !== null,
    );

    // L'horloge n'interroge rien : elle fait juste vieillir l'affichage.
    rafraichissementAuto(10_000, () => this.maintenant.set(Date.now()));

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

  /** Minutes écoulées depuis l'ouverture de la commande. */
  private minutesEcoulees(c: CommandeClient): number {
    if (!c.date_heure) {
      return 0;
    }
    return Math.max(0, Math.floor((this.maintenant() - new Date(c.date_heure).getTime()) / 60_000));
  }

  /** « 7 min » puis « 1 h 05 » au-delà de l'heure. */
  attente(c: CommandeClient): string {
    const minutes = this.minutesEcoulees(c);
    if (minutes < 60) {
      return `${minutes} min`;
    }
    return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`;
  }

  /** Classe d'escalade : la couleur porte l'urgence avant la lecture du chiffre. */
  urgence(c: CommandeClient): string {
    const minutes = this.minutesEcoulees(c);
    if (minutes >= this.SEUIL_RETARD) {
      return 'kds-card--retard';
    }
    return minutes >= this.SEUIL_ATTENTION ? 'kds-card--attention' : '';
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
