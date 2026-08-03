import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideLocationMocks } from '@angular/common/testing';

import { routes } from './app.routes';
import { AUTH_TOKEN_STORAGE_KEY, AUTH_USER_STORAGE_KEY } from './core/auth/auth.tokens';

/**
 * `/cuisine/commandes` porte désormais un layout à onglets (liste + réceptions),
 * tandis que la fiche détail reste une route SŒUR `commandes/:id` hors du
 * layout. La résolution repose donc sur le retour arrière du router : le layout
 * matche le préfixe, aucun de ses enfants ne matche `:id`, et le router doit
 * reprendre sur la route suivante.
 *
 * Ces tests verrouillent ce comportement : c'est le seul point de la
 * restructuration qui casserait silencieusement la navigation.
 */
describe('routes cuisine/commandes', () => {
  let router: Router;

  beforeEach(async () => {
    // Les routes cuisine sont derrière `authGuard` : on sème une session
    // super-admin (toutes permissions implicites) pour n'éprouver que le
    // matching d'URL, pas les gardes.
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jeton-de-test');
    localStorage.setItem(
      AUTH_USER_STORAGE_KEY,
      JSON.stringify({ id: '1', nom: 'Test', roles: ['super-admin'], permissions: [] }),
    );

    await TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideHttpClient(), provideLocationMocks()],
    }).compileComponents();

    router = TestBed.inject(Router);
  });

  afterEach(() => {
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    localStorage.removeItem(AUTH_USER_STORAGE_KEY);
  });

  it('redirige /cuisine/commandes vers l’onglet liste', async () => {
    await router.navigateByUrl('/cuisine/commandes');

    expect(router.url).toBe('/cuisine/commandes/liste');
  });

  it('résout l’onglet réceptions', async () => {
    await router.navigateByUrl('/cuisine/commandes/receptions');

    expect(router.url).toBe('/cuisine/commandes/receptions');
  });

  it('résout la fiche détail malgré le layout à onglets', async () => {
    const ok = await router.navigateByUrl('/cuisine/commandes/42');

    expect(ok).toBe(true);
    expect(router.url).toBe('/cuisine/commandes/42');
  });

  /**
   * La liste des commandes vit sous l'onglet `/cuisine/commandes/liste`, alors
   * que la fiche détail est une route SŒUR. Un lien relatif depuis la liste
   * viserait donc `…/liste/:id`, qui ne matche rien et retombe sur le `**` du
   * shell — c'est-à-dire le dashboard. D'où les liens absolus dans le template.
   *
   * Ce test épingle la contrainte : si `commandes/:id` devenait un enfant du
   * layout, il échouerait et les liens pourraient redevenir relatifs.
   */
  it('ne résout pas un chemin relatif à l’onglet liste', async () => {
    await router.navigateByUrl('/cuisine/commandes/liste/42');

    expect(router.url).toBe('/dashboard');
  });

  /**
   * La redirection par défaut doit viser le PREMIER onglet de `stock.layout`.
   * Elle pointait sur « Inventaires » depuis l'époque où c'était le seul écran :
   * l'utilisateur atterrissait au milieu de la barre d'onglets.
   */
  it('redirige /cuisine/stock vers le premier onglet', async () => {
    await router.navigateByUrl('/cuisine/stock');

    expect(router.url).toBe('/cuisine/stock/etat');
  });

  it('résout l’onglet état du stock', async () => {
    await router.navigateByUrl('/cuisine/stock/etat');

    expect(router.url).toBe('/cuisine/stock/etat');
  });

  it('résout l’onglet mouvements de stock', async () => {
    await router.navigateByUrl('/cuisine/stock/mouvements');

    expect(router.url).toBe('/cuisine/stock/mouvements');
  });
});
