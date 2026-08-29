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

  /**
   * Régression réelle : en remontant CUISINE au-dessus de SALLE & VENTE, le
   * KDS — gardé par `commande_client.view`, que tout serveur détient — est
   * devenu la première entrée ouverte. Un serveur atterrissait sur l'afficheur
   * mural de la cuisine, un écran sans barre latérale dont il ne pouvait pas
   * ressortir.
   */
  it('ne dépose personne sur un écran servi hors du shell', () => {
    const route = premiereRouteAutorisee(auth(['commande_client.view', 'table.view']));

    expect(route).not.toBe('/kds');
    expect(route).not.toBe('/pass');
  });

  /**
   * L'exception : un compte d'APPAREIL — « Écran cuisine — Restaurant » — dont
   * le rôle ne porte que de quoi lire la file et annoncer au pass. Le repli sur
   * `/dashboard` le déposait, à chaque démarrage de la tablette murale, sur un
   * écran qu'il n'a pas le droit d'ouvrir.
   */
  it('mène le compte de l’écran mural à son écran, faute d’autre chose', () => {
    const ecran = auth(['commande_client.view', 'commande_client.marquer_pret']);

    expect(premiereRouteAutorisee(ecran)).toBe('/kds');
  });

  /**
   * L'appareil ne passe qu'en SECOND : dès qu'un écran de navigation est
   * ouvert, c'est lui la destination. Sinon un serveur, qui détient
   * `commande_client.view` pour prendre ses commandes, se retrouverait sur
   * l'afficheur de la cuisine.
   */
  it('préfère toujours un écran de navigation à un appareil', () => {
    const serveur = auth(['commande_client.view', 'commande_client.create', 'table.view']);

    expect(premiereRouteAutorisee(serveur)).toBe('/vente/tables');
  });

  it('n’y dépose pas non plus le super-admin', () => {
    // Il passe toutes les permissions : sans l'exclusion, l'ordre du menu seul
    // le protégerait — c'est-à-dire pas du tout.
    const route = premiereRouteAutorisee(auth([], true));

    expect(route).not.toBe('/kds');
    expect(route).not.toBe('/pass');
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
