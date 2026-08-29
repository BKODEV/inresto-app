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
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';

import { SessionCuisineService } from '../../../core/api/session-cuisine/session-cuisine.service';
import {
  LigneProduction,
  SessionCuisine,
} from '../../../core/api/session-cuisine/session-cuisine.model';
import { PointDeVenteService } from '../../../core/api/point-de-vente/point-de-vente.service';
import { PointDeVente } from '../../../core/api/point-de-vente/point-de-vente.model';
import { MembreBrigade } from '../../../core/api/session-cuisine/session-cuisine.model';
import { SelectedSiteService } from '../../../core/site/selected-site.service';
import { SiteRequisComponent } from '../../../shared/site-requis/site-requis.component';
import { AuthService } from '../../../core/auth/auth.service';
import { apiErrorMessage } from '../../../core/api/api-error.util';
import { MontantPipe } from '../../../shared/format/nombre.pipes';

type DrawerMode = 'ouvrir' | 'fermer' | 'production' | null;

/**
 * Services de cuisine — le pendant brigade de la session de caisse.
 *
 * Indépendant d'elle : un point de vente porte plusieurs caisses pour une seule
 * cuisine, et la brigade travaille avant la première ouverture de caisse (mise
 * en place) comme après la dernière fermeture (nettoyage). Ce que le module
 * apporte : savoir quelle ÉQUIPE a produit quoi, là où les ventes ne disent que
 * quel serveur a vendu.
 */
