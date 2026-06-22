import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

interface VenteTab {
  label: string;
  route: string;
}

@Component({
  selector: 'app-cartes-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './cartes.layout.html',
  styleUrl: './cartes.layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CartesLayout {
  readonly tabs: VenteTab[] = [
    { label: 'Cartes', route: 'liste' },
    { label: 'Produits', route: 'produits' },
  ];
}
