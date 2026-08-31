import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { redirigerVersOngletAutorise } from '../../core/navigation/onglet-autorise';

interface PilotageTab {
  label: string;
  route: string;
  permission: string;
}

@Component({
  selector: 'app-pilotage-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './pilotage.layout.html',
  styleUrl: './pilotage.layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PilotageLayout {
  private readonly auth = inject(AuthService);

  private readonly allTabs: PilotageTab[] = [
    { label: 'Food cost', route: 'food-cost', permission: 'reporting.food_cost' },
    { label: 'Ventes', route: 'ventes', permission: 'reporting.ventes' },
    { label: 'Stock', route: 'stock', permission: 'reporting.stock' },
    { label: 'Budget', route: 'budget', permission: 'reporting.budget' },
    // Relectures de contrôle : mêmes questions de fin de mois que les rapports
    // ci-dessus, sur les gestes qui retirent de l'argent au lieu d'en compter.
    // Gardées par leurs propres permissions, et non par `reporting.*` : la
    // direction qui supervise les remises n'analyse pas forcément le food cost.
    { label: 'Remises', route: 'remises', permission: 'remise.view' },
    { label: 'Annulations', route: 'annulations', permission: 'annulation.view' },
  ];

  /** Onglets visibles selon les permissions de l'utilisateur. */
  readonly tabs = computed(() => this.allTabs.filter((t) => this.auth.hasPermission(t.permission)));

  constructor() {
    redirigerVersOngletAutorise(this.tabs().map((t) => t.route));
  }
}
