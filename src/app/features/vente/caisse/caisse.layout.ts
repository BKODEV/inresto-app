import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

interface CaisseTab {
  label: string;
  route: string;
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
  readonly tabs: CaisseTab[] = [
    { label: 'Sessions', route: 'sessions' },
    { label: 'Prise de commande', route: 'commandes' },
    { label: 'Cuisine (KDS)', route: 'kds' },
  ];
}
