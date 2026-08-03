import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { redirigerVersOngletAutorise } from '../../../core/navigation/onglet-autorise';

interface AchatTab {
  label: string;
  route: string;
  permission?: string;
}

@Component({
  selector: 'app-commandes-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './commandes.layout.html',
  styleUrl: './commandes.layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommandesLayout {
  private readonly auth = inject(AuthService);

  private readonly allTabs: AchatTab[] = [
    { label: 'Commandes', route: 'liste', permission: 'commande-fournisseur.view' },
    { label: 'Réceptions', route: 'receptions', permission: 'reception.view' },
  ];

  readonly tabs = computed(() => this.allTabs.filter((t) => this.auth.hasPermission(t.permission)));

  constructor() {
    redirigerVersOngletAutorise(this.tabs().map((t) => t.route));
  }
}
