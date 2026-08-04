import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'inresto.theme';

/**
 * Thème visuel de l'application.
 *
 * Le thème n'est qu'un attribut `data-theme` posé sur `<html>` : toute la
 * bascule tient dans la redéfinition des jetons CSS, aucun composant n'a de
 * règle qui lui soit propre.
 *
 * Sans choix mémorisé, on suit la préférence du système — un utilisateur qui a
 * réglé son poste en clair ne devrait pas avoir à le redire ici.
 *
 * L'attribut est également posé par un script en tête de `index.html`, avant le
 * premier rendu : sans lui, la page s'afficherait en sombre le temps que
 * l'application démarre, puis basculerait en clair sous les yeux de
 * l'utilisateur.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  private readonly _theme = signal<Theme>(this.themeInitial());
  readonly theme = this._theme.asReadonly();

  readonly estClair = computed(() => this._theme() === 'light');

  constructor() {
    this.appliquer(this._theme());
  }

  basculer(): void {
    this.definir(this._theme() === 'dark' ? 'light' : 'dark');
  }

  definir(theme: Theme): void {
    this._theme.set(theme);
    this.appliquer(theme);

    if (this.isBrowser) {
      localStorage.setItem(STORAGE_KEY, theme);
    }
  }

  private appliquer(theme: Theme): void {
    if (this.isBrowser) {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }

  private themeInitial(): Theme {
    if (!this.isBrowser) {
      return 'dark';
    }

    const memorise = localStorage.getItem(STORAGE_KEY);
    if (memorise === 'dark' || memorise === 'light') {
      return memorise;
    }

    return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
}
