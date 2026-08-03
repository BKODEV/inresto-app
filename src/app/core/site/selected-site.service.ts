import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';

import { Site } from '../api/site/site.model';
import { SiteService } from '../api/site/site.service';

const STORAGE_KEY = 'inresto.selected_site_id';

/** Valeur stockée pour le mode consolidé (« tous mes sites »). */
const TOUS_LES_SITES = 'all';

/**
 * Portée courante :
 * - `'pending'` : aucun choix fait — le shell bloque l'accès aux écrans ;
 * - `number`    : un site précis, seul mode où l'opérationnel fonctionne ;
 * - `'all'`     : périmètre entier, pour la lecture consolidée (pilotage).
 */
export type SiteScope = 'pending' | number | typeof TOUS_LES_SITES;

/**
 * Périmètre courant, partagé par tous les écrans rattachés à un site et piloté
 * par le sélecteur global de la topbar.
 *
 * Le choix est **imposé** au premier chargement plutôt que déduit du premier
 * site venu : sélectionner silencieusement un site ferait opérer l'utilisateur
 * sur un stock qu'il n'a pas choisi. Seule exception, l'utilisateur ne
 * disposant que d'un site — lui imposer un choix unique ne serait que friction.
 */
@Injectable({ providedIn: 'root' })
export class SelectedSiteService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly siteApi = inject(SiteService);

  private readonly _sites = signal<Site[]>([]);
  /** Sites du périmètre de l'utilisateur (tous les sites actifs pour un super-admin). */
  readonly sites = this._sites.asReadonly();

  /**
   * Restaurée **synchroniquement** depuis `localStorage`, avant même le
   * chargement du périmètre : sinon la portée resterait `'pending'` pendant tout
   * l'aller-retour HTTP, et tout écran affiché dans cette fenêtre se comporterait
   * comme si aucun site n'était choisi (un PDF sans en-tête, une liste vide).
   * `syncScope()` la validera ensuite contre le périmètre réellement autorisé.
   */
  private readonly _scope = signal<SiteScope>(this.lireStockage());
  readonly scope = this._scope.asReadonly();

  /** Portée pas encore déterminée : rien de fiable à afficher. */
  readonly scopeInconnu = computed(() => this._scope() === 'pending');

  /** Site unique sélectionné, ou `null` en mode consolidé / en attente de choix. */
  readonly selectedSite = computed<Site | null>(() => {
    const scope = this._scope();
    return typeof scope === 'number' ? (this._sites().find((s) => s.id === scope) ?? null) : null;
  });

  readonly selectedId = computed<number | null>(() => {
    const scope = this._scope();
    return typeof scope === 'number' ? scope : null;
  });

  /** Vue consolidée : la lecture couvre tout le périmètre, l'opérationnel est indisponible. */
  readonly estConsolide = computed(() => this._scope() === TOUS_LES_SITES);

  /** Aucun choix encore fait : le shell doit le réclamer avant d'afficher quoi que ce soit. */
  readonly doitChoisir = computed(() => this._scope() === 'pending' && this._sites().length > 0);

  /** Le mode consolidé n'a de sens qu'à partir de deux sites. */
  readonly consolidationPossible = computed(() => this._sites().length > 1);

  /** Portée courante en clair, pour les en-têtes d'écran. */
  readonly perimetreLabel = computed(() => {
    if (this.estConsolide()) {
      return `Tous mes sites (${this._sites().length})`;
    }
    return this.selectedSite()?.nom ?? '';
  });

  private readonly _loading = signal(false);
  readonly loading = this._loading.asReadonly();

  /**
   * Compteur incrémenté à chaque changement de portée. Les écrans paginés s'y
   * abonnent pour revenir en page 1 : rester en page 4 après un changement de
   * site afficherait une liste vide.
   */
  private readonly _epoch = signal(0);
  readonly epoch = this._epoch.asReadonly();

  /**
   * Charge le périmètre de l'utilisateur et aligne la portée courante.
   *
   * Toujours `perimetre()` et jamais `list()` : cette dernière renvoie tous les
   * sites de l'application, y compris ceux que l'API refusera ensuite. Le
   * super-admin reçoit déjà tous les sites actifs par cet endpoint.
   */
  refresh(): void {
    this._loading.set(true);

    this.siteApi.perimetre().subscribe({
      next: (sites) => {
        this._sites.set(sites);
        this.syncScope(sites);
        this._loading.set(false);
      },
      error: () => this._loading.set(false),
    });
  }

  /** Sélectionne un site précis. */
  selectSite(id: number): void {
    this.appliquer(id);
  }

  /** Bascule en vue consolidée sur l'ensemble du périmètre. */
  selectTousLesSites(): void {
    this.appliquer(TOUS_LES_SITES);
  }

  /** Valeur du `<select>` de la topbar : id numérique ou `'all'`. */
  applyFromSelect(value: string): void {
    if (value === TOUS_LES_SITES) {
      this.selectTousLesSites();
      return;
    }
    if (value) {
      this.selectSite(Number(value));
    }
  }

  /**
   * `site_id` à passer aux services API : `undefined` en consolidé, ce qui
   * laisse le back appliquer le périmètre complet de l'utilisateur.
   */
  siteIdParam(): number | undefined {
    return this.selectedId() ?? undefined;
  }

  private appliquer(scope: SiteScope): void {
    if (this._scope() === scope) {
      return;
    }

    this._scope.set(scope);
    this._epoch.update((n) => n + 1);
    this.persister(scope);
  }

  /**
   * Aligne la portée restaurée sur le périmètre réellement disponible : un site
   * qui n'y figure plus (droits révoqués, site désactivé) redevient un choix à
   * faire plutôt qu'un repli silencieux sur un autre site.
   */
  private syncScope(sites: Site[]): void {
    if (sites.length === 0) {
      this._scope.set('pending');
      this.persister('pending');
      return;
    }

    if (sites.length === 1) {
      this.appliquer(sites[0].id);
      return;
    }

    const restaure = this.lireStockage();

    if (restaure === TOUS_LES_SITES) {
      this._scope.set(TOUS_LES_SITES);
      return;
    }

    if (typeof restaure === 'number' && sites.some((s) => s.id === restaure)) {
      this._scope.set(restaure);
      return;
    }

    this._scope.set('pending');
    this.persister('pending');
  }

  private persister(scope: SiteScope): void {
    if (!this.isBrowser) {
      return;
    }

    if (scope === 'pending') {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    localStorage.setItem(STORAGE_KEY, String(scope));
  }

  private lireStockage(): SiteScope {
    if (!this.isBrowser) {
      return 'pending';
    }

    const brut = localStorage.getItem(STORAGE_KEY);
    if (brut === TOUS_LES_SITES) {
      return TOUS_LES_SITES;
    }

    const id = Number(brut);
    return brut && Number.isFinite(id) ? id : 'pending';
  }
}
