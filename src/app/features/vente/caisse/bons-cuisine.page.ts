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
import { forkJoin } from 'rxjs';

import { BonCuisineService } from '../../../core/api/bon-cuisine/bon-cuisine.service';
import { BonCuisine } from '../../../core/api/bon-cuisine/bon-cuisine.model';
import { PointDeVenteService } from '../../../core/api/point-de-vente/point-de-vente.service';
import { PointDeVente } from '../../../core/api/point-de-vente/point-de-vente.model';
import { ouvrirPdfDansOnglet } from '../../../core/api/pdf/pdf.service';
import { SelectedSiteService } from '../../../core/site/selected-site.service';
import { rafraichissementAuto } from '../../../core/temps/rafraichissement-auto';
import { AlerteService } from '../../../core/alertes/alerte.service';

/**
 * Bons de cuisine, côté caisse.
 *
 * Sans écran en cuisine, le papier EST la commande : le serveur envoie, la
 * caisse imprime, le serveur dépose chaque bon à son poste. Cet écran est la
 * file qui garantit qu'aucun envoi ne reste en plan — tant qu'un bon n'est pas
 * sorti, il reste ici.
 *
 * Un bon ressorti part en DUPLICATA : en cuisine, il ne doit pas passer pour
 * une nouvelle commande.
 */
@Component({
  selector: 'app-bons-cuisine-page',
  standalone: true,
  templateUrl: './bons-cuisine.page.html',
  styleUrls: ['./caisse.page.scss', './bons-cuisine.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BonsCuisinePage implements OnInit {
  private readonly bonService = inject(BonCuisineService);
  private readonly pdvService = inject(PointDeVenteService);
  private readonly selectedSite = inject(SelectedSiteService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly alertes = inject(AlerteService);

  private readonly allPdvs = signal<PointDeVente[]>([]);
  readonly currentSite = this.selectedSite.selectedSite;
  readonly sites = this.selectedSite.sites;
  readonly selectedSiteId = this.selectedSite.selectedId;
  readonly pdvs = computed(() => {
    const siteId = this.selectedSite.selectedId();
    return siteId === null ? [] : this.allPdvs().filter((p) => p.site_id === siteId);
  });
  readonly selectedPdvId = signal<number | null>(null);

  /** Ce qui attend d'être sorti, du plus ancien au plus récent. */
  readonly enAttente = signal<BonCuisine[]>([]);
  /**
   * Traités aujourd'hui — imprimés, ou devenus sans objet avant de l'être —
   * le plus récent en tête.
   */
  readonly imprimes = signal<BonCuisine[]>([]);
  readonly loading = signal(true);
  readonly refreshing = signal(false);
  /** `'tout'` ou l'identifiant du bon en cours d'impression. */
  readonly impressionEnCours = signal<'tout' | number | null>(null);

  constructor() {
    // Plus court que l'encaissement : un bon qui attend, c'est une table dont
    // la cuisine ne sait encore rien.
    rafraichissementAuto(
      8_000,
      () => this.refresh(),
      () => this.impressionEnCours() !== null,
    );

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
        this.enAttente.set([]);
        this.imprimes.set([]);
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

  onSiteChange(value: string): void {
    this.selectedSite.selectSite(Number(value));
  }

  onPdvChange(value: string): void {
    this.selectedPdvId.set(Number(value));
    this.refresh();
  }

  refresh(): void {
    const pdvId = this.selectedPdvId();
    if (pdvId === null) {
      return;
    }
    this.refreshing.set(true);
    forkJoin({
      enAttente: this.bonService.aImprimer(pdvId),
      duJour: this.bonService.duJour(pdvId),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ enAttente, duJour }) => {
          this.enAttente.set(enAttente);
          this.imprimes.set(duJour.filter((b) => !b.a_imprimer).reverse());
          this.refreshing.set(false);
        },
        error: () => this.refreshing.set(false),
      });
  }

  /**
   * Sort toute la file d'un coup. L'API la vide dans le même geste : un second
   * clic, ou une autre caisse, ne la ressortira pas.
   */
  imprimerTout(): void {
    const pdvId = this.selectedPdvId();
    if (pdvId === null || this.enAttente().length === 0) {
      return;
    }
    this.imprimer('tout', pdvId, undefined, `bons-cuisine-${pdvId}.pdf`);
  }

  /** Un bon seul — en duplicata s'il est déjà sorti. */
  imprimerBon(bon: BonCuisine): void {
    this.imprimer(bon.id, bon.point_de_vente_id, [bon.id], `bon-cuisine-${bon.numero}.pdf`);
  }

  private imprimer(
    cle: 'tout' | number,
    pdvId: number,
    bonIds: number[] | undefined,
    nomFichier: string,
  ): void {
    this.impressionEnCours.set(cle);
    this.bonService
      .imprimer(pdvId, bonIds)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          ouvrirPdfDansOnglet(blob, nomFichier);
          this.impressionEnCours.set(null);
          this.refresh();
        },
        error: (err: HttpErrorResponse) => {
          this.impressionEnCours.set(null);
          // 409 : la file a été vidée entre-temps (autre caisse, double clic).
          // Rien de perdu — on montre l'état réel.
          if (err.status === 409) {
            this.alertes.info('Aucun bon en attente : ils ont déjà été imprimés.');
          } else {
            this.alertes.erreur('Impression impossible. Réessayez.');
          }
          this.refresh();
        },
      });
  }

  /** Ce qui sortira sur le papier : les plats servis ou annulés entre-temps n'y sont plus. */
  lignesAImprimer(bon: BonCuisine) {
    return (bon.lignes ?? []).filter((l) => !l.sans_objet);
  }

  /**
   * Seul un bon qui a existé en cuisine se réimprime. Celui devenu sans objet
   * avant d'être sorti n'a rien à mettre sur le papier.
   */
  peutReimprimer(bon: BonCuisine): boolean {
    return bon.imprime_le !== null;
  }

  heure(iso: string | null): string {
    return iso
      ? new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      : '—';
  }

  badgeType(bon: BonCuisine): string {
    switch (bon.type) {
      case 'annulation':
        return 'badge-danger';
      case 'ajout':
        return 'badge-warning';
      default:
        return 'badge-info';
    }
  }
}
