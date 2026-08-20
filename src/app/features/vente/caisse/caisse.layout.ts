import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { redirigerVersOngletAutorise } from '../../../core/navigation/onglet-autorise';

interface CaisseTab {
  label: string;
  route: string;
  permission: string;
}

@Component({
  selector: 'app-caisse-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './caisse.layout.html',
  styleUrl: './caisse.layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CaisseLayout {
  private readonly auth = inject(AuthService);

  /**
   * Deux métiers distincts sous une même section : le serveur qui saisit les
   * commandes n'a rien à faire dans les fonds de caisse, et le responsable de
   * caisse n'ouvre pas forcément de commande.
   *
   * L'onglet Sessions est gardé par `session_caisse.create` et NON par
   * `.view` : cet écran sert à ouvrir et fermer une caisse, pas à la consulter.
   * Le serveur détient `.view` pour une tout autre raison — rattacher sa
   * commande à une session ouverte impose de lister les sessions — et le garder
   * ici lui montrerait les fonds initiaux et les écarts.
   *
   * L'écran cuisine (KDS) n'est plus ici : c'est un afficheur mural, servi
   * hors du shell sur `/kds`.
   */
  private readonly allTabs: CaisseTab[] = [
    { label: 'Sessions', route: 'sessions', permission: 'session_caisse.create' },
    { label: 'Prise de commande', route: 'commandes', permission: 'commande_client.view' },
  ];

  readonly tabs = computed(() => this.allTabs.filter((t) => this.auth.hasPermission(t.permission)));

  constructor() {
    redirigerVersOngletAutorise(this.tabs().map((t) => t.route));
  }
}
