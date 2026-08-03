import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { redirigerVersOngletAutorise } from '../../../core/navigation/onglet-autorise';

interface StockTab {
  label: string;
  route: string;
  /** Absente => onglet visible par tout utilisateur ayant accès à la section. */
  permission?: string;
}

@Component({
  selector: 'app-stock-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './stock.layout.html',
  styleUrl: './stock.layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StockLayout {
  private readonly auth = inject(AuthService);

  private readonly allTabs: StockTab[] = [
    { label: 'État du stock', route: 'etat', permission: 'stock.view' },
    { label: 'Mouvements de stock', route: 'mouvements', permission: 'stock.view' },
    { label: 'Inventaires', route: 'inventaires', permission: 'inventaire.view' },
  ];

  /** La section est accessible dès une permission ; on masque les onglets non autorisés. */
  readonly tabs = computed(() => this.allTabs.filter((t) => this.auth.hasPermission(t.permission)));

  constructor() {
    redirigerVersOngletAutorise(this.tabs().map((t) => t.route));
  }
}
