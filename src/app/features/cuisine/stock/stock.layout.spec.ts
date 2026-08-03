import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Component } from '@angular/core';

import { StockLayout } from './stock.layout';
import { AuthService } from '../../../core/auth/auth.service';

@Component({ standalone: true, template: 'etat' })
class EtatStub {}

@Component({ standalone: true, template: 'mouvements' })
class MouvementsStub {}

@Component({ standalone: true, template: 'inventaires' })
class InventairesStub {}

/**
 * `redirigerVersOngletAutorise` s'exécute dans le constructeur du layout — donc
 * pendant l'activation de la route. `app.routes.spec` ne construit aucun
 * composant : seul un rendu réel via `RouterTestingHarness` exerce ce chemin.
 *
 * Les deux premiers tests vérifient que le garde-fou ne détourne PAS une
 * navigation légitime ; le troisième est celui qui échoue si on le retire.
 */
describe('StockLayout — redirection vers un onglet autorisé', () => {
  function configurer(permissions: string[]): void {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: 'cuisine/stock',
            component: StockLayout,
            children: [
              { path: '', pathMatch: 'full', redirectTo: 'etat' },
              { path: 'etat', component: EtatStub },
              { path: 'mouvements', component: MouvementsStub },
              { path: 'inventaires', component: InventairesStub },
            ],
          },
        ]),
        {
          provide: AuthService,
          useValue: {
            hasPermission: (p?: string) => !p || permissions.includes(p),
          },
        },
      ],
    });
  }

  it('laisse atteindre un onglet autorisé autre que le premier', async () => {
    configurer(['stock.view', 'inventaire.view']);
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/cuisine/stock/mouvements');

    expect(TestBed.inject(Router).url).toBe('/cuisine/stock/mouvements');
  });

  it('suit la redirection par défaut vers le premier onglet', async () => {
    configurer(['stock.view', 'inventaire.view']);
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/cuisine/stock');

    expect(TestBed.inject(Router).url).toBe('/cuisine/stock/etat');
  });

  it('détourne vers le premier onglet autorisé quand l’URL en vise un interdit', async () => {
    // Rôle personnalisé ne portant que `inventaire.view` : la redirection par
    // défaut le déposerait sur « État du stock », onglet absent de sa barre et
    // dont l'API refuse les données.
    configurer(['inventaire.view']);
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/cuisine/stock/etat');

    expect(TestBed.inject(Router).url).toBe('/cuisine/stock/inventaires');
  });

  it('n’interfère pas quand toutes les permissions manquent', async () => {
    configurer([]);
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/cuisine/stock/etat');

    // Aucun onglet autorisé : rien vers quoi rediriger, l'écran gère son 403.
    expect(TestBed.inject(Router).url).toBe('/cuisine/stock/etat');
  });
});
