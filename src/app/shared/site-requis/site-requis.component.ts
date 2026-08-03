import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';

import { SelectedSiteService } from '../../core/site/selected-site.service';

/**
 * Encart affiché sur un écran opérationnel lorsque la portée courante est la vue
 * consolidée.
 *
 * Stock, PMP et budgets sont propres à chaque site et aucun transfert
 * inter-sites n'existe : réceptionner, inventorier ou consulter un stock n'a de
 * sens que sur un site désigné. Plutôt que de retomber en silence sur un site
 * arbitraire, on demande le choix — et on l'offre sur place.
 */
@Component({
  selector: 'app-site-requis',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="site-requis">
      <span class="site-requis-titre">Vue consolidée</span>
      <p class="site-requis-message">{{ message() }}</p>

      <div class="site-requis-actions">
        @for (s of sites(); track s.id) {
          <button class="site-requis-option" type="button" (click)="choisir(s.id)">
            {{ s.nom }}
          </button>
        }
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .site-requis {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: var(--space-2);
      padding: var(--space-8) var(--space-4);
      background: var(--surface);
      border: 1px dashed var(--border-strong);
      border-radius: var(--radius-lg);
    }

    .site-requis-titre {
      font-size: var(--text-base);
      font-weight: 700;
      color: var(--text);
    }

    .site-requis-message {
      font-size: var(--text-sm);
      color: var(--text-dim);
      max-width: 46ch;
      margin: 0;
    }

    .site-requis-actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: var(--space-2);
      margin-top: var(--space-4);
    }

    .site-requis-option {
      padding: 8px 16px;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: var(--radius-full);
      color: var(--text);
      font: inherit;
      font-size: var(--text-sm);
      font-weight: 600;
      cursor: pointer;
      transition: border-color var(--transition-base);

      &:hover {
        border-color: var(--border-strong);
      }
    }
  `,
})
export class SiteRequisComponent {
  private readonly selectedSite = inject(SelectedSiteService);

  /** Précise ce que l'écran fait, pour que le message ne soit pas générique. */
  readonly message = input(
    'Cette page s’opère sur un site à la fois. Choisissez celui sur lequel travailler.',
  );

  readonly sites = this.selectedSite.sites;

  choisir(id: number): void {
    this.selectedSite.selectSite(id);
  }
}
