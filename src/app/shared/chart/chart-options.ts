import { EChartsCoreOption } from 'echarts/core';

import { AMBER_AREA_GRADIENT, CHART_PALETTE } from './echarts-theme';

// Constructeurs d'options ECharts partagés par le tableau de bord et les écrans
// de pilotage. Le thème (couleurs/axes/tooltip) vient de `INRESTO_ECHARTS_THEME`
// appliqué par `<app-chart>` ; ici on ne décrit que la STRUCTURE (séries, axes,
// formatage). Le formatage des montants reste côté front (nombres bruts d'API).

const MONTANT = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const NOMBRE = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 });

const fMontant = (v: number): string => MONTANT.format(v ?? 0);
const fNombre = (v: number): string => NOMBRE.format(v ?? 0);

const GRID = { left: 8, right: 16, top: 24, bottom: 8, containLabel: true };

/** Courbe d'évolution du CA (aire ambre dégradée). */
export function caEvolutionLine(points: { label: string; ca: number }[]): EChartsCoreOption {
  return {
    grid: GRID,
    tooltip: {
      trigger: 'axis',
      valueFormatter: (v: number) => fMontant(v),
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: points.map((p) => p.label),
    },
    yAxis: { type: 'value', axisLabel: { formatter: (v: number) => fMontant(v) } },
    series: [
      {
        name: 'CA',
        type: 'line',
        smooth: true,
        showSymbol: false,
        areaStyle: { color: AMBER_AREA_GRADIENT },
        lineStyle: { width: 2, color: CHART_PALETTE.amber },
        itemStyle: { color: CHART_PALETTE.amber },
        data: points.map((p) => p.ca),
      },
    ],
  };
}

/** Donut (camembert). `items` : libellé + valeur (montant). */
export function donutChart(items: { name: string; value: number }[]): EChartsCoreOption {
  return {
    tooltip: {
      trigger: 'item',
      formatter: (p: { name: string; value: number; percent: number }) =>
        `${p.name}<br/><strong>${fMontant(p.value)}</strong> (${p.percent}%)`,
    },
    legend: { bottom: 0, left: 'center' },
    series: [
      {
        type: 'pie',
        radius: ['45%', '70%'],
        center: ['50%', '45%'],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: '#0b1220', borderWidth: 2 },
        label: { show: false },
        data: items,
      },
    ],
  };
}

interface BarOptions {
  /** Couleur de barre unique (défaut : ambre). */
  color?: string;
  /** Formatte la valeur (défaut : montant). */
  valueFormatter?: (v: number) => string;
}

/** Barres horizontales triées (top produits, valorisation, serveurs…). */
export function horizontalBar(
  items: { name: string; value: number }[],
  options: BarOptions = {},
): EChartsCoreOption {
  const format = options.valueFormatter ?? fMontant;
  // Plus grande valeur en haut : ECharts empile l'axe Y de bas en haut.
  const sorted = [...items].sort((a, b) => a.value - b.value);

  return {
    grid: { ...GRID, left: 8 },
    tooltip: { trigger: 'axis', valueFormatter: (v: number) => format(v) },
    xAxis: { type: 'value', axisLabel: { formatter: (v: number) => format(v) } },
    yAxis: { type: 'category', data: sorted.map((i) => i.name) },
    series: [
      {
        type: 'bar',
        barMaxWidth: 22,
        itemStyle: { color: options.color ?? CHART_PALETTE.amber, borderRadius: [0, 4, 4, 0] },
        data: sorted.map((i) => i.value),
      },
    ],
  };
}

/** Barres verticales (CA par point de vente). */
export function verticalBar(
  items: { name: string; value: number }[],
  options: BarOptions = {},
): EChartsCoreOption {
  const format = options.valueFormatter ?? fMontant;

  return {
    grid: GRID,
    tooltip: { trigger: 'axis', valueFormatter: (v: number) => format(v) },
    xAxis: { type: 'category', data: items.map((i) => i.name) },
    yAxis: { type: 'value', axisLabel: { formatter: (v: number) => format(v) } },
    series: [
      {
        type: 'bar',
        barMaxWidth: 36,
        itemStyle: { color: options.color ?? CHART_PALETTE.amber, borderRadius: [4, 4, 0, 0] },
        data: items.map((i) => i.value),
      },
    ],
  };
}

