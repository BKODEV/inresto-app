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
  TourKds,
} from '../../../core/api/commande-client/commande-client.model';
import { PointDeVenteService } from '../../../core/api/point-de-vente/point-de-vente.service';
import { PointDeVente } from '../../../core/api/point-de-vente/point-de-vente.model';
import { PosteCuisineService } from '../../../core/api/poste-cuisine/poste-cuisine.service';
import { PosteCuisine } from '../../../core/api/poste-cuisine/poste-cuisine.model';
import { AuthService } from '../../../core/auth/auth.service';
import { SelectedSiteService } from '../../../core/site/selected-site.service';
import { rafraichissementAuto } from '../../../core/temps/rafraichissement-auto';
import { apiErrorMessage } from '../../../core/api/api-error.util';
import { AlerteService } from '../../../core/alertes/alerte.service';

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
  private readonly posteService = inject(PosteCuisineService);
  private readonly auth = inject(AuthService);
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
  /**
   * Postes du point de vente. Vide = l'établissement n'en a déclaré aucun, et
   * l'écran se comporte exactement comme avant : le sélecteur disparaît.
   */
  readonly postes = signal<PosteCuisine[]>([]);
  /** `null` = « Tous les postes ». */
  readonly selectedPosteId = signal<number | null>(null);
  readonly tours = signal<TourKds[]>([]);
  /**
   * Ce que la cuisine a déjà annoncé et que la salle n'a pas encore emporté.
   *
   * Cette bande n'est pas décorative : une ligne annoncée quitte la file de
   * production, donc sans elle la dévalidation ne serait atteignable nulle
   * part. Elle dit aussi au chef ce qui refroidit sous la lampe, ce qu'aucun
   * autre écran ne lui apprend.
   */
  readonly auPass = signal<ServicePass[]>([]);
  readonly loading = signal(true);
  readonly refreshing = signal(false);
  /**
   * Ticket ou note en cours de mutation, identifié par sa clé. Sert à la fois à
   * désactiver le bouton et à suspendre le rafraîchissement, pour ne pas faire
   * disparaître une carte sous le doigt du cuisinier.
   */
  readonly actionEnCours = signal<string | null>(null);

  /** Sans `marquer_pret`, l'écran reste consultable mais muet. */
  readonly peutAnnoncer = computed(() => this.auth.hasPermission('commande_client.marquer_pret'));

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
    // à jour seul. En pause pendant qu'une carte est en cours de validation.
    rafraichissementAuto(
      15_000,
      () => this.refresh(),
      () => this.actionEnCours() !== null,
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
        this.chargerPostes(next);
        this.refresh();
      } else {
        this.postes.set([]);
        this.tours.set([]);
        this.auPass.set([]);
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
    this.chargerPostes(id);
    this.refresh();
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
    this.selectPdv(Number(value));
  }

  refresh(): void {
    const pdvId = this.selectedPdvId();
    if (pdvId === null) {
      return;
    }
    this.refreshing.set(true);
    this.commandeService
      .kds(pdvId, this.selectedPosteId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (tours) => {
          this.tours.set(tours);
          this.refreshing.set(false);
        },
        error: () => this.refreshing.set(false),
      });

    // Deux files distinctes, deux requêtes : à produire d'un côté, annoncé de
    // l'autre. Une erreur sur l'une ne doit pas vider l'autre.
    this.commandeService
      .pass(pdvId, this.selectedPosteId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (services) => this.auPass.set(services) });
  }

  /**
   * Minutes écoulées depuis l'ENVOI du tour, et non depuis l'ouverture de la
   * note : c'est la production qui traîne, pas le fait que la table soit
   * installée. Une note ouverte depuis une heure dont le dessert vient de
   * partir n'est pas en retard.
   */
  private minutesDepuis(horodatage: string | null): number {
    if (!horodatage) {
      return 0;
    }
    return Math.max(0, Math.floor((this.maintenant() - new Date(horodatage).getTime()) / 60_000));
  }

  /** « 7 min » puis « 1 h 05 » au-delà de l'heure. */
  private formaterDuree(minutes: number): string {
    if (minutes < 60) {
      return `${minutes} min`;
    }
    return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`;
  }

  attente(tour: TourKds): string {
    return this.formaterDuree(this.minutesDepuis(tour.envoyee_le));
  }

  /**
   * Depuis quand ça refroidit sous la lampe. Mesuré à partir de l'ANNONCE : ce
   * n'est plus le temps de la cuisine, c'est celui que met la salle à venir.
   */
  attentePass(service: ServicePass): string {
    return this.formaterDuree(this.minutesDepuis(service.prete_le));
  }

  /** Classe d'escalade : la couleur porte l'urgence avant la lecture du chiffre. */
  urgence(tour: TourKds): string {
    const minutes = this.minutesDepuis(tour.envoyee_le);
    if (minutes >= this.SEUIL_RETARD) {
      return 'kds-card--retard';
    }
    return minutes >= this.SEUIL_ATTENTION ? 'kds-card--attention' : '';
  }

  /** Identifiant d'affichage d'un tour : une note peut en avoir plusieurs. */
  cle(tour: TourKds): string {
    return `${tour.commande_id}|${tour.envoyee_le}`;
  }

  cleLigne(ligne: LigneCommandeClient): string {
    return `ligne-${ligne.id}`;
  }

  /**
   * Une ligne est-elle immobilisée ? Le temps d'un appel, on gèle la ligne
   * visée ET le bouton du ticket : sur un écran tactile en cuisine, un second
   * appui part tout seul.
   */
  ligneEnAttente(tour: TourKds, ligne: LigneCommandeClient): boolean {
    const encours = this.actionEnCours();
    return encours === this.cleLigne(ligne) || encours === this.cle(tour);
  }

  /** « Prêt » sur un plat unique, « Tout prêt » dès qu'il y en a plusieurs. */
  libelleTicket(tour: TourKds): string {
    return tour.lignes.length > 1 ? 'Tout prêt' : 'Prêt';
  }

  /** La catégorie saisie par l'établissement, quand le produit en porte une. */
  categorie(ligne: LigneCommandeClient): string | null {
    return ligne.produit?.categorie?.libelle ?? null;
  }

  /**
   * Annonce le ticket au pass, et lui seul : une note peut porter deux tours en
   * production, annoncer le premier ne doit pas emporter le second.
   *
   * Ne sert pas et ne déstocke pas — le plat n'est pas encore devant le client.
   * La salle prendra le relais depuis l'écran du pass.
   */
  annoncer(tour: TourKds): void {
    this.actionEnCours.set(this.cle(tour));
    this.commandeService
      .marquerPret(
        tour.commande_id,
        tour.lignes.map((l) => l.id),
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.tours.update((list) => list.filter((t) => this.cle(t) !== this.cle(tour)));
          this.actionEnCours.set(null);
          // Le ticket bascule dans l'autre file : la relire évite d'attendre le
          // prochain tic pour le voir réapparaître sous « au pass ».
          this.refresh();
        },
        error: (err: HttpErrorResponse) => {
          this.actionEnCours.set(null);
          this.alertes.erreur(apiErrorMessage(err, 'Annonce impossible.'));
        },
      });
  }

  /**
   * Annonce UN plat, sans emporter le reste du ticket.
   *
   * C'est le cas courant et non l'exception : une équipe tient les entrées, une
   * autre les plats, et le même ticket porte les deux. Ne pouvoir annoncer que
   * le ticket entier obligerait les entrées à attendre les plats — soit
   * exactement ce que la séparation prêt/servi cherche à défaire.
   */
  annoncerLigne(tour: TourKds, ligne: LigneCommandeClient): void {
    this.actionEnCours.set(this.cleLigne(ligne));
    this.commandeService
      .marquerPret(tour.commande_id, [ligne.id])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          // Retrait immédiat, sans attendre le tour de réseau : le ticket qui
          // n'a plus rien à produire disparaît avec sa dernière ligne.
          this.tours.update((list) =>
            list
              .map((t) =>
                this.cle(t) === this.cle(tour)
                  ? { ...t, lignes: t.lignes.filter((l) => l.id !== ligne.id) }
                  : t,
              )
              .filter((t) => t.lignes.length > 0),
          );
          this.actionEnCours.set(null);
          this.refresh();
        },
        error: (err: HttpErrorResponse) => {
          this.actionEnCours.set(null);
          this.alertes.erreur(apiErrorMessage(err, 'Annonce impossible.'));
        },
      });
  }

  /** Annoncé trop tôt : la note repart en production. */
  reprendre(service: ServicePass): void {
    const cle = `pass-${service.commande_id}`;
    this.actionEnCours.set(cle);
    this.commandeService
      .annulerPret(
        service.commande_id,
        service.lignes.map((l) => l.id),
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.actionEnCours.set(null);
          this.refresh();
        },
        error: (err: HttpErrorResponse) => {
          this.actionEnCours.set(null);
          this.alertes.erreur(apiErrorMessage(err, 'Reprise impossible.'));
        },
      });
  }

  clePass(service: ServicePass): string {
    return `pass-${service.commande_id}`;
  }
}
