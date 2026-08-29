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
import {
  LigneCommandeClient,
  ServicePass,
} from '../../../core/api/commande-client/commande-client.model';
import { PointDeVenteService } from '../../../core/api/point-de-vente/point-de-vente.service';
import { PointDeVente } from '../../../core/api/point-de-vente/point-de-vente.model';
import { PosteCuisineService } from '../../../core/api/poste-cuisine/poste-cuisine.service';
import { PosteCuisine } from '../../../core/api/poste-cuisine/poste-cuisine.model';
import { AuthService } from '../../../core/auth/auth.service';
import { SelectedSiteService } from '../../../core/site/selected-site.service';
import { rafraichissementAuto } from '../../../core/temps/rafraichissement-auto';
import { apiErrorMessage } from '../../../core/api/api-error.util';

/**
 * Le PASS, côté salle : ce que la cuisine a annoncé et qui attend d'être porté.
 *
 * Pendant du KDS pour l'autre métier, d'où deux différences qui ne sont pas
 * cosmétiques :
 *
 *  — une carte = une NOTE, pas un tour. L'unité de travail du runner est un
 *    voyage vers une table ; découper en tickets lui ferait faire le trajet
 *    deux fois pour la même table ;
 *  — le chrono part de l'ANNONCE. Ce qu'il mesure n'est plus le temps de la
 *    cuisine mais celui que met la salle à venir chercher — c'est-à-dire depuis
 *    combien de temps le plat refroidit.
 *
 * C'est ici, et seulement ici, que le stock bouge : « Servi » déstocke.
 */
