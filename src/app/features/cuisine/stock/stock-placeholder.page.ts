import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-stock-placeholder',
  standalone: true,
  template: `
    <div class="empty-state" style="margin-top: 24px">
      <span class="empty-title">À venir</span>
      <span class="empty-message">
        La lecture du stock par site (stock courant / PMP) et les mouvements ne sont pas encore
        exposés par l'API. Cet onglet sera alimenté lorsque l'endpoint backend correspondant sera
        disponible.
      </span>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StockPlaceholderPage {}
