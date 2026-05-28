import { Routes } from '@angular/router';

import { authGuard, guestGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'dashboard',
  },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/login/login.page').then((m) => m.LoginPage),
    title: 'InnResto — Connexion',
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/shell/shell.layout').then((m) => m.ShellLayout),
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.page').then((m) => m.DashboardPage),
        title: 'InnResto — Tableau de bord',
      },
      {
        path: 'points-de-vente',
        loadComponent: () =>
          import('./features/points-de-vente/points-de-vente.page').then((m) => m.PointsDeVentePage),
        title: 'InnResto — Points de vente',
      },
      {
        path: 'parametres',
        children: [
          {
            path: 'categories-produit',
            loadComponent: () =>
              import('./features/parametres/categories-produit/categories-produit.page').then(
                (m) => m.CategoriesProduitPage,
              ),
            title: 'InnResto — Catégories produit',
          },
          {
            path: 'categories-matiere-premiere',
            loadComponent: () =>
              import(
                './features/parametres/categories-matiere-premiere/categories-matiere-premiere.page'
              ).then((m) => m.CategoriesMatierePremierePage),
            title: 'InnResto — Catégories matière première',
          },
          {
            path: 'unites-de-mesure',
            loadComponent: () =>
              import('./features/parametres/unites-de-mesure/unites-de-mesure.page').then(
                (m) => m.UnitesDeMesurePage,
              ),
            title: 'InnResto — Unités de mesure',
          },
          {
            path: 'modes-de-paiement',
            loadComponent: () =>
              import('./features/parametres/modes-de-paiement/modes-de-paiement.page').then(
                (m) => m.ModesDePaiementPage,
              ),
            title: 'InnResto — Modes de paiement',
          },
          {
            path: 'caisses',
            loadComponent: () =>
              import('./features/parametres/caisses/caisses.page').then((m) => m.CaissesPage),
            title: 'InnResto — Caisses',
          },
          {
            path: 'cartes',
            loadComponent: () =>
              import('./features/parametres/cartes/cartes.page').then((m) => m.CartesPage),
            title: 'InnResto — Cartes',
          },
        ],
      },
      {
        path: '**',
        redirectTo: 'dashboard',
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'login',
  },
];
