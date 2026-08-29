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
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { CommandeClientService } from '../../../core/api/commande-client/commande-client.service';
import {
  CommandeClient,
  StatutCommandeClient,
} from '../../../core/api/commande-client/commande-client.model';
import { TableService } from '../../../core/api/table/table.service';
import { TableSalle } from '../../../core/api/table/table.model';
import { SessionCaisseService } from '../../../core/api/session-caisse/session-caisse.service';
import { SessionCaisse } from '../../../core/api/session-caisse/session-caisse.model';
import { PointDeVenteService } from '../../../core/api/point-de-vente/point-de-vente.service';
import { PointDeVente } from '../../../core/api/point-de-vente/point-de-vente.model';
import { SelectedSiteService } from '../../../core/site/selected-site.service';
import { rafraichissementAuto } from '../../../core/temps/rafraichissement-auto';
import { SiteRequisComponent } from '../../../shared/site-requis/site-requis.component';
import { apiErrorMessage } from '../../../core/api/api-error.util';
import { AuthService } from '../../../core/auth/auth.service';
import { MontantPipe } from '../../../shared/format/nombre.pipes';

const ACTIFS: StatutCommandeClient[] = ['ouverte', 'envoyee_en_cuisine', 'servie'];

@Component({
  selector: 'app-commandes-vente-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, SiteRequisComponent, MontantPipe],
  templateUrl: './commandes.page.html',
  styleUrl: './caisse.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommandesVentePage implements OnInit {
  private readonly commandeService = inject(CommandeClientService);
  private readonly tableService = inject(TableService);
  private readonly sessionService = inject(SessionCaisseService);
  private readonly pdvService = inject(PointDeVenteService);
  private readonly selectedSite = inject(SelectedSiteService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(AuthService);

  /**
   * Une table servie attend le temps que le client se lève, aille au comptoir
   * et règle. Au-delà, elle mérite un regard ; bien au-delà, il faut aller voir.
   */
  private readonly SEUIL_ATTENTION = 15;
  private readonly SEUIL_OUBLI = 30;

  /** Filtre d'affichage : le serveur ne voit que les notes qu'il a ouvertes. */
  readonly mesTablesSeulement = signal(false);

  /** Horloge d'affichage : l'attente se recalcule sans interroger l'API. */
  private readonly maintenant = signal(Date.now());

  readonly statutLabel: Record<StatutCommandeClient, string> = {
    ouverte: 'Ouverte',
    envoyee_en_cuisine: 'En cuisine',
    servie: 'Servie',
    encaissee: 'Encaissée',
    annulee: 'Annulée',
  };

  private readonly allPdvs = signal<PointDeVente[]>([]);
  readonly currentSite = this.selectedSite.selectedSite;
  readonly estConsolide = this.selectedSite.estConsolide;
  readonly pdvs = computed(() => {
    const siteId = this.selectedSite.selectedId();
    return siteId === null ? [] : this.allPdvs().filter((p) => p.site_id === siteId);
  });
  readonly selectedPdvId = signal<number | null>(null);
  readonly commandes = signal<CommandeClient[]>([]);
  readonly tables = signal<TableSalle[]>([]);
  readonly sessions = signal<SessionCaisse[]>([]);
  readonly loading = signal(true);
  readonly loadingData = signal(false);

  readonly drawerOpen = signal(false);
  /** Table tapée dans le plan : intitule la confirmation. Null = création libre. */
  readonly tableDemandee = signal<TableSalle | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);

  readonly tablesDisponibles = computed(() =>
    this.tables().filter((t) => t.statut === 'libre' || t.statut === 'reservee'),
  );

  /**
   * Plan de salle : chaque table du point de vente avec la commande active qui
   * l'occupe, s'il y en a une.
   *
   * C'est le point d'entrée du service. Un serveur debout, en plein coup de
   * feu, tape une table — il ne lit pas un tableau et ne cherche pas un bouton
   * « ouvrir » dans une colonne d'actions.
   */
  readonly plan = computed(() => {
    const parTable = new Map<number, CommandeClient>();
    for (const commande of this.commandes()) {
      parTable.set(commande.table_id, commande);
    }

    const mien = this.mesTablesSeulement() ? this.auth.user()?.id : null;

    // Tri naturel : l'API ordonne par `numero`, une colonne texte, qui place
    // T10 avant T2. Le plan de salle doit se lire dans l'ordre de la salle.
    return (
      [...this.tables()]
        .sort((a, b) => a.numero.localeCompare(b.numero, 'fr', { numeric: true }))
        .map((table) => ({
          table,
          commande: parTable.get(table.id) ?? null,
        }))
        // Filtre d'affichage et non règle d'accès : un serveur peut toujours
        // reprendre la table d'un collègue, il ne veut simplement pas la voir
        // quand il cherche les siennes.
        .filter((entree) => mien === null || entree.commande?.user_id === mien)
    );
  });

  /**
   * Depuis combien de temps cette table attend son addition.
   *
   * Le repère n'est pas l'ouverture de la note — une table peut manger deux
   * heures — mais son passage à « servie ». C'est le seul signal qui distingue
   * un client parti au comptoir d'un client parti tout court.
   */
  attenteReglement(commande: CommandeClient): string | null {
    const minutes = this.minutesDepuisService(commande);
    if (minutes === null) {
      return null;
    }
    if (minutes < 60) {
      return `${minutes} min`;
    }

    return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`;
  }

  /** Escalade visuelle : une table servie qui traîne finit par se voir. */
  classeAttente(commande: CommandeClient): string {
    const minutes = this.minutesDepuisService(commande);
    if (minutes === null) {
      return '';
    }
    if (minutes >= this.SEUIL_OUBLI) {
      return 'attente--oubli';
    }

    return minutes >= this.SEUIL_ATTENTION ? 'attente--attention' : '';
  }

  private minutesDepuisService(commande: CommandeClient): number | null {
    if (commande.statut !== 'servie' || commande.servie_le === null) {
      return null;
    }

    return Math.max(
      0,
      Math.floor((this.maintenant() - new Date(commande.servie_le).getTime()) / 60_000),
    );
  }

  /** Bascule vers l'ancienne liste, utile pour retrouver une commande par son numéro. */
  readonly vueListe = signal(false);

  readonly form = this.fb.nonNullable.group({
    table_id: [0, [Validators.required, Validators.min(1)]],
    session_caisse_id: [0, [Validators.required, Validators.min(1)]],
  });

  constructor() {
    // La salle bouge pendant qu'on regarde l'écran : commandes ouvertes par un
    // collègue, tables libérées. En pause tiroir ouvert, pour ne pas recharger
    // sous une saisie en cours.
    rafraichissementAuto(
      20_000,
      () => this.rafraichir(),
      () => this.drawerOpen(),
    );

    // Le contenu du tiroir appartient au site quitté : changer de périmètre le
    // ferme plutôt que d'enregistrer une saisie sur le mauvais site.
    effect(() => {
      this.selectedSite.epoch();
      this.drawerOpen.set(false);
    });

    // Aligne le PDV sur le site global et recharge les données du PDV retenu.
    effect(() => {
      const list = this.pdvs();
      const current = untracked(() => this.selectedPdvId());
      if (current !== null && list.some((p) => p.id === current)) {
        return;
      }
      const next = list[0]?.id ?? null;
      this.selectedPdvId.set(next);
      if (next !== null) {
        this.loadData(next);
      } else {
        this.commandes.set([]);
        this.tables.set([]);
        this.sessions.set([]);
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
    this.loadData(id);
  }

  private loadData(id: number, options: { discret?: boolean } = {}): void {
    if (options.discret !== true) {
      this.loadingData.set(true);
    }
    forkJoin({
      // Filtré en base : l'écran ne charge que les commandes vivantes de SON
      // point de vente, pas l'historique complet du restaurant.
      commandes: this.commandeService.list({ point_de_vente_id: id, statut: ACTIFS }),
      tables: this.tableService.list(id),
      sessions: this.sessionService.list(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ commandes, tables, sessions }) => {
          this.commandes.set(commandes);
          this.tables.set(tables);
          this.sessions.set(
            sessions.filter((s) => s.statut === 'ouverte' && s.caisse?.point_de_vente_id === id),
          );
          this.loadingData.set(false);
        },
        error: () => this.loadingData.set(false),
      });
  }

  onPdvChange(value: string): void {
    this.selectPdv(Number(value));
  }

  tableLabel(c: CommandeClient): string {
    return c.table ? `Table ${c.table.numero}` : `#${c.table_id}`;
  }

  /** Recharge sans faire clignoter l'écran (pas d'état « chargement »). */
  private rafraichir(): void {
    const pdvId = this.selectedPdvId();
    if (pdvId !== null) {
      this.loadData(pdvId, { discret: true });
    }
  }

  basculerVue(): void {
    this.vueListe.update((v) => !v);
  }

  /**
   * Geste unique du service : taper une table. Elle est occupée → on ouvre sa
   * commande ; elle est libre → on demande confirmation avant d'en créer une.
   *
   * La confirmation n'est pas une politesse. Le plan de salle est une grille de
   * grandes cibles tapées au doigt en plein service, et créer sur simple
   * effleurement produisait des commandes accidentelles que seule une
   * annulation motivée pouvait défaire.
   */
  ouvrirTable(entree: { table: TableSalle; commande: CommandeClient | null }): void {
    if (entree.commande !== null) {
      this.router.navigate(['/vente/caisse/commandes', entree.commande.id]);

      return;
    }

    const sessions = this.sessions();
    if (sessions.length === 0) {
      return;
    }

    this.tableDemandee.set(entree.table);
    this.form.reset({ table_id: entree.table.id, session_caisse_id: sessions[0].id });
    this.formError.set(null);
    this.drawerOpen.set(true);
  }

  openCreate(): void {
    this.tableDemandee.set(null);
    this.form.reset({ table_id: 0, session_caisse_id: this.sessions()[0]?.id ?? 0 });
    this.formError.set(null);
    this.drawerOpen.set(true);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
    this.tableDemandee.set(null);
  }

  create(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.formError.set(null);
    this.commandeService
      .create(this.form.getRawValue())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (commande) => {
          this.saving.set(false);
          this.drawerOpen.set(false);
          this.router.navigate(['/vente/caisse/commandes', commande.id]);
        },
        error: (err: HttpErrorResponse) => {
          this.saving.set(false);
          this.formError.set(apiErrorMessage(err, 'Ouverture impossible.'));
        },
      });
  }
}
