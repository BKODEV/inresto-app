import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

interface CuisineTab {
  label: string;
  route: string;
}

@Component({
  selector: 'app-fiches-techniques-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './fiches-techniques.layout.html',
  styleUrl: './fiches-techniques.layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FichesTechniquesLayout {
  readonly tabs: CuisineTab[] = [
    { label: 'Produits', route: 'produits' },
    { label: 'Fiches techniques', route: 'fiches' },
    { label: 'Sous-recettes', route: 'sous-recettes' },
  ];
}
