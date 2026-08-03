import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { Title } from '@angular/platform-browser';

import { MenuPublic } from '../../../core/api/public-menu/public-menu.model';
import { PublicMenuService } from '../../../core/api/public-menu/public-menu.service';

/**
 * Page menu scannée par un client à sa table — la seule page publique de l'app.
 *
 * Pensée mobile d'abord (elle s'ouvre sur un téléphone, souvent en 4G) et
 * volontairement à l'écart du thème sombre de l'administration : un convive
 * doit lire une carte de restaurant, pas un back-office. Consultation seule en
 * V1 : aucune action, aucun bouton de commande.
 */
@Component({
  selector: 'app-menu-public-page',
  standalone: true,
  templateUrl: './menu-public.page.html',
  styleUrl: './menu-public.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MenuPublicPage implements OnInit {
  private readonly service = inject(PublicMenuService);
  private readonly title = inject(Title);

  /** Jeton de la table, lié depuis l'URL (`withComponentInputBinding`). */
  readonly token = input.required<string>();

  readonly menu = signal<MenuPublic | null>(null);
  readonly loading = signal(true);
  /** Jeton inconnu, ou API injoignable : même message neutre côté client. */
  readonly introuvable = signal(false);

  readonly indisponible = computed(
    () => this.introuvable() || this.menu()?.menu_indisponible === true,
  );

  private readonly devise = computed(() => this.menu()?.etablissement.devise ?? 'XOF');

  ngOnInit(): void {
    this.service.get(this.token()).subscribe({
      next: (menu) => {
        this.menu.set(menu);
        this.loading.set(false);
        const nom = menu.etablissement.nom;
        this.title.setTitle(nom ? `${nom} — Menu` : 'Menu');
      },
      // 404 (jeton inconnu) comme panne réseau : on ne détaille rien au client,
      // et le rendu serveur en échec sera rattrapé par l'appel du navigateur.
      error: (_err: HttpErrorResponse) => {
        this.introuvable.set(true);
        this.loading.set(false);
      },
    });
  }

  /**
   * Prix formaté dans la devise de l'établissement. `Intl` gère les décimales
   * propres à chaque devise (XOF sans décimale, EUR avec).
   */
  prix(valeur: number): string {
    try {
      return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: this.devise(),
        currencyDisplay: 'narrowSymbol',
      }).format(valeur);
    } catch {
      // Devise non reconnue par Intl : on affiche le code tel quel.
      return `${valeur.toLocaleString('fr-FR')} ${this.devise()}`;
    }
  }

  /** Allergènes saisis en texte libre : découpés en puces pour la lisibilité. */
  allergenes(valeur: string | null): string[] {
    return (valeur ?? '')
      .split(/[,;]/)
      .map((a) => a.trim())
      .filter((a) => a.length > 0);
  }
}
