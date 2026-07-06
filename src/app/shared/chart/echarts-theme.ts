// Thème ECharts sombre PARTAGÉ : aligné sur les tokens du design-system
// (`src/styles/_design-system.scss`). Centralisé ici pour ne jamais répéter la
// palette dans chaque graphe — passé en `[theme]` au directive ngx-echarts, qui
// le transmet à `echarts.init(el, theme)`.

/** Palette de séries (ambre en tête, puis accents lisibles sur fond sombre). */
export const CHART_PALETTE = {
  amber: '#fbbf24',
  amber2: '#f59e0b',
  green: '#10b981',
  blue: '#3b82f6',
  purple: '#a855f7',
  red: '#ef4444',
} as const;

const TEXT = '#e2e8f0';
const TEXT_DIM = '#94a3b8';
const BORDER = '#1f2a44';
const BORDER_STRONG = '#2a3858';
const SURFACE = '#15203a';

/** Dégradé d'aire ambre (haut → transparent) pour les courbes d'évolution. */
export const AMBER_AREA_GRADIENT = {
  type: 'linear',
  x: 0,
  y: 0,
  x2: 0,
  y2: 1,
  colorStops: [
    { offset: 0, color: 'rgba(251, 191, 36, 0.35)' },
    { offset: 1, color: 'rgba(251, 191, 36, 0.02)' },
  ],
} as const;

const axisCommon = {
  axisLine: { lineStyle: { color: BORDER_STRONG } },
  axisTick: { show: false },
  axisLabel: { color: TEXT_DIM, fontSize: 11 },
  splitLine: { lineStyle: { color: BORDER, type: 'dashed' as const } },
};

/** Thème sombre transparent, réutilisé par tous les `<app-chart>`. */
export const INRESTO_ECHARTS_THEME: Record<string, unknown> = {
  color: [
    CHART_PALETTE.amber,
    CHART_PALETTE.green,
    CHART_PALETTE.blue,
    CHART_PALETTE.purple,
    CHART_PALETTE.amber2,
    CHART_PALETTE.red,
  ],
  backgroundColor: 'transparent',
  textStyle: { fontFamily: 'Inter, system-ui, sans-serif', color: TEXT },
  title: {
    textStyle: { color: TEXT, fontSize: 14, fontWeight: 600 },
    subtextStyle: { color: TEXT_DIM },
  },
  categoryAxis: { ...axisCommon, splitLine: { show: false } },
  valueAxis: axisCommon,
  legend: {
    textStyle: { color: TEXT_DIM },
    inactiveColor: '#475569',
    icon: 'roundRect',
  },
  tooltip: {
    backgroundColor: SURFACE,
    borderColor: BORDER_STRONG,
    borderWidth: 1,
    textStyle: { color: TEXT, fontSize: 12 },
    extraCssText: 'border-radius: 10px; box-shadow: 0 8px 24px rgba(0,0,0,0.45);',
  },
  line: { symbol: 'circle', symbolSize: 6, smooth: true },
};
