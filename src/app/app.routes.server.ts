import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * L'authentification repose sur `localStorage` (token Sanctum), indisponible côté serveur.
 * Prérendre/SSR rendrait l'app en état « déconnecté » et afficherait l'écran de login
 * avant l'hydratation → flash visible au rafraîchissement.
 * On force donc le rendu côté client : le serveur n'émet que la coquille, guards et
 * navigation s'exécutent dans le navigateur où le token est lisible.
 */
export const serverRoutes: ServerRoute[] = [
  {
    path: '**',
    renderMode: RenderMode.Client,
  },
];
