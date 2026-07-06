import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideClientHydration, withEventReplay, withNoIncrementalHydration } from '@angular/platform-browser';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideEchartsCore } from 'ngx-echarts';

import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { loadEchartsCore } from './shared/chart/echarts-core';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    provideClientHydration(withEventReplay(), withNoIncrementalHydration()),
    // ECharts chargé paresseusement, modules tree-shakés (cf. echarts-core.ts).
    provideEchartsCore({ echarts: loadEchartsCore }),
  ],
};
