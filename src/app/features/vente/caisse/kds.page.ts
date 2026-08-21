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

import { RouterLink } from '@angular/router';

import { CommandeClientService } from '../../../core/api/commande-client/commande-client.service';
import { TourKds } from '../../../core/api/commande-client/commande-client.model';
import { PointDeVenteService } from '../../../core/api/point-de-vente/point-de-vente.service';
import { PointDeVente } from '../../../core/api/point-de-vente/point-de-vente.model';
import { SelectedSiteService } from '../../../core/site/selected-site.service';
import { rafraichissementAuto } from '../../../core/temps/rafraichissement-auto';
import { apiErrorMessage } from '../../../core/api/api-error.util';

@Component({
  selector: 'app-kds-page',
  standalone: true,
  imports: [RouterLink],
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
  readonly sites = this.selectedSite.sites;
  readonly selectedSiteId = this.selectedSite.selectedId;
  readonly pdvs = computed(() => {
    const siteId = this.selectedSite.selectedId();
    return siteId === null ? [] : this.allPdvs().filter((p) => p.site_id === siteId);
  });
  readonly selectedPdvId = signal<number | null>(null);
  readonly tours = signal<TourKds[]>([]);
  readonly loading = signal(true);
  readonly refreshing = signal(false);
  /** Tour en cours de validation, identifié par son horodatage. */
  readonly servingTour = signal<string | null>(null);

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
      () => this.servingTour() !== null,
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
        this.tours.set([]);
      }
    });
  }

  ngOnInit(): void {
    // Hors du shell, personne d'autre ne charge le périmètre de l'utilisateur —
    // et sans lui, `pdvs()` reste vide et l'écran n'affiche jamais rien.
    this.selectedSite.refresh();

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

  onSiteChange(value: string): void {
    this.selectedSite.selectSite(Number(value));
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
        next: (tours) => {
          this.tours.set(tours);
          this.refreshing.set(false);
        },
        error: () => this.refreshing.set(false),
      });
  }

  /**
   * Minutes écoulées depuis l'ENVOI du tour, et non depuis l'ouverture de la
   * note : c'est la production qui traîne, pas le fait que la table soit
   * installée. Une note ouverte depuis une heure dont le dessert vient de
   * partir n'est pas en retard.
   */
  private minutesEcoulees(tour: TourKds): number {
    if (!tour.envoyee_le) {
      return 0;
    }
    return Math.max(
      0,
      Math.floor((this.maintenant() - new Date(tour.envoyee_le).getTime()) / 60_000),
    );
  }

  /** « 7 min » puis « 1 h 05 » au-delà de l'heure. */
  attente(tour: TourKds): string {
    const minutes = this.minutesEcoulees(tour);
    if (minutes < 60) {
      return `${minutes} min`;
    }
    return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`;
  }

  /** Classe d'escalade : la couleur porte l'urgence avant la lecture du chiffre. */
  urgence(tour: TourKds): string {
    const minutes = this.minutesEcoulees(tour);
    if (minutes >= this.SEUIL_RETARD) {
      return 'kds-card--retard';
    }
    return minutes >= this.SEUIL_ATTENTION ? 'kds-card--attention' : '';
  }

  /** Identifiant d'affichage d'un tour : une note peut en avoir plusieurs. */
  cle(tour: TourKds): string {
    return `${tour.commande_id}|${tour.envoyee_le}`;
  }

  /**
   * Valide le ticket, et lui seul : une note peut porter deux tours en
   * production, servir le premier ne doit pas emporter le second.
   */
  servir(tour: TourKds): void {
    this.servingTour.set(this.cle(tour));
    this.commandeService
      .servir(
        tour.commande_id,
        tour.lignes.map((l) => l.id),
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.tours.update((list) => list.filter((t) => this.cle(t) !== this.cle(tour)));
          this.servingTour.set(null);
        },
        error: (err: HttpErrorResponse) => {
          this.servingTour.set(null);
          alert(apiErrorMessage(err, 'Service impossible.'));
        },
      });
  }
}