/** Barres groupées (food cost réel vs théorique). */
export function groupedBar(
  categories: string[],
  series: { name: string; data: number[]; color: string }[],
): EChartsCoreOption {
  return {
    grid: GRID,
    tooltip: { trigger: 'axis', valueFormatter: (v: number) => fMontant(v) },
    legend: { top: 0 },
    xAxis: { type: 'category', data: categories },
    yAxis: { type: 'value', axisLabel: { formatter: (v: number) => fMontant(v) } },
    series: series.map((s) => ({
      name: s.name,
      type: 'bar',
      barMaxWidth: 22,
      itemStyle: { color: s.color, borderRadius: [3, 3, 0, 0] },
      data: s.data,
    })),
  };
}

/**
 * Barres groupées food cost : coût théorique (ambre) vs réel par catégorie. Les
 * barres « réel » passent au rouge quand le réel dépasse le théorique (fuite).
 */
export function foodCostGroupedBar(
  items: { name: string; theorique: number; reel: number }[],
): EChartsCoreOption {
  return {
    grid: GRID,
    tooltip: { trigger: 'axis', valueFormatter: (v: number) => fMontant(v) },
    legend: { top: 0 },
    xAxis: { type: 'category', data: items.map((i) => i.name) },
    yAxis: { type: 'value', axisLabel: { formatter: (v: number) => fMontant(v) } },
    series: [
      {
        name: 'Théorique',
        type: 'bar',
        barMaxWidth: 20,
        itemStyle: { color: CHART_PALETTE.amber, borderRadius: [3, 3, 0, 0] },
        data: items.map((i) => i.theorique),
      },
      {
        name: 'Réel',
        type: 'bar',
        barMaxWidth: 20,
        data: items.map((i) => ({
          value: i.reel,
          itemStyle: {
            color: i.reel > i.theorique ? CHART_PALETTE.red : CHART_PALETTE.green,
            borderRadius: [3, 3, 0, 0],
          },
        })),
      },
    ],
  };
}

/** Barres empilées horizontales (consommation par type de mouvement). */
export function stackedBar(
  categories: string[],
  series: { name: string; data: number[]; color?: string }[],
): EChartsCoreOption {
  return {
    grid: { ...GRID, left: 8 },
    tooltip: { trigger: 'axis', valueFormatter: (v: number) => fMontant(v) },
    legend: { top: 0 },
    xAxis: { type: 'value', axisLabel: { formatter: (v: number) => fMontant(v) } },
    yAxis: { type: 'category', data: categories },
    series: series.map((s) => ({
      name: s.name,
      type: 'bar',
      stack: 'total',
      itemStyle: s.color ? { color: s.color } : {},
      data: s.data,
    })),
  };
}

/** Barres divergentes (+/-) colorées par signe — écarts d'inventaire. */
export function divergingBar(items: { name: string; value: number }[]): EChartsCoreOption {
  const sorted = [...items].sort((a, b) => a.value - b.value);

  return {
    grid: { ...GRID, left: 8 },
    tooltip: { trigger: 'axis', valueFormatter: (v: number) => fMontant(v) },
    xAxis: { type: 'value', axisLabel: { formatter: (v: number) => fMontant(v) } },
    yAxis: { type: 'category', data: sorted.map((i) => i.name) },
    series: [
      {
        type: 'bar',
        barMaxWidth: 22,
        data: sorted.map((i) => ({
          value: i.value,
          itemStyle: { color: i.value < 0 ? CHART_PALETTE.red : CHART_PALETTE.green },
        })),
      },
    ],
  };
}

/** Jauge de consommation budgétaire (0–100+), couleur selon le niveau. */
export function gaugeChart(pourcentage: number, color: string): EChartsCoreOption {
  return {
    series: [
      {
        type: 'gauge',
        min: 0,
        max: 100,
        radius: '92%',
        progress: { show: true, width: 12, itemStyle: { color } },
        axisLine: { lineStyle: { width: 12, color: [[1, '#1f2a44']] } },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { distance: 14, color: '#64748b', fontSize: 10 },
        pointer: { show: false },
        anchor: { show: false },
        title: { show: false },
        detail: {
          valueAnimation: true,
          formatter: (v: number) => `${MONTANT.format(v)} %`,
          color,
          fontSize: 22,
          offsetCenter: [0, 0],
        },
        data: [{ value: Math.min(pourcentage, 100) }],
      },
    ],
  };
}

export const chartFormat = { montant: fMontant, nombre: fNombre };
