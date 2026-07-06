// Chargement d'ECharts en import TREE-SHAKÉ : on n'enregistre que les types de
// graphes et composants réellement utilisés dans l'app (Line/Bar/Pie/Gauge +
// tooltip/grid/legend/markLine), jamais le bundle global `echarts`.
//
// La fonction est passée à `provideEchartsCore({ echarts: loadEchartsCore })` :
// ngx-echarts l'appelle paresseusement, ce qui sort ECharts du bundle initial
// (code-splitting) tout en gardant la sélection de modules maîtrisée.

let corePromise: Promise<typeof import('echarts/core')> | null = null;

export function loadEchartsCore(): Promise<typeof import('echarts/core')> {
  corePromise ??= register();

  return corePromise;
}

async function register(): Promise<typeof import('echarts/core')> {
  const core = await import('echarts/core');
  const [{ LineChart, BarChart, PieChart, GaugeChart }, components, { CanvasRenderer }, features] =
    await Promise.all([
      import('echarts/charts'),
      import('echarts/components'),
      import('echarts/renderers'),
      import('echarts/features'),
    ]);

  core.use([
    LineChart,
    BarChart,
    PieChart,
    GaugeChart,
    components.TitleComponent,
    components.TooltipComponent,
    components.GridComponent,
    components.LegendComponent,
    components.MarkLineComponent,
    features.LabelLayout,
    CanvasRenderer,
  ]);

  return core;
}
