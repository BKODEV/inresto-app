import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';

interface ParamTab {
  label: string;
  route: string;
  /** Routes supplémentaires (sous-pages) pour lesquelles cet onglet reste surligné. */
  activeFor?: string[];
  /** Permission requise pour afficher l'onglet (absente = visible par tous). */
  permission?: string;
}

@Component({
  selector: 'app-parametres-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink],
  templateUrl: './parametres.layout.html',
  styleUrl: './parametres.layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ParametresLayout {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  /** URL courante, recalculée à chaque navigation. */
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  private readonly allTabs: ParamTab[] = [
    // Le détail d'un point de vente vit sous Sites (Site › PDV › Caisses).
    { label: 'Sites', route: 'sites', activeFor: ['points-de-vente'] },
    { label: 'Catégories produit', route: 'categories-produit' },
    { label: 'Catégories MP', route: 'categories-matiere-premiere' },
    { label: 'Unités de mesure', route: 'unites-de-mesure' },
    { label: 'Modes de paiement', route: 'modes-de-paiement' },
    // Organisation de la brigade : qui cuit quoi. Distinct des catégories
    // produit, qui rangent la carte pour le client.
    { label: 'Postes de production', route: 'postes-cuisine', permission: 'poste_cuisine.view' },
    { label: 'Utilisateurs', route: 'utilisateurs', permission: 'utilisateur.view' },
    { label: 'Rôles', route: 'roles', permission: 'role.view' },
    { label: "Journal d'activité", route: 'journal', permission: 'journal.view' },
    // Relectures de contrôle. Distinctes du journal, qui répond à « ce soir » en
    // plafonnant chaque source : ici on interroge une période, avec les filtres
    // propres à chaque nature de geste.
    { label: 'Remises', route: 'remises', permission: 'remise.view' },
    { label: 'Annulations', route: 'annulations', permission: 'annulation.view' },
  ];

  /** Onglets visibles selon les permissions de l'utilisateur connecté. */
  readonly tabs = computed(() =>
    this.allTabs.filter((tab) => this.auth.hasPermission(tab.permission)),
  );

  isActive(tab: ParamTab): boolean {
    const segments = [tab.route, ...(tab.activeFor ?? [])];

    return segments.some((segment) => this.url().includes(`/parametres/${segment}`));
  }
}