@Component({
  selector: 'app-sessions-cuisine-page',
  standalone: true,
  imports: [DatePipe, NgTemplateOutlet, ReactiveFormsModule, SiteRequisComponent, MontantPipe],
  templateUrl: './sessions-cuisine.page.html',
  styleUrl: './caisse.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionsCuisinePage implements OnInit {
  private readonly service = inject(SessionCuisineService);
  private readonly pdvService = inject(PointDeVenteService);
  private readonly selectedSite = inject(SelectedSiteService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly currentSite = this.selectedSite.selectedSite;
  readonly estConsolide = this.selectedSite.estConsolide;

  private readonly allPointsDeVente = signal<PointDeVente[]>([]);
  readonly pointsDeVente = computed(() => {
    const siteId = this.selectedSite.selectedId();

    return siteId === null ? [] : this.allPointsDeVente().filter((p) => p.site_id === siteId);
  });
  readonly selectedPdvId = signal<number | null>(null);

  readonly sessions = signal<SessionCuisine[]>([]);

  /**
   * Qui peut être inscrit. Par défaut la cuisine de CE point de vente, c'est-à-
   * dire les personnes rattachées à l'un de ses postes de production : le
   * sélecteur déroulait auparavant tout le personnel du site, serveurs et
   * caissiers compris.
   */
  readonly personnel = signal<MembreBrigade[]>([]);
  /**
   * Élargit à tout le personnel du site. Un extra qui ne figure dans aucun
   * poste doit rester inscriptible, sinon un service tenu par un intérimaire ne
   * serait imputable à personne.
   */
  readonly toutLePersonnel = signal(false);
  readonly personnelLoading = signal(false);
  readonly loading = signal(true);
  readonly loadingSessions = signal(false);

  readonly drawerMode = signal<DrawerMode>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);

  /** Service dont on consulte la production, ou qu'on ferme. */
  readonly cible = signal<SessionCuisine | null>(null);
  readonly production = signal<LigneProduction[]>([]);
  readonly productionLoading = signal(false);

  /**
   * La brigade en cours de composition. Un `Set` plutôt qu'un formulaire : on
   * coche des noms, il n'y a rien d'autre à valider.
   */
  readonly brigade = signal<ReadonlySet<string>>(new Set());

  readonly peutOuvrir = computed(() => this.auth.hasPermission('session_cuisine.ouvrir'));
  readonly peutFermer = computed(() => this.auth.hasPermission('session_cuisine.fermer'));

  readonly ouvrirForm = this.fb.nonNullable.group({
    libelle: [''],
    notes: [''],
  });
  readonly fermerForm = this.fb.nonNullable.group({
    notes: [''],
  });

  /** Un seul service ouvert par point de vente — même règle que la caisse. */
  readonly sessionOuverte = computed(
    () => this.sessions().find((s) => s.statut === 'ouverte') ?? null,
  );

  readonly totalProduit = computed(() => this.production().reduce((acc, l) => acc + l.quantite, 0));
  readonly caProduit = computed(() => this.production().reduce((acc, l) => acc + l.ca, 0));

  constructor() {
    // Aligne le point de vente sur le site global et recharge ses services.
    effect(() => {
      const list = this.pointsDeVente();
      const current = untracked(() => this.selectedPdvId());
      if (current !== null && list.some((p) => p.id === current)) {
        return;
      }
      const next = list[0]?.id ?? null;
      this.selectedPdvId.set(next);
      if (next !== null) {
        this.loadSessions(next);
        this.loadPersonnel(next);
      } else {
        this.sessions.set([]);
        this.personnel.set([]);
      }
    });
  }

  ngOnInit(): void {
    this.pdvService
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (liste) => {
          this.allPointsDeVente.set(liste);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  onPdvChange(valeur: string): void {
    const id = Number(valeur);
    this.selectedPdvId.set(id);
    this.loadSessions(id);
    // La brigade dépend du point de vente : un site peut porter deux pass, qui
    // n'ont ni la même cuisine ni la même équipe.
    this.loadPersonnel(id);
  }

  basculerToutLePersonnel(actif: boolean): void {
    this.toutLePersonnel.set(actif);
    const pdvId = this.selectedPdvId();
    if (pdvId !== null) {
      this.loadPersonnel(pdvId);
    }
  }

  // ── Brigade ───────────────────────────────────────────────────────────────

  basculerMembre(userId: string): void {
    this.brigade.update((set) => {
      const suivant = new Set(set);
      if (!suivant.delete(userId)) {
        suivant.add(userId);
      }

      return suivant;
    });
  }

  estDansBrigade(userId: string): boolean {
    return this.brigade().has(userId);
  }

  // ── Ouverture ─────────────────────────────────────────────────────────────

  openOuvrir(): void {
    this.ouvrirForm.reset({ libelle: '', notes: '' });
    this.brigade.set(new Set());
    this.formError.set(null);
    this.drawerMode.set('ouvrir');
  }

  ouvrir(): void {
    const pdvId = this.selectedPdvId();
    if (pdvId === null || this.saving()) {
      return;
    }
    this.saving.set(true);
    this.formError.set(null);

    const raw = this.ouvrirForm.getRawValue();
    this.service
      .ouvrir({
        point_de_vente_id: pdvId,
        libelle: raw.libelle || null,
        notes: raw.notes || null,
        brigade: [...this.brigade()],
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.drawerMode.set(null);
          this.loadSessions(pdvId);
        },
        error: (err: HttpErrorResponse) => {
          this.saving.set(false);
          this.formError.set(apiErrorMessage(err, "Impossible d'ouvrir le service."));
        },
      });
  }

  // ── Fermeture ─────────────────────────────────────────────────────────────

  openFermer(session: SessionCuisine): void {
    this.cible.set(session);
    this.fermerForm.reset({ notes: session.notes ?? '' });
    // On repart de l'équipe déclarée : la fermeture sert à la corriger, pas à
    // la ressaisir.
    this.brigade.set(new Set((session.brigade ?? []).map((m) => m.id)));
    this.formError.set(null);
    this.drawerMode.set('fermer');
  }

  fermer(): void {
    const session = this.cible();
    const pdvId = this.selectedPdvId();
    if (session === null || this.saving()) {
      return;
    }
    this.saving.set(true);
    this.formError.set(null);

    this.service
      .fermer(session.id, {
        notes: this.fermerForm.getRawValue().notes || null,
        brigade: [...this.brigade()],
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.drawerMode.set(null);
          this.cible.set(null);
          if (pdvId !== null) {
            this.loadSessions(pdvId);
          }
        },
        error: (err: HttpErrorResponse) => {
          this.saving.set(false);
          // Le 409 « plats non annoncés » est la réponse la plus utile de cet
          // écran : elle nomme ce qui reste à faire avant de fermer.
          this.formError.set(apiErrorMessage(err, 'Impossible de fermer le service.'));
        },
      });
  }

  // ── Production ────────────────────────────────────────────────────────────

  openProduction(session: SessionCuisine): void {
    this.cible.set(session);
    this.production.set([]);
    this.productionLoading.set(true);
    this.drawerMode.set('production');

    this.service
      .production(session.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ production }) => {
          this.production.set(production);
          this.productionLoading.set(false);
        },
        error: () => this.productionLoading.set(false),
      });
  }

  closeDrawer(): void {
    this.drawerMode.set(null);
    this.cible.set(null);
  }

  /** Les noms de l'équipe, d'un trait. */
  brigadeLibelle(session: SessionCuisine): string {
    const noms = (session.brigade ?? []).map((m) => m.nom);

    return noms.length > 0 ? noms.join(' · ') : '—';
  }

  /**
   * Servi par l'API en lecture minimale, et non par `GET /users` : cette
   * dernière exige `utilisateur.view`, que le chef de cuisine n'a pas — le
   * sélecteur répondait 403 et restait vide pour la seule personne qui ouvre
   * un service.
   */
  private loadPersonnel(pointDeVenteId: number): void {
    this.personnelLoading.set(true);
    this.service
      .personnel(pointDeVenteId, !this.toutLePersonnel())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (liste) => {
          this.personnel.set(liste);
          this.personnelLoading.set(false);
        },
        error: () => {
          this.personnel.set([]);
          this.personnelLoading.set(false);
        },
      });
  }

  private loadSessions(pointDeVenteId: number): void {
    this.loadingSessions.set(true);
    this.service
      .list({ point_de_vente_id: pointDeVenteId })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ sessions }) => {
          this.sessions.set(sessions);
          this.loadingSessions.set(false);
        },
        error: () => this.loadingSessions.set(false),
      });
  }
}
