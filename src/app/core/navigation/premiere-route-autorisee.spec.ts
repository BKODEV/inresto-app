import { premiereRouteAutorisee } from './premiere-route-autorisee';
import { AuthService } from '../auth/auth.service';

/**
 * La racine et la sortie de connexion renvoyaient en dur sur `/dashboard`, un
 * écran que l'API gouverne par `reporting.dashboard`. Un caissier, un cuisinier
 * — qui ne l'ont pas — atterrissaient à chaque connexion sur une page qui ne
 * pouvait que refuser de se charger.
 */
describe('premiereRouteAutorisee', () => {
  function auth(permissions: string[], superAdmin = false): AuthService {
    return {
      hasAnyPermission: (p?: string | string[]) => {
        if (!p || superAdmin) {
          return true;
        }
        return (Array.isArray(p) ? p : [p]).some((x) => permissions.includes(x));
      },
    } as unknown as AuthService;
  }

  it('mène au tableau de bord qui en a le droit', () => {
    expect(premiereRouteAutorisee(auth(['reporting.dashboard']))).toBe('/dashboard');
  });

  it('mène le super-admin au tableau de bord', () => {
    expect(premiereRouteAutorisee(auth([], true))).toBe('/dashboard');
  });

  /**
   * Le cas qui motive tout : un serveur n'a pas `reporting.dashboard`. Il doit
   * arriver sur son écran de travail, pas sur un refus.
   */
  it('pose le serveur sur sa prise de commande, et non sur un refus', () => {
    expect(premiereRouteAutorisee(auth(['commande_client.view', 'table.view']))).toBe(
      '/vente/tables',
    );
  });

  it('ne propose jamais une entrée non livrée', () => {
    // `enabled: false` marque un écran qui n'existe pas encore : y rediriger
    // enverrait sur une route qui ne matche rien.
    const route = premiereRouteAutorisee(auth([], true));

    expect(route).not.toBe('/vente/reservations');
  });

  /** Sans aucun droit, le refus explicite du tableau de bord vaut mieux qu'une boucle. */
  it('retombe sur le tableau de bord quand rien n’est ouvert', () => {
    expect(premiereRouteAutorisee(auth([]))).toBe('/dashboard');
  });
});
