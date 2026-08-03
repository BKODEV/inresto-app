import { environment } from '../../../environments/environment';

/**
 * Base d'API utilisable AUSSI pendant le rendu serveur (page menu publique).
 *
 * Le navigateur résout seul un chemin relatif comme `/api` ; `fetch` côté
 * serveur, lui, exige une URL absolue. On la lit alors dans l'environnement du
 * processus SSR — et surtout PAS dans l'origine de la requête entrante : avec
 * `allowedHosts: ["*"]` (chaque instance a son domaine, on ne peut pas les
 * lister au build), un en-tête `Host` forgé ferait sinon appeler au serveur
 * l'hôte de son choix (SSRF).
 *
 * À défaut de variable d'env, l'appel serveur échoue proprement : la page part
 * en état « indisponible » et le navigateur la rattrape en refaisant l'appel.
 */
export function apiBaseUrl(): string {
  const base = environment.apiUrl;

  // Base déjà absolue (cas actuel) : rien à résoudre, serveur comme navigateur.
  if (/^https?:\/\//i.test(base)) {
    return base;
  }

  const surServeur = typeof window === 'undefined';

  if (!surServeur) {
    return base;
  }

  // Typage local plutôt que les types Node ambiants : ce fichier est aussi
  // compilé pour le navigateur et pour les tests, où `process` n'existe pas.
  const processus = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process;
  const origine = processus?.env?.['INRESTO_SSR_API_ORIGIN'];

  return origine ? new URL(base, origine).toString().replace(/\/$/, '') : base;
}
