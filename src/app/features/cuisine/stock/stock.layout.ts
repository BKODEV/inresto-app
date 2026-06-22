import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

interface StockTab {
  label: string;
  route: string;
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
  readonly tabs: StockTab[] = [
    { label: 'État du stock', route: 'etat' },
    { label: 'Mouvements de stock', route: 'mouvements' },
    { label: 'Inventaires', route: 'inventaires' },
  ];
}
