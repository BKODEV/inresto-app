import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';

interface ParamTab {
  label: string;
  route: string;
  /** Routes supplémentaires (sous-pages) pour lesquelles cet onglet reste surligné. */
  activeFor?: string[];
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

  /** URL courante, recalculée à chaque navigation. */
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  readonly tabs: ParamTab[] = [
    // Le détail d'un point de vente vit sous Sites (Site › PDV › Caisses).
    { label: 'Sites', route: 'sites', activeFor: ['points-de-vente'] },
    { label: 'Catégories produit', route: 'categories-produit' },
    { label: 'Catégories MP', route: 'categories-matiere-premiere' },
    { label: 'Unités de mesure', route: 'unites-de-mesure' },
    { label: 'Modes de paiement', route: 'modes-de-paiement' },
  ];

  isActive(tab: ParamTab): boolean {
    const segments = [tab.route, ...(tab.activeFor ?? [])];

    return segments.some((segment) => this.url().includes(`/parametres/${segment}`));
  }
}
