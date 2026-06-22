import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';

import { Site } from '../api/site/site.model';
import { SiteService } from '../api/site/site.service';
import { AuthService } from '../auth/auth.service';

const STORAGE_KEY = 'inresto.selected_site_id';

/**
 * Site couramment sélectionné, partagé par tous les écrans rattachés à un site
 * (budget, inventaire, réception) et piloté par le sélecteur global de la topbar.
 * Source unique des sites sélectionnables (chargés une fois) et de la sélection,
 * persistée en `localStorage` pour éviter de re-choisir à chaque navigation.
 */
@Injectable({ providedIn: 'root' })
export class SelectedSiteService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly siteApi = inject(SiteService);
  private readonly auth = inject(AuthService);

  private readonly _sites = signal<Site[]>([]);
  /** Sites sélectionnables (tous si gestionnaire, sinon périmètre de l'utilisateur). */
  readonly sites = this._sites.asReadonly();

  private readonly _selectedId = signal<number | null>(this.readStorage());
  readonly selectedId = this._selectedId.asReadonly();

  /** Site sélectionné résolu (null tant que la liste n'est pas chargée ou si invalide). */
  readonly selectedSite = computed(
    () => this._sites().find((s) => s.id === this._selectedId()) ?? null,
  );

  private readonly _loading = signal(false);
  readonly loading = this._loading.asReadonly();

  /**
   * Charge la liste des sites sélectionnables et aligne la sélection courante.
   * Tous les sites pour un gestionnaire (`site.view`), sinon le périmètre métier.
   * Appelé par le shell à chaque montage (donc après connexion).
   */
  refresh(): void {
    this._loading.set(true);
    const source$ = this.auth.hasPermission('site.view')
      ? this.siteApi.list()
      : this.siteApi.perimetre();

    source$.subscribe({
      next: (sites) => {
        this._sites.set(sites);
        this.syncSelection(sites);
        this._loading.set(false);
      },
      error: () => this._loading.set(false),
    });
  }

  set(id: number | null): void {
    this._selectedId.set(id);
    if (this.isBrowser) {
      if (id === null) {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, String(id));
      }
    }
  }

  /**
   * Conserve le choix courant s'il figure encore dans la liste, sinon retient le
   * premier site (ordre alphabétique). Met à jour la sélection persistée.
   */
  private syncSelection(sites: Site[]): void {
    if (sites.length === 0) {
      this.set(null);
      return;
    }
    const current = this._selectedId();
    if (current !== null && sites.some((s) => s.id === current)) {
      return;
    }
    this.set(sites[0].id);
  }

  private readStorage(): number | null {
    if (!this.isBrowser) {
      return null;
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? Number(raw) : null;
  }
}
