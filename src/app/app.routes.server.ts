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
    /**
     * Seule exception : le menu public. Aucune session à attendre, donc rendu
     * côté serveur — la carte est lisible dès la première peinture (on arrive
     * ici par un scan, souvent en 4G) et la page est indexable.
     *
     * Son contenu dépend du jeton de l'URL : rendu à la demande, jamais prérendu.
     * Si l'API est injoignable depuis le serveur, la page part en état
     * « indisponible » et le navigateur la rattrape en refaisant l'appel.
     */
    path: 'menu/:token',
    renderMode: RenderMode.Server,
  },
  {
    path: '**',
    renderMode: RenderMode.Client,
  },
];
