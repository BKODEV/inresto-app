import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  PLATFORM_ID,
  inject,
  input,
  output,
} from '@angular/core';
import { EChartsCoreOption, ECElementEvent } from 'echarts/core';
import { NgxEchartsDirective } from 'ngx-echarts';

import { INRESTO_ECHARTS_THEME } from './echarts-theme';

/**
 * Wrapper de graphe réutilisable au-dessus de ngx-echarts.
 *
 * - applique le thème sombre partagé ({@link INRESTO_ECHARTS_THEME}) ;
 * - gère le responsive (`autoResize`, ResizeObserver interne du directive) ;
 * - SSR-safe : ECharts manipule canvas/DOM, donc le rendu est protégé par
 *   `isPlatformBrowser`. Côté serveur, on émet un placeholder de même hauteur
 *   qui s'hydrate en vrai graphe au montage client.
 */
@Component({
  selector: 'app-chart',
  standalone: true,
  imports: [NgxEchartsDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isBrowser) {
      <div
        echarts
        class="chart-canvas"
        [options]="options()"
        [theme]="theme"
        [autoResize]="true"
        [loading]="loading()"
        [style.height.px]="height()"
        (chartClick)="chartClick.emit($event)"
      ></div>
    } @else {
      <div class="chart-placeholder" [style.height.px]="height()"></div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }
      .chart-canvas,
      .chart-placeholder {
        width: 100%;
      }
      .chart-placeholder {
        border-radius: var(--radius-md);
        background: var(--surface-2);
      }
    `,
  ],
})
export class ChartComponent {
  private readonly isBrowserPlatform = isPlatformBrowser(inject(PLATFORM_ID));

  readonly options = input.required<EChartsCoreOption>();
  readonly height = input<number>(320);
  readonly loading = input<boolean>(false);

  readonly chartClick = output<ECElementEvent>();

  readonly theme = INRESTO_ECHARTS_THEME;

  get isBrowser(): boolean {
    return this.isBrowserPlatform;
  }
}
