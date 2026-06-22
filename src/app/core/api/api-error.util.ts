import { HttpErrorResponse } from '@angular/common/http';

import { ApiErrorResponse } from './api.types';

/**
 * Message d'erreur le plus précis d'une réponse API.
 *
 * Sur un 422, le backend renvoie `{ message, errors: { champ: [msg…] } }` où
 * `message` est générique (« Les données fournies sont invalides. ») et le
 * détail vit dans `errors`. On privilégie donc la première erreur de champ,
 * puis le message global, puis un fallback.
 */
export function apiErrorMessage(err: unknown, fallback = 'Une erreur est survenue.'): string {
  const body = err instanceof HttpErrorResponse ? (err.error as ApiErrorResponse | null) : null;

  const premiereErreurChamp = body?.errors
    ? Object.values(body.errors)
        .flat()
        .find((message) => !!message)
    : undefined;

  return premiereErreurChamp ?? body?.message ?? fallback;
}
