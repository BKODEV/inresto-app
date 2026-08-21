import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Component } from '@angular/core';

import { CaisseLayout } from './caisse.layout';
import { AuthService } from '../../../core/auth/auth.service';

@Component({ standalone: true, template: 'sessions' })
class SessionsStub {}

@Component({ standalone: true, template: 'commandes' })
class CommandesStub {}

/**
 * Le layout caisse ne filtrait aucun onglet : il les déclarait en dur, si bien
 * qu'un serveur voyait les fonds de caisse et qu'un cuisinier avait besoin de
 * `session_caisse.view` pour atteindre son écran.
 *
 * Sessions (fonds, écarts) et prise de commande sont deux métiers distincts
 * derrière deux permissions distinctes ; ces tests verrouillent la séparation.
 */
describe('CaisseLayout — onglets filtrés par permission', () => {
  function configurer(permissions: string[]): void {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: 'vente/caisse',
            component: CaisseLayout,
            children: [
              { path: '', pathMatch: 'full', redirectTo: 'sessions' },
              { path: 'sessions', component: SessionsStub },
              { path: 'commandes', component: CommandesStub },
            ],
          },
        ]),
        {
          provide: AuthService,
          useValue: { hasPermission: (p?: string) => !p || permissions.includes(p) },
        },
      ],
    });
  }

  it('n’expose que la prise de commande au serveur, malgré son session_caisse.view', async () => {
    // Le serveur détient `session_caisse.view` pour lister les sessions
    // ouvertes ; ça ne doit pas lui ouvrir l'écran des fonds de caisse.
    configurer(['commande_client.view', 'session_caisse.view']);
    const harness = await RouterTestingHarness.create();

    const layout = await harness.navigateByUrl('/vente/caisse/commandes', CaisseLayout);

    expect(layout.tabs().map((t) => t.route)).toEqual(['commandes']);
  });

  it('détourne un serveur qui atterrit sur les sessions de caisse', async () => {
    // La redirection par défaut vise « sessions » : sans garde-fou, le serveur
    // verrait les fonds initiaux et les écarts de caisse.
    configurer(['commande_client.view', 'session_caisse.view']);
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/vente/caisse');

    expect(TestBed.inject(Router).url).toBe('/vente/caisse/commandes');
  });

  it('détourne un responsable de caisse hors de la prise de commande', async () => {
    configurer(['session_caisse.create']);
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/vente/caisse/commandes');

    expect(TestBed.inject(Router).url).toBe('/vente/caisse/sessions');
  });

  it('cache les ventes au serveur, qui n’a aucun droit sur l’argent', async () => {
    configurer(['commande_client.view', 'session_caisse.view']);
    const harness = await RouterTestingHarness.create();

    const layout = await harness.navigateByUrl('/vente/caisse/commandes', CaisseLayout);

    expect(layout.tabs().map((t) => t.route)).not.toContain('ventes');
  });

  /**
   * Relire un service encaissé n'est pas encaisser : `paiement.view` suffit,
   * `paiement.create` n'est pas requis. Un responsable qui ne tient pas la
   * caisse doit pouvoir contrôler sans pouvoir saisir.
   */
  it('ouvre les ventes à qui peut voir l’argent sans le saisir', async () => {
    configurer(['paiement.view']);
    const harness = await RouterTestingHarness.create();

    const layout = await harness.navigateByUrl('/vente/caisse/sessions', CaisseLayout);

    expect(layout.tabs().map((t) => t.route)).toEqual(['ventes']);
  });

  it('montre les deux onglets au profil qui cumule les deux rôles', async () => {
    configurer(['session_caisse.create', 'commande_client.view']);
    const harness = await RouterTestingHarness.create();

    const layout = await harness.navigateByUrl('/vente/caisse/sessions', CaisseLayout);

    expect(layout.tabs().map((t) => t.route)).toEqual(['sessions', 'commandes']);
  });
});
