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
    loadComponent: () => import('./features/auth/login/login.page').then((m) => m.LoginPage),
    title: 'InnResto — Connexion',
  },
  {
    // Page publique : consommation du lien de réinitialisation reçu par email.
    path: 'reset-password',
    loadComponent: () =>
      import('./features/auth/reset-password/reset-password.page').then((m) => m.ResetPasswordPage),
    title: 'InnResto — Réinitialisation du mot de passe',
  },
  {
    // Page publique : menu consulté par un client depuis le QR de sa table.
    // Aucun guard — le client n'a pas de compte ; le jeton de l'URL est la clé.
    // Déclarée hors du shell : ni barre latérale, ni sélecteur de site.
    path: 'menu/:token',
    loadComponent: () =>
      import('./features/public/menu/menu-public.page').then((m) => m.MenuPublicPage),
    title: 'Menu',
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./features/shell/shell.layout').then((m) => m.ShellLayout),
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.page').then((m) => m.DashboardPage),
        title: 'InnResto — Tableau de bord',
      },
      {
        path: 'cuisine',
        children: [
          {
            path: 'fournisseurs',
            loadComponent: () =>
              import('./features/cuisine/fournisseurs/fournisseurs.page').then(
                (m) => m.FournisseursPage,
              ),
            title: 'InnResto — Fournisseurs',
          },
          {
            path: 'fournisseurs/:id',
            loadComponent: () =>
              import('./features/cuisine/fournisseurs/fournisseur-detail.page').then(
                (m) => m.FournisseurDetailPage,
              ),
            title: 'InnResto — Fiche fournisseur',
          },
          {
            path: 'matieres-premieres',
            loadComponent: () =>
              import('./features/cuisine/matieres-premieres/matieres-premieres.page').then(
                (m) => m.MatieresPremieresPage,
              ),
            title: 'InnResto — Matières premières',
          },
          {
            path: 'commandes',
            loadComponent: () =>
              import('./features/cuisine/commandes/commandes.layout').then(
                (m) => m.CommandesLayout,
              ),
            children: [
              { path: '', pathMatch: 'full', redirectTo: 'liste' },
              {
                path: 'liste',
                loadComponent: () =>
                  import('./features/cuisine/commandes/commandes.page').then(
                    (m) => m.CommandesPage,
                  ),
                title: 'InnResto — Commandes fournisseur',
              },
              {
                path: 'receptions',
                loadComponent: () =>
                  import('./features/cuisine/commandes/receptions.page').then(
                    (m) => m.ReceptionsPage,
                  ),
                title: 'InnResto — Réceptions',
              },
            ],
          },
          {
            // Hors du layout à onglets : la fiche détail occupe toute la page.
            path: 'commandes/:id',
            loadComponent: () =>
              import('./features/cuisine/commandes/commande-detail.page').then(
                (m) => m.CommandeDetailPage,
              ),
            title: 'InnResto — Commande fournisseur',
          },
          {
            path: 'fiches-techniques',
            loadComponent: () =>
              import('./features/cuisine/fiches-techniques/fiches-techniques.layout').then(
                (m) => m.FichesTechniquesLayout,
              ),
            children: [
              { path: '', pathMatch: 'full', redirectTo: 'produits' },
              {
                path: 'produits',
                loadComponent: () =>
                  import('./features/vente/cartes/produits.page').then((m) => m.ProduitsPage),
                title: 'InnResto — Produits',
              },
              {
                path: 'fiches',
                loadComponent: () =>
                  import('./features/cuisine/fiches-techniques/fiches-techniques.page').then(
                    (m) => m.FichesTechniquesPage,
                  ),
                title: 'InnResto — Fiches techniques',
              },
              {
                path: 'sous-recettes',
                loadComponent: () =>
                  import('./features/cuisine/fiches-techniques/sous-recettes.page').then(
                    (m) => m.SousRecettesPage,
                  ),
                title: 'InnResto — Sous-recettes',
              },
            ],
          },
          {
            path: 'produits/:id',
            loadComponent: () =>
              import('./features/cuisine/produits/produit-detail.page').then(
                (m) => m.ProduitDetailPage,
              ),
            title: 'InnResto — Fiche produit',
          },
          {
            path: 'stock',
            loadComponent: () =>
              import('./features/cuisine/stock/stock.layout').then((m) => m.StockLayout),
            children: [
              // Premier onglet de `stock.layout`. Le maintenir aligné : viser un
              // onglet plus loin dans la barre fait atterrir l'utilisateur
              // ailleurs que là où le menu le laisse attendre.
              { path: '', pathMatch: 'full', redirectTo: 'etat' },
              {
                path: 'etat',
                loadComponent: () =>
                  import('./features/cuisine/stock/etat-stock.page').then((m) => m.EtatStockPage),
                title: 'InnResto — État du stock',
              },
              {
                path: 'mouvements',
                loadComponent: () =>
                  import('./features/cuisine/stock/mouvements-stock.page').then(
                    (m) => m.MouvementsStockPage,
                  ),
                title: 'InnResto — Mouvements de stock',
              },
              {
                path: 'inventaires',
                loadComponent: () =>
                  import('./features/cuisine/stock/inventaires.page').then(
                    (m) => m.InventairesPage,
                  ),
                title: 'InnResto — Inventaires',
              },
            ],
          },
          {
            path: 'budget',
            loadComponent: () =>
              import('./features/cuisine/budget/budget.page').then((m) => m.BudgetPage),
            title: 'InnResto — Budget',
          },
        ],
      },
      {
        path: 'vente',
        children: [
          {
            path: 'cartes',
            loadComponent: () =>
              import('./features/vente/cartes/cartes.layout').then((m) => m.CartesLayout),
            children: [
              { path: '', pathMatch: 'full', redirectTo: 'liste' },
              {
                path: 'liste',
                loadComponent: () =>
                  import('./features/vente/cartes/cartes.page').then((m) => m.CartesPage),
                title: 'InnResto — Cartes',
              },
              {
                path: 'produits',
                loadComponent: () =>
                  import('./features/vente/cartes/produits.page').then((m) => m.ProduitsPage),
                title: 'InnResto — Produits',
              },
            ],
          },
          {
            path: 'carte/:id',
            loadComponent: () =>
              import('./features/vente/cartes/carte-composition.page').then(
                (m) => m.CarteCompositionPage,
              ),
            title: 'InnResto — Composition de carte',
          },
          {
            path: 'tables',
            loadComponent: () =>
              import('./features/vente/tables/tables.page').then((m) => m.TablesPage),
            title: 'InnResto — Plan de tables',
          },
          {
            path: 'caisse',
            loadComponent: () =>
              import('./features/vente/caisse/caisse.layout').then((m) => m.CaisseLayout),
            children: [
              { path: '', pathMatch: 'full', redirectTo: 'sessions' },
              {
                path: 'sessions',
                loadComponent: () =>
                  import('./features/vente/caisse/sessions.page').then((m) => m.SessionsPage),
                title: 'InnResto — Sessions de caisse',
              },
              {
                path: 'commandes',
                loadComponent: () =>
                  import('./features/vente/caisse/commandes.page').then(
                    (m) => m.CommandesVentePage,
                  ),
                title: 'InnResto — Prise de commande',
              },
              {
                path: 'commandes/:id',
                loadComponent: () =>
                  import('./features/vente/caisse/commande-detail.page').then(
                    (m) => m.CommandeVenteDetailPage,
                  ),
                title: 'InnResto — Commande',
              },
              {
                path: 'kds',
                loadComponent: () =>
                  import('./features/vente/caisse/kds.page').then((m) => m.KdsPage),
                title: 'InnResto — Cuisine (KDS)',
              },
            ],
          },
        ],
      },
      {
        path: 'pilotage',
        loadComponent: () =>
          import('./features/pilotage/pilotage.layout').then((m) => m.PilotageLayout),
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'ventes' },
          {
            path: 'food-cost',
            loadComponent: () =>
              import('./features/pilotage/food-cost/food-cost.page').then((m) => m.FoodCostPage),
            title: 'InnResto — Food cost',
          },
          {
            path: 'ventes',
            loadComponent: () =>
              import('./features/pilotage/ventes/ventes.page').then((m) => m.VentesPage),
            title: 'InnResto — Ventes',
          },
          {
            path: 'stock',
            loadComponent: () =>
              import('./features/pilotage/stock/stock.page').then((m) => m.StockReportingPage),
            title: 'InnResto — Stock (pilotage)',
          },
          {
            path: 'budget',
            loadComponent: () =>
              import('./features/pilotage/budget/budget-reporting.page').then(
                (m) => m.BudgetReportingPage,
              ),
            title: 'InnResto — Budget (pilotage)',
          },
        ],
      },
      {
        path: 'parametres',
        loadComponent: () =>
          import('./features/parametres/parametres.layout').then((m) => m.ParametresLayout),
        children: [
          {
            path: '',
            pathMatch: 'full',
            redirectTo: 'sites',
          },
          {
            path: 'sites',
            loadComponent: () =>
              import('./features/parametres/sites/sites.page').then((m) => m.SitesPage),
            title: 'InnResto — Sites',
          },
          {
            path: 'sites/:id',
            loadComponent: () =>
              import('./features/parametres/sites/site-detail.page').then((m) => m.SiteDetailPage),
            title: 'InnResto — Détail de site',
          },
          {
            path: 'points-de-vente/:id',
            loadComponent: () =>
              import('./features/parametres/points-de-vente/point-de-vente-detail.page').then(
                (m) => m.PointDeVenteDetailPage,
              ),
            title: 'InnResto — Détail point de vente',
          },
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
              import('./features/parametres/categories-matiere-premiere/categories-matiere-premiere.page').then(
                (m) => m.CategoriesMatierePremierePage,
              ),
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
            path: 'utilisateurs',
            loadComponent: () =>
              import('./features/parametres/utilisateurs/utilisateurs.page').then(
                (m) => m.UtilisateursPage,
              ),
            title: 'InnResto — Utilisateurs',
          },
          {
            path: 'roles',
            loadComponent: () =>
              import('./features/parametres/roles/roles.page').then((m) => m.RolesPage),
            title: 'InnResto — Rôles',
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