@Component({
  selector: 'app-pass-page',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './pass.page.html',
  styleUrl: './caisse.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PassPage implements OnInit {
  private readonly commandeService = inject(CommandeClientService);
  private readonly pdvService = inject(PointDeVenteService);
  private readonly posteService = inject(PosteCuisineService);
  private readonly auth = inject(AuthService);
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
  /**
   * Postes du point de vente. Vide = l'établissement n'en a déclaré aucun, et
   * l'écran se comporte exactement comme avant : le sélecteur disparaît.
   */
  readonly postes = signal<PosteCuisine[]>([]);
  /** `null` = « Tous les postes ». */
  readonly selectedPosteId = signal<number | null>(null);
  readonly services = signal<ServicePass[]>([]);
  readonly loading = signal(true);
  readonly refreshing = signal(false);
  /** Note ou ligne en cours d'enlèvement, par clé : les deux gestes coexistent. */
  readonly actionEnCours = signal<string | null>(null);

  /** Servir déstocke : c'est `update`, comme partout où la note change d'état. */
  readonly peutServir = computed(() => this.auth.hasPermission('commande_client.update'));

  private readonly maintenant = signal(Date.now());

  /**
   * Seuils plus courts qu'en cuisine, et c'est voulu : un plat qui attend cinq
   * minutes sous la lampe est déjà tiède. En production, cinq minutes ne sont
   * rien.
   */
  private readonly SEUIL_ATTENTION = 3;
  private readonly SEUIL_RETARD = 6;

  constructor() {
    rafraichissementAuto(
      10_000,
      () => this.refresh(),
      () => this.actionEnCours() !== null,
    );

    rafraichissementAuto(10_000, () => this.maintenant.set(Date.now()));

    effect(() => {
      const list = this.pdvs();
      const current = untracked(() => this.selectedPdvId());
      if (current !== null && list.some((p) => p.id === current)) {
        return;
      }
      const next = list[0]?.id ?? null;
      this.selectedPdvId.set(next);
      if (next !== null) {
        this.chargerPostes(next);
        this.refresh();
      } else {
        this.postes.set([]);
        this.services.set([]);
      }
    });
  }

  ngOnInit(): void {
    // Écran servi hors du shell : personne d'autre ne charge le périmètre.
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

  /**
   * Recharge les postes du point de vente, puis la file.
   *
   * Le poste choisi est remis à « Tous » : un poste appartient à un pass, le
   * garder d'un point de vente à l'autre filtrerait sur un identifiant qui n'y
   * existe pas.
   */
  private chargerPostes(pdvId: number): void {
    this.selectedPosteId.set(null);
    this.posteService
      .list(pdvId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (postes) => this.postes.set(postes.filter((p) => p.statut === 'actif')),
        error: () => this.postes.set([]),
      });
  }

  onPosteChange(value: string): void {
    this.selectedPosteId.set(value ? Number(value) : null);
    this.refresh();
  }

  onPdvChange(value: string): void {
    const id = Number(value);
    this.selectedPdvId.set(id);
    this.chargerPostes(id);
    this.refresh();
  }

  refresh(): void {
    const pdvId = this.selectedPdvId();
    if (pdvId === null) {
      return;
    }
    this.refreshing.set(true);
    this.commandeService
      .pass(pdvId, this.selectedPosteId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (services) => {
          this.services.set(services);
          this.refreshing.set(false);
        },
        error: () => this.refreshing.set(false),
      });
  }

  private minutesEcoulees(service: ServicePass): number {
    if (!service.prete_le) {
      return 0;
    }
    return Math.max(
      0,
      Math.floor((this.maintenant() - new Date(service.prete_le).getTime()) / 60_000),
    );
  }

  attente(service: ServicePass): string {
    const minutes = this.minutesEcoulees(service);
    if (minutes < 60) {
      return `${minutes} min`;
    }
    return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`;
  }

  cleNote(service: ServicePass): string {
    return `note-${service.commande_id}`;
  }

  cleLigne(ligne: LigneCommandeClient): string {
    return `ligne-${ligne.id}`;
  }

  /** Gèle la ligne visée et le bouton de la note le temps de l'appel. */
  ligneEnAttente(service: ServicePass, ligne: LigneCommandeClient): boolean {
    const encours = this.actionEnCours();
    return encours === this.cleLigne(ligne) || encours === this.cleNote(service);
  }

  /** « Servi » sur un plat unique, « Tout servi » dès qu'il y en a plusieurs. */
  libelleNote(service: ServicePass): string {
    return service.lignes.length > 1 ? 'Tout servi' : 'Servi';
  }

  categorie(ligne: LigneCommandeClient): string | null {
    return ligne.produit?.categorie?.libelle ?? null;
  }

  urgence(service: ServicePass): string {
    const minutes = this.minutesEcoulees(service);
    if (minutes >= this.SEUIL_RETARD) {
      return 'kds-card--retard';
    }
    return minutes >= this.SEUIL_ATTENTION ? 'kds-card--attention' : '';
  }

  /**
   * Emporté en salle : c'est LE geste irréversible, celui qui décharge le stock.
   *
   * Cible les lignes de la note affichée, et elles seules. Un tour annoncé
   * entre-temps n'est pas sur la carte et ne doit pas partir avec.
   */
  servir(service: ServicePass): void {
    this.emporter(
      service,
      this.cleNote(service),
      service.lignes.map((l) => l.id),
    );
  }

  /**
   * Emporte UN plat, sans entraîner le reste de la note.
   *
   * Indispensable, pas confortable : servir déstocke. Le runner qui ne prend
   * que les entrées d'une note dont les plats attendent encore sous la lampe
   * déchargerait sinon des plats qu'il n'a pas portés — le reproche même dont
   * est né tout ce découpage.
   */
  servirLigne(service: ServicePass, ligne: LigneCommandeClient): void {
    this.emporter(service, this.cleLigne(ligne), [ligne.id]);
  }

  private emporter(service: ServicePass, cle: string, ligneIds: number[]): void {
    this.actionEnCours.set(cle);
    this.commandeService
      .servir(service.commande_id, ligneIds)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          // Une note vidée de ses lignes quitte le pass ; sinon elle reste avec
          // ce qui attend encore d'être porté.
          this.services.update((list) =>
            list
              .map((s) =>
                s.commande_id === service.commande_id
                  ? { ...s, lignes: s.lignes.filter((l) => !ligneIds.includes(l.id)) }
                  : s,
              )
              .filter((s) => s.lignes.length > 0),
          );
          this.actionEnCours.set(null);
        },
        error: (err: HttpErrorResponse) => {
          this.actionEnCours.set(null);
          alert(apiErrorMessage(err, 'Service impossible.'));
        },
      });
  }
}
